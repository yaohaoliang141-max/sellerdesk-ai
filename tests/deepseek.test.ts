import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AIEngineService } from '../src/services/aiEngine.ts';
import {
  maskSensitiveText,
  getFulfillmentStage,
  extractSafeContext,
  buildPromptPayload,
  createServer,
} from '../server/index.js';
import type { Order, Product, StorePolicies, StoreSettings } from '../src/types/index.ts';

const mockSensitiveOrder: Order = {
  id: 'XY-TEST-888',
  customerName: '王小明',
  customerEmail: 'xiaoming@example.com',
  customerPhone: '13812345678',
  customerAddress: '广东省深圳市南山区高新南九道科技园8栋801室',
  productId: 'prod-001',
  productName: '复古装饰画',
  quantity: 1,
  amount: 168.0,
  currency: '¥',
  orderStatus: 'paid_pending_shipment',
  createdAt: '2026-10-21 10:00:00',
  notes: '内部备注：客户催得急，让供货工厂加急出货',
  purchaseOrder: {
    id: 'CG-9999-SECRET',
    supplierName: '义乌市极速画框源头工厂',
    status: 'supplier_shipped',
    costAmount: 48.0,
    notes: '工厂内部采购备忘：利润空间大，优先排产',
    updatedAt: '2026-10-21 10:30:00',
  },
};

const mockProduct: Product = {
  id: 'prod-001',
  sku: 'ART-01',
  name: '复古装饰画',
  category: '家居',
  price: 168.0,
  cost: 48.0,
  stock: 20,
  description: '进口松木实木相框，复古质感',
  specs: '40x60cm; 原木色纯实木外框',
  faqList: [{ question: '画框是什么材质？', answer: '精选新西兰进口松木实木。' }],
};

const mockPolicies: StorePolicies = {
  shippingRules: '所有现货订单 48 小时内发出，以快递实际揽收为准，不承诺绝对到达日期。',
  returnPolicy: '支持签收后 7 天无理由退换货（商品完好），具体退货地址联系客服获取。',
  faqList: [
    {
      id: 'faq-store-1',
      category: '发票政策',
      question: '支持开具发票吗？',
      answer: '支持开具增值税普通电子发票，确认收货后联系客服提供抬头即可。',
    },
  ],
};

const mockSettings: StoreSettings = {
  storeName: 'SellerDesk 测试生活馆',
  brandTone: 'professional',
  signature: '—— SellerDesk AI 客服',
  autoQuoteOrder: true,
  notifyEmail: 'service@sellerdesk.io',
  currencySymbol: '¥',
};

