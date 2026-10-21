import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeIntent } from './dialogueIntent.js';
import { buildSelectiveContextPrompt } from './contextSelector.js';
import { buildSystemPrompt } from './dialoguePrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Zero-dependency .env loader
export function loadEnv() {
  const envPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('读取 .env 文件失败:', e.message);
    }
  }
}

loadEnv();

const HOST = '127.0.0.1'; // 严格只监听本地回环地址
const PORT = parseInt(process.env.AI_SERVER_PORT || '3001', 10);
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
// 默认采用 deepseek-flash（官方低延迟、低成本客服对话模型，通过 thinking: { type: "disabled" } 运行于非思考模式）
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';

// 2. Simple in-memory rate limiter (max 25 requests per minute for local testing)
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 25;

  const records = rateLimitMap.get(ip) || [];
  const validRecords = records.filter((ts) => now - ts < windowMs);
  if (validRecords.length >= maxReqs) {
    return false;
  }
  validRecords.push(now);
  rateLimitMap.set(ip, validRecords);
  return true;
}

// 3. PII & Privacy Masking Utilities
export function maskSensitiveText(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  // A. 中国大陆手机号脱敏 (13812345678 -> 138****5678, 支持常见分隔符)
  result = result.replace(/(?:(?:\+|00)86)?\b(1[3-9]\d)[\s-]?(\d{4})[\s-]?(\d{4})\b/g, '$1****$3');

  // B. 固定电话脱敏 (010-12345678, 0755-12345678)
  result = result.replace(/\b0\d{2,3}[- ]?\d{7,8}\b/g, '[电话已脱敏]');

  // C. 电子邮箱脱敏 (buyer@example.com -> b***@example.com)
  result = result.replace(/([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, (match, prefix, domain) => {
    if (prefix.length <= 2) {
      return `***@${domain}`;
    }
    return `${prefix[0]}***${prefix[prefix.length - 1]}@${domain}`;
  });

  // D. 18位居民身份证号码脱敏
  result = result.replace(/\b\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g, '[身份证号已脱敏]');

  // E. 详细地址门牌号脱敏（保留省市区县，掩码门牌号、栋号、室号）
  result = result.replace(
    /((?:北京市|天津市|上海市|重庆市|[\u4e00-\u9fa5]{2,5}省)?[\u4e00-\u9fa5]{2,5}市[\u4e00-\u9fa5]{2,5}[区县市旗])[\u4e00-\u9fa50-9A-Za-z-_\s#号楼栋单元室弄街道路社区园区]+/g,
    '$1[具体收货地址已脱敏]'
  );

  return result;
}

// 4. 采购履约阶段转换（仅保留履约节奏状态，剥离所有供应商名称、单号、成本与内部备注）
export function getFulfillmentStage(purchaseStatus) {
  if (!purchaseStatus) return '尚未建立采购协同';
  switch (purchaseStatus) {
    case 'supplier_processing':
      return '供应商备货排产中';
    case 'procured_pending_shipment':
      return '工厂等待出库';
    case 'supplier_shipped':
      return '工厂已出库，干线转运中';
    case 'warehouse_received':
      return '中转质检仓已收货，等待分配快递发出';
    case 'cancelled':
      return '采购排单已调整';
    default:
      return '采购履约处理中';
  }
}

// 5. 严格字段白名单提取 (Explicit Field Whitelist)
export function extractSafeContext(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      customerQuery: '',
      order: null,
      product: null,
      conversationHistory: [],
      policies: {},
      settings: {},
    };
  }

  // 仅提取白名单字段，彻底阻断 purchaseOrder 原始对象、supplierName、costAmount、supplierNotes
  const customerQuery = maskSensitiveText(String(payload.customerQuery || '').trim());

  let safeOrder = null;
  if (payload.order && typeof payload.order === 'object') {
    const rawOrder = payload.order;
    safeOrder = {
      id: String(rawOrder.id || ''),
      productName: String(rawOrder.productName || ''),
      quantity: Number(rawOrder.quantity) || 1,
      amount: Number(rawOrder.amount) || 0,
      currency: String(rawOrder.currency || '¥'),
      orderStatus: String(rawOrder.orderStatus || 'paid_pending_shipment'),
      shippingCarrier: rawOrder.shippingCarrier ? String(rawOrder.shippingCarrier) : '',
      trackingNumber: rawOrder.trackingNumber ? String(rawOrder.trackingNumber) : '',
      // 采购协同：仅接收采购状态枚举并转换为中立履约阶段，绝不接收或传输供应商名、单号与成本
      fulfillmentStage: getFulfillmentStage(
        rawOrder.purchaseStatus || rawOrder.purchaseOrder?.status || rawOrder.fulfillmentStage
      ),
    };
  }

  let safeProduct = null;
  if (payload.product && typeof payload.product === 'object') {
    const rawProduct = payload.product;
    safeProduct = {
      name: String(rawProduct.name || ''),
      specs: String(rawProduct.specs || ''),
      description: String(rawProduct.description || ''),
      faqList: Array.isArray(rawProduct.faqList)
        ? rawProduct.faqList.map((f) => ({
            question: String(f.question || ''),
            answer: String(f.answer || ''),
          }))
        : [],
    };
  }

  let safeHistory = [];
  if (Array.isArray(payload.conversationHistory)) {
    safeHistory = payload.conversationHistory
      .slice(-6)
      .filter((m) => m && (typeof m.content === 'string' || typeof m.content === 'number'))
      .map((m) => ({
        role: m.sender === 'customer' || m.role === 'user' ? 'user' : 'assistant',
        content: maskSensitiveText(String(m.content).slice(0, 300)),
      }));
  }

  const safePolicies = {
    shippingRules: String(payload.policies?.shippingRules || '订单按付款顺序依次质检发出，时效以快递实际揽收为准'),
    returnPolicy: String(payload.policies?.returnPolicy || '支持7天无理由退换货（需商品完好），退换货需先联系客服核实退货信息'),
    faqList: Array.isArray(payload.policies?.faqList)
      ? payload.policies.faqList.map((f) => ({
          question: String(f.question || ''),
          answer: String(f.answer || ''),
          category: String(f.category || ''),
        }))
      : [],
  };

  const safeSettings = {
    storeName: String(payload.settings?.storeName || 'SellerDesk 生活馆'),
    brandTone: String(payload.settings?.brandTone || 'professional'),
    signature: String(payload.settings?.signature || '—— SellerDesk AI 客服'),
  };

  return {
    customerQuery,
    order: safeOrder,
    product: safeProduct,
    conversationHistory: safeHistory,
    policies: safePolicies,
    settings: safeSettings,
  };
}

// 6. Prompt Builder (基于意图识别、上下文精选与真人客服规范构建)
export function buildPromptPayload(rawPayload) {
  const safeContext = extractSafeContext(rawPayload);
  const intentAnalysis = analyzeIntent(safeContext.customerQuery, safeContext.conversationHistory);
  const { relevantFactsPrompt, conflictInstruction, conflictAuditReason } = buildSelectiveContextPrompt(
    safeContext,
    intentAnalysis
  );

  const systemContent = buildSystemPrompt(
    safeContext.settings.storeName,
    relevantFactsPrompt,
    conflictInstruction
  );

  const messages = [{ role: 'system', content: systemContent }];

  // 历史对话消息（过滤脱敏，并清洗历史中残留的机器人尾缀，防止对当前轮次造成负面模仿）
  for (const msg of safeContext.conversationHistory) {
    const cleanContent = String(msg.content)
      .replace(/\s*(——|--)\s*.*$/i, '')
      .trim();
    messages.push({ role: msg.role, content: cleanContent });
  }

  // 最终用户提问（已脱敏，截取前 500 字符）
  messages.push({ role: 'user', content: safeContext.customerQuery.slice(0, 500) });

  // 附加元数据供上层安全审计读取
  messages.intentAnalysis = intentAnalysis;
  messages.conflictAuditReason = conflictAuditReason;

  return messages;
}

// 6.1 真人客服回复清洗器 (消除模型偶发的机械尾巴、包裹引号或前缀)
export function cleanReplyText(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = text.trim();

  // 1. 去除首尾成对的外层引号
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith('“') && clean.endsWith('”'))) {
    clean = clean.slice(1, -1).trim();
  }

  // 2. 去除模型偶发的“回复：”、“客服：”等前缀
  clean = clean.replace(/^(回复|客服|店主|建议回复|卖家)[：:]\s*/i, '');

  // 3. 去除机械落款（如 “—— SellerDesk AI 客服”）
  clean = clean.replace(/\s*(——|--)\s*.*$/i, '');

  // 4. 去除机械开场白
  clean = clean.replace(/^(尊敬的客户(您好)?[，,。\s]*|亲亲[，,！!\s]*|亲爱的买家[，,。\s]*)/i, '');

  return clean.trim();
}

