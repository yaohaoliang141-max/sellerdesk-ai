import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

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

// 3. Sensitive Data Sanitizer (Secondary Defense on Server-Side)
export function sanitizeContext(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = { ...data };

  // Remove any supplier or internal commercial fields if mistakenly sent
  delete clean.purchaseOrder;
  delete clean.purchaseOrderId;
  delete clean.supplierName;
  delete clean.costAmount;
  delete clean.supplierNotes;
  delete clean.cost;

  // Mask or remove buyer sensitive contact details
  if (clean.customerPhone) {
    clean.customerPhone = clean.customerPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }
  if (clean.customerAddress) {
    // Keep province and city, mask detailed building/room
    clean.customerAddress = clean.customerAddress.replace(/(.{2,3}[省市区县]).*/, '$1[具体收货地址已脱敏]');
  }

  return clean;
}

// 4. Prompt Builder
export function buildPromptPayload({ customerQuery, order, product, policies, settings, conversationHistory }) {
  const safeOrder = sanitizeContext(order);
  const safeProduct = sanitizeContext(product);

  const storeName = settings?.storeName || 'SellerDesk 生活馆';
  const brandTone = settings?.brandTone || 'professional';
  const toneDesc =
    brandTone === 'friendly'
      ? '亲切、温暖、善解人意，使用礼貌温和的用词'
      : brandTone === 'concise'
      ? '精炼、高效、直奔主题，避免冗长寒暄'
      : '客观、专业、严谨、有礼貌，给客户可靠感';

  let orderContext = '无关联具体订单';
  if (safeOrder && safeOrder.id) {
    orderContext = `
- 订单编号: ${safeOrder.id}
- 商品名称: ${safeOrder.productName || '未指定'}
- 购买数量: ${safeOrder.quantity || 1}
- 销售金额: ${safeOrder.currency || '¥'}${safeOrder.amount || 0}
- 销售履约状态: ${safeOrder.orderStatus || '未知'}
- 物流承运商: ${safeOrder.shippingCarrier || '尚未录入'}
- 物流运单号: ${safeOrder.trackingNumber || '尚未生成'}`;
  }

  let productContext = '未指定特定商品规格';
  if (safeProduct && safeProduct.name) {
    productContext = `
- 商品名称: ${safeProduct.name}
- 规格参数: ${safeProduct.specs || '标准规格'}
- 商品说明: ${safeProduct.description || '暂无'}
- 专属问答: ${
      safeProduct.faqList && safeProduct.faqList.length > 0
        ? safeProduct.faqList.map((f) => `问：${f.question} 答：${f.answer}`).join('； ')
        : '无'
    }`;
  }

  let policyContext = `
- 发货政策: ${policies?.shippingRules || '订单按付款顺序依次质检发出，时效以快递实际揽收为准'}
- 售后政策: ${policies?.returnPolicy || '支持7天无理由退换货（需商品完好），退换货需先联系客服核对退货地址'}
- 全店常见问题: ${
    policies?.faqList && policies?.faqList.length > 0
      ? policies.faqList.map((f) => `问：${f.question} 答：${f.answer}`).join('； ')
      : '无'
  }`;

  const systemContent = `你是由 SellerDesk AI 驱动的【${storeName}】专业电商智能客服助理。
你的唯一职责是基于下方提供的【真实订单信息】、【商品规格】及【店铺履约政策】回答买家的提问。

【核心原则与安全边界】：
1. 事实第一：严格依据下方提供的订单状态、商品规格与全店规则作答。绝不捏造未确认的承诺、绝不虚构预计送达时间、绝不编造虚假快递单号。
2. 物流规则：如果销售订单尚无运单号，说明“商品正在供应链按期质检排单中，生成单号后将第一时间同步”，不得承诺绝对到货日期。
3. 售后规则：若买家咨询退换货，告知符合条件的政策流程，并说明具体退货地址及退款流程需经人工客服最终确认。
4. 商业隐私：绝不能编造或提及任何供应商名称、工厂、供货单号或进货成本。
5. 知识边界：遇到政策中未收录的冷门问题，明确说明“该问题已为您记录，稍后将由人工客服为您进一步核实确认”，切勿胡编乱造。
6. 回复风格：${toneDesc}。最后落款：${settings?.signature || '—— SellerDesk AI 客服'}。

【当前背景事实】：
【订单上下文】
${orderContext}

【商品知识库】
${productContext}

【店铺履约规则与政策】
${policyContext}
`;

  const messages = [{ role: 'system', content: systemContent }];

  // Append safe dialogue history (up to last 6 messages)
  if (Array.isArray(conversationHistory)) {
    const safeHistory = conversationHistory.slice(-6);
    for (const msg of safeHistory) {
      if (!msg.content) continue;
      const role = msg.sender === 'customer' ? 'user' : 'assistant';
      // Truncate long past messages to 300 chars
      const truncated = String(msg.content).slice(0, 300);
      messages.push({ role, content: truncated });
    }
  }

  // Final user query (capped at 500 chars)
  const cleanQuery = String(customerQuery).slice(0, 500);
  messages.push({ role: 'user', content: cleanQuery });

  return messages;
}

// 5. Create HTTP Server
export function createServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers for 127.0.0.1
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    // Health / Status endpoint
    if (req.method === 'GET' && parsedUrl.pathname === '/api/deepseek/status') {
      const apiKey = process.env.DEEPSEEK_API_KEY || '';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          configured: Boolean(apiKey && apiKey.trim().length > 5),
          model: DEEPSEEK_MODEL,
          baseUrl: DEEPSEEK_BASE_URL,
        })
      );
      return;
    }

    // Chat completion proxy endpoint
    if (req.method === 'POST' && parsedUrl.pathname === '/api/deepseek/chat') {
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
          const payload = JSON.parse(body || '{}');
          if (!payload.customerQuery || !String(payload.customerQuery).trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'customerQuery 不能为空', code: 'INVALID_INPUT' }));
            return;
          }

          const messages = buildPromptPayload(payload);

          // DeepSeek Chat Completion Call
          const apiUrl = `${DEEPSEEK_BASE_URL}/chat/completions`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

          const apiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages,
              max_tokens: 500, // Token cap to control costs
              temperature: 0.3, // Low temperature for high factual consistency
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
            res.writeHead(apiRes.status >= 500 ? 502 : 400, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(
              JSON.stringify({
                error: `DeepSeek API 调用失败: ${parsedErr}`,
                code: 'UPSTREAM_API_ERROR',
                status: apiRes.status,
              })
            );
            return;
          }

          const data = await apiRes.json();
          const replyText = data.choices?.[0]?.message?.content || '';

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              replyText: replyText.trim(),
              model: data.model || DEEPSEEK_MODEL,
              usage: data.usage || null,
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

// Start server when executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 SellerDesk AI 本地服务已启动`);
    console.log(`   - 监听地址: http://${HOST}:${PORT}`);
    console.log(`   - 目标模型: ${DEEPSEEK_MODEL}`);
    console.log(`   - 密钥状态: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置 DEEPSEEK_API_KEY' : '⚠️ 未检测到 DEEPSEEK_API_KEY（请配置根目录 .env 文件）'}`);
    console.log(`========================================================\n`);
  });
}