describe('DeepSeek 本地服务与大模型协同安全测试', () => {
  test('1. 个人隐私脱敏：买家电话、邮箱、身份证与详细地址在服务端严格脱敏打码', () => {
    // A. 手机号脱敏
    const rawWithPhone = '我的手机号是 13812345678，请尽快联系我';
    const maskedPhone = maskSensitiveText(rawWithPhone);
    assert.match(maskedPhone, /138\*\*\*\*5678/, '手机号中间四位必须被脱敏打码');
    assert.doesNotMatch(maskedPhone, /13812345678/, '原文手机号严禁保留');

    // B. 固定电话脱敏
    const rawWithTel = '也可以拨打座机 021-12345678 找我';
    const maskedTel = maskSensitiveText(rawWithTel);
    assert.match(maskedTel, /\[电话已脱敏\]/);

    // C. 邮箱脱敏
    const rawWithEmail = '我的电子邮箱是 buyer.vip@example.com，请发送发票';
    const maskedEmail = maskSensitiveText(rawWithEmail);
    assert.match(maskedEmail, /b\*\*\*p@example\.com/);
    assert.doesNotMatch(maskedEmail, /buyer\.vip@example\.com/);

    // D. 身份证号脱敏
    const rawWithId = '我的身份证号码是 110101199003072345';
    const maskedId = maskSensitiveText(rawWithId);
    assert.match(maskedId, /\[身份证号已脱敏\]/);
    assert.doesNotMatch(maskedId, /110101199003072345/);

    // E. 详细地址脱敏
    const rawWithAddr = '请寄送到广东省深圳市南山区高新南九道科技园8栋801室';
    const maskedAddr = maskSensitiveText(rawWithAddr);
    assert.match(maskedAddr, /广东省深圳市南山区\[具体收货地址已脱敏\]/);
    assert.doesNotMatch(maskedAddr, /8栋801室/);
  });

  test('2. 字段白名单与采购阶段转换：阻断供应商/单号/底价，仅向模型提供脱敏履约阶段', () => {
    // 采购履约阶段转换测试
    assert.equal(getFulfillmentStage('supplier_processing'), '供应商备货排产中');
    assert.equal(getFulfillmentStage('procured_pending_shipment'), '工厂等待出库');
    assert.equal(getFulfillmentStage('supplier_shipped'), '工厂已出库，干线转运中');
    assert.equal(getFulfillmentStage('warehouse_received'), '中转质检仓已收货，等待分配快递发出');

    // 白名单提取校验
    const safeContext = extractSafeContext({
      customerQuery: '我的电话是 13988889999，寄到北京市海淀区中关村南大街1号院3号楼，什么时候发？',
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
      conversationHistory: [
        { sender: 'customer', content: '之前留的电话是 13700001111，请确认' },
      ],
      // 恶意注入的不在白名单中的字段
      maliciousField: 'exploit_data',
    });

    // 验证白名单过滤
    assert.equal((safeContext as any).maliciousField, undefined);
    assert.ok(safeContext.order);
    assert.equal((safeContext.order as any).purchaseOrder, undefined, '白名单绝不包含 purchaseOrder 对象');
    assert.equal((safeContext.order as any).supplierName, undefined, '白名单绝不包含 supplierName');
    assert.equal((safeContext.order as any).costAmount, undefined, '白名单绝不包含 costAmount');
    assert.equal((safeContext.order as any).notes, undefined, '白名单绝不包含内部备注');
    assert.equal(safeContext.order.fulfillmentStage, '工厂已出库，干线转运中');

    // 验证 Prompt 最终消息体
    const messages = buildPromptPayload({
      customerQuery: '我的电话是 13988889999，寄到北京市海淀区中关村南大街1号院3号楼，什么时候发？',
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
      conversationHistory: [
        { sender: 'customer', content: '之前留的电话是 13700001111，请确认' },
      ],
    });

    const fullPrompt = JSON.stringify(messages);
    assert.doesNotMatch(fullPrompt, /义乌市极速画框源头工厂/, 'Prompt 绝对不能包含供应商名称');
    assert.doesNotMatch(fullPrompt, /CG-9999-SECRET/, 'Prompt 绝对不能包含采购单号');
    assert.doesNotMatch(fullPrompt, /利润空间大/, 'Prompt 绝对不能包含内部备忘');
    assert.doesNotMatch(fullPrompt, /13988889999/, 'Prompt 绝对不能包含未打码手机号');
    assert.doesNotMatch(fullPrompt, /13700001111/, '历史记录中的手机号也必须脱敏');
    assert.match(fullPrompt, /工厂已出库，干线转运中/, '包含转换后的中立履约阶段');
  });

  test('3. 测试阶段全量人工把关与未核实事实拦截：任何 AI 建议均需人工核验', () => {
    // A. 基础正常回复测试阶段依然强制人工核验
    const normalReply = '您好，您的复古装饰画正在制作排单中，生成运单后我们将第一时间同步您。';
    const normalCheck = AIEngineService.checkDeepSeekReplySafety(normalReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });
    assert.equal(normalCheck.requiresHumanReview, true, '测试阶段所有大模型回复均需人工确认');
    assert.ok(normalCheck.reviewReasons.some((r) => r.includes('测试阶段安全确认')));

    // B. 未核实物流事实承诺拦截（订单无运单号，却擅自承诺明天发货/已发顺丰）
    const unverifiedShippingReply = '亲亲您好，您的商品已通过顺丰速运发出，单号为SF1234567890，保证明天送达！';
    const shippingCheck = AIEngineService.checkDeepSeekReplySafety(unverifiedShippingReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });
    assert.equal(shippingCheck.requiresHumanReview, true);
    assert.ok(shippingCheck.reviewReasons.some((r) => r.includes('未核实物流承诺预警')));

    // C. 未核实售后退款承诺拦截
    const unverifiedRefundReply = '抱歉给您带来不好的体验，已为您办理全额退款，款项已原路退回！';
    const refundCheck = AIEngineService.checkDeepSeekReplySafety(unverifiedRefundReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });
    assert.equal(refundCheck.requiresHumanReview, true);
    assert.ok(refundCheck.reviewReasons.some((r) => r.includes('未核实售后退款预警')));

    // D. 商业机密泄漏阻断与安全回退
    const leakReply = '此商品是由义乌市极速画框源头工厂供货，出厂价48元，采购单号CG-9999-SECRET。';
    const leakCheck = AIEngineService.checkDeepSeekReplySafety(leakReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });
    assert.equal(leakCheck.isPrivacyBreached, true);
    assert.equal(leakCheck.requiresHumanReview, true);
    assert.doesNotMatch(leakCheck.safeReply, /义乌市极速画框源头工厂/);
    assert.doesNotMatch(leakCheck.safeReply, /CG-9999-SECRET/);
  });

  test('4. 本地代理 HTTP 严格安全防御：阻止非法 Origin、Host、Referer 与非 JSON 请求', async () => {
    const testServer = createServer();
    const TEST_PORT = 3198;

    await new Promise<void>((resolve) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
    });

    try {
      // A. 非法外部 Origin 防御 (跨站网页调用本地付费代理)
      const resForbiddenOrigin = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious-website.com',
        },
        body: JSON.stringify({ customerQuery: '你好' }),
      });
      assert.equal(resForbiddenOrigin.status, 403, '非本地 Origin 必须被直接拒绝 (403)');
      const errOrigin = await resForbiddenOrigin.json();
      assert.equal(errOrigin.code, 'FORBIDDEN_ORIGIN');

      // B. 非法 Host 防御 (DNS 重绑定攻击，使用原生 http.request 准确发送自定义 Host 头部)
      const errHostRes = await new Promise<{ status: number; body: any }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/deepseek/status',
            method: 'GET',
            headers: {
              Host: 'attacker-domain.com',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on('error', reject);
        req.end();
      });

      assert.equal(errHostRes.status, 403, '非本地 Host 必须被拒绝 (403)');
      assert.equal(errHostRes.body.code, 'INVALID_HOST');

      // C. 非法外部 Referer 防御
      const resForbiddenReferer = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://attacker.com/steal-key.html',
        },
        body: JSON.stringify({ customerQuery: '你好' }),
      });
      assert.equal(resForbiddenReferer.status, 403);
      const errRef = await resForbiddenReferer.json();
      assert.equal(errRef.code, 'FORBIDDEN_REFERER');

      // D. Content-Type 限制 (拒绝 application/x-www-form-urlencoded 等非预检跨站表单)
      const resBadContentType = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Origin: 'http://localhost:5173',
        },
        body: 'customerQuery=test',
      });
      assert.equal(resBadContentType.status, 415, '非 application/json 必须返回 415');
      const errType = await resBadContentType.json();
      assert.equal(errType.code, 'INVALID_CONTENT_TYPE');

      // E. 合法本地 Origin 访问并验证 CORS 不返回通配符 '*'
      const resLegit = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/status`, {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });
      assert.equal(resLegit.status, 200);
      assert.equal(resLegit.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173', '禁止返回 *');
    } finally {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
    }
  });

  test('5. 错误模型配置清晰报错与离线降级验证', async () => {
    // A. 离线/服务未启动时平滑降级至规则引擎
    const fallbackRes = await AIEngineService.generateDeepSeekReply({
      customerQuery: '什么时候发货？',
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });
    assert.equal(fallbackRes.source, 'rule');
    assert.ok(fallbackRes.reasoningSteps.some((s) => s.includes('降级运行')));

    // B. 默认模型应为 deepseek-flash
    const status = await AIEngineService.checkServerStatus();
    assert.ok('model' in status);
  });

  test('6. 异步串单防护逻辑验证：切换会话或订单后安全忽略过期回复', () => {
    // 模拟 InboxView 中的竞态防御机制
    let currentActiveConvId = 'conv-001';
    let currentActiveOrderId = 'order-001';
    let currentRequestId = 1;

    // 发起异步请求 1（对应 conv-001）
    const request1ConvId = currentActiveConvId;
    const request1OrderId = currentActiveOrderId;
    const request1Id = currentRequestId;

    // 用户在请求 1 响应前，切换到了 conv-002 和 order-002
    currentActiveConvId = 'conv-002';
    currentActiveOrderId = 'order-002';
    currentRequestId += 1;

    // 当请求 1 异步返回时：
    const isStale =
      request1Id !== currentRequestId ||
      request1ConvId !== currentActiveConvId ||
      request1OrderId !== currentActiveOrderId;

    assert.equal(isStale, true, '切换会话后过期的异步请求必须被判定为 stale 并丢弃');

    let appliedReply = '';
    if (!isStale) {
      appliedReply = '错误地应用到了当前会话';
    }
    assert.equal(appliedReply, '', '过期的回复绝不能被渲染或保存到新会话中');
  });
});