// 7. 本地安全校验中间件 (Origin / Host / Referer / Content-Type 严格防护)
function validateSecurity(req, res) {
  const host = req.headers.host || '';
  // 必须只允许本地 Host
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '禁止访问：Host 无效或不在本地允许列表中', code: 'INVALID_HOST' }));
    return false;
  }

  const origin = req.headers.origin;
  // 如果浏览器请求携带 Origin，必须严格限制为本地开发域名
  if (origin) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '禁止跨站访问：未经授权的请求 Origin', code: 'FORBIDDEN_ORIGIN' }));
      return false;
    }
    // 动态回设安全的本地 Origin，绝不使用通配符 '*'
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    // 若没有 Origin（如非跨域请求、内部转发或单元测试），检查 Referer 防范跨站
    const referer = req.headers.referer;
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (!/^(127\.0\.0\.1|localhost)$/i.test(refUrl.hostname)) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '禁止跨站访问：未经授权的 Referer', code: 'FORBIDDEN_REFERER' }));
          return false;
        }
      } catch {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '禁止跨站访问：Referer 格式非法', code: 'INVALID_REFERER' }));
        return false;
      }
    }
  }

  // 防范外部恶意网页触发 cross-site 简单请求
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    if (!origin || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '禁止跨站访问：阻止未经授权的跨站请求', code: 'FORBIDDEN_CROSS_SITE' }));
      return false;
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  return true;
}

// 8. 创建 HTTP Server
export function createServer() {
  const server = http.createServer(async (req, res) => {
    // 安全校验
    if (!validateSecurity(req, res)) {
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    // 健康检查状态接口
    if (req.method === 'GET' && parsedUrl.pathname === '/api/deepseek/status') {
      const apiKey = process.env.DEEPSEEK_API_KEY || '';
      const currentModel = process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL;
      const currentBaseUrl = (process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL).replace(/\/+$/, '');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          configured: Boolean(apiKey && apiKey.trim().length > 5),
          model: currentModel,
          baseUrl: currentBaseUrl,
        })
      );
      return;
    }

    // 智能客服模型代理接口
    if (req.method === 'POST' && parsedUrl.pathname === '/api/deepseek/chat') {
      // 严格校验 Content-Type
      const contentType = req.headers['content-type'] || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        res.writeHead(415, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: '请求 Content-Type 必须为 application/json',
            code: 'INVALID_CONTENT_TYPE',
          })
        );
        return;
      }

      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      if (!checkRateLimit(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: '请求过于频繁，请稍候再试（本地限流保护）',
            code: 'RATE_LIMIT_EXCEEDED',
          })
        );
        return;
      }

      const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
      if (!apiKey) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: '未配置 DEEPSEEK_API_KEY。请在本地项目根目录 .env 文件中设置密钥后重试。',
            code: 'KEY_NOT_CONFIGURED',
          })
        );
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50000) {
          // 50KB payload cap
          req.destroy();
        }
      });

      req.on('end', async () => {
        try {
          let payload;
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请求体必须为合法 JSON 格式', code: 'INVALID_JSON' }));
            return;
          }

          if (!payload.customerQuery || !String(payload.customerQuery).trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'customerQuery 不能为空', code: 'INVALID_INPUT' }));
            return;
          }

          // 白名单提取并脱敏构建 Messages
          const messages = buildPromptPayload(payload);
          const activeModel = (process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL).trim();

          // DeepSeek Chat Completion Call (非思考模式，快速低成本客服回复)
          const activeBaseUrl = (process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL).replace(/\/+$/, '');
          const apiUrl = `${activeBaseUrl}/chat/completions`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

          const apiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: activeModel,
              messages,
              thinking: { type: 'disabled' }, // 官方文档明确指定非思考模式，关闭推理思考以节省延迟和成本
              max_tokens: 500, // Token 上限控制测试成本
              temperature: 0.3, // 低温生成保持事实严谨性
              stream: false,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            let parsedErr = errText;
            try {
              const j = JSON.parse(errText);
              parsedErr = j.error?.message || errText;
            } catch {}

            console.error(`DeepSeek API 响应异常 [${apiRes.status}]:`, parsedErr);

            // 针对模型名称错误或不存在给出清晰指导
            const isModelConfigError = /model/i.test(parsedErr) || apiRes.status === 404;
            const errorMsg = isModelConfigError
              ? `DeepSeek 模型配置错误 [${activeModel}]: ${parsedErr}。请检查本地 .env 中的 DEEPSEEK_MODEL（推荐使用 deepseek-flash）`
              : `DeepSeek API 调用失败: ${parsedErr}`;

            res.writeHead(apiRes.status >= 500 ? 502 : 400, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(
              JSON.stringify({
                error: errorMsg,
                code: isModelConfigError ? 'INVALID_MODEL_CONFIG' : 'UPSTREAM_API_ERROR',
                status: apiRes.status,
              })
            );
            return;
          }

          const data = await apiRes.json();
          const rawReplyText = data.choices?.[0]?.message?.content || '';
          const replyText = cleanReplyText(rawReplyText);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              replyText,
              model: data.model || activeModel,
              usage: data.usage || null,
              intent: messages.intentAnalysis?.primaryIntent || 'unclassified',
              conflictAuditReason: messages.conflictAuditReason || null,
            })
          );
        } catch (err) {
          const isTimeout = err.name === 'AbortError';
          console.error('AI Proxy 异常:', err.message);
          res.writeHead(isTimeout ? 504 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: isTimeout ? '调用 DeepSeek API 超时 (20秒)，请检查网络连接' : `服务端处理异常: ${err.message}`,
              code: isTimeout ? 'TIMEOUT' : 'INTERNAL_SERVER_ERROR',
            })
          );
        }
      });

      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
  });

  return server;
}

// 兼容直接 node server/index.js 启动
export function sanitizeContext(data) {
  // 保持旧接口兼容性，内部调用白名单提取
  return extractSafeContext({ order: data }).order || {};
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 SellerDesk AI 本地服务已启动`);
    console.log(`   - 监听地址: http://${HOST}:${PORT}`);
    console.log(`   - 目标模型: ${process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL}`);
    console.log(`   - 密钥状态: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置 DEEPSEEK_API_KEY' : '⚠️ 未检测到 DEEPSEEK_API_KEY（请配置根目录 .env 文件）'}`);
    console.log(`   - 安全防护: Origin/Host/Referer/CSRF 严格校验已就绪`);
    console.log(`========================================================\n`);
  });
}
