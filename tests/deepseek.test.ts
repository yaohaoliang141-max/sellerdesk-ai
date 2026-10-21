import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AIEngineService } from '../src/services/aiEngine.ts';
import { sanitizeContext, buildPromptPayload, createServer } from '../server/index.js';
import type { Order, Product, StorePolicies, StoreSettings } from '../src/types/index.ts';

const mockSensitiveOrder: Order = {
  id: 'XY-TEST-888',
  customerName: '王小明',
  customerEmail: 'xiaoming@example.com',
  customerPhone: '13812345678',
  customerAddress: '上海市浦东新区张江高科技园区博云路2号',
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
    status: 'supplier_processing',
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
  test('1. 敏感数据阻断：前端与服务端对发送给 DeepSeek 的上下文严格过滤脱敏', () => {
    // A. 前端过滤
    const { sanitizedOrder, sanitizedProduct } = AIEngineService.sanitizeContextForAI(
      mockSensitiveOrder,
      mockProduct
    );

    assert.ok(sanitizedOrder);
    assert.equal(sanitizedOrder.id, 'XY-TEST-888');
    assert.equal(sanitizedOrder.purchaseOrder, undefined, '严禁向大模型发送采购单对象');
    assert.equal(sanitizedOrder.supplierName, undefined, '严禁向大模型发送供应商名称');
    assert.equal(sanitizedOrder.costAmount, undefined, '严禁向大模型发送采购成本');
    assert.equal(sanitizedOrder.customerPhone, undefined, '严禁发送买家电话');
    assert.equal(sanitizedOrder.customerAddress, undefined, '严禁发送买家详细地址');

    assert.ok(sanitizedProduct);
    assert.equal(sanitizedProduct.cost, undefined, '严禁发送商品底价成本');

    // B. 服务端双重兜底过滤
    const serverCleaned = sanitizeContext(mockSensitiveOrder);
    assert.equal(serverCleaned.purchaseOrder, undefined);
    assert.equal(serverCleaned.supplierName, undefined);
    assert.equal(serverCleaned.costAmount, undefined);
    assert.match(serverCleaned.customerPhone, /\*\*\*\*/, '手机号必须脱敏打码');

    // C. 组装 Prompt 校验
    const messages = buildPromptPayload({
      customerQuery: '什么时候发货？',
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
      conversationHistory: [],
    });

    const fullPrompt = JSON.stringify(messages);
    assert.doesNotMatch(fullPrompt, /义乌市极速画框源头工厂/, 'Prompt 绝对不能包含供应商名称');
    assert.doesNotMatch(fullPrompt, /CG-9999-SECRET/, 'Prompt 绝对不能包含采购单号');
    assert.doesNotMatch(fullPrompt, /利润空间大/, 'Prompt 绝对不能包含内部备忘');
  });

  test('2. 独立安全检查：当大模型回复包含商业隐私泄露时，必须安全阻断并自动回退安全规则回复', () => {
    const leakReply =
      '您好，您的订单已由供应商义乌市极速画框源头工厂接单制作，采购单号CG-9999-SECRET，出厂价48元，正在排产。';

    const check = AIEngineService.checkDeepSeekReplySafety(leakReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });

    assert.equal(check.isPrivacyBreached, true, '必须成功侦测到商业隐私泄露');
    assert.equal(check.requiresHumanReview, true, '必须触发人工审核');
    assert.ok(check.reviewReasons.some((r) => r.includes('商业隐私安全拦截')));
    assert.doesNotMatch(check.safeReply, /义乌市极速画框源头工厂/, '安全回退回复不得泄露供应商');
    assert.doesNotMatch(check.safeReply, /CG-9999-SECRET/, '安全回退回复不得泄露采购单');
    assert.doesNotMatch(check.safeReply, /出厂价48元/, '安全回退回复不得泄露底价');
  });

  test('3. 独立安全检查：当大模型捏造未经核实的物流时效承诺时，必须触发人工审核预警', () => {
    const hallucinatedLogisticsReply =
      '您好，您的复古装饰画正在打包，我们保证明天上午送达您手中，请保持手机畅通！';

    const check = AIEngineService.checkDeepSeekReplySafety(hallucinatedLogisticsReply, {
      order: mockSensitiveOrder, // 订单为 paid_pending_shipment 且无运单号
      product: mockProduct,
      policies: mockPolicies,
    });

    assert.equal(check.requiresHumanReview, true);
    assert.ok(check.reviewReasons.some((r) => r.includes('时效核验预警')));
  });

  test('4. 独立安全检查：当大模型回复涉及即时全额退款承诺时，必须触发人工审核预警', () => {
    const refundReply =
      '亲亲您好，已收到您的退款申请，我们已为您全额退款，款项已原路退回到您的付款账户！';

    const check = AIEngineService.checkDeepSeekReplySafety(refundReply, {
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
    });

    assert.equal(check.requiresHumanReview, true);
    assert.ok(check.reviewReasons.some((r) => r.includes('售后核验预警')));
  });

  test('5. 异常降级兜底：当本地 AI 代理服务离线或未启动时，系统自动平滑回退至确定性规则引擎', async () => {
    // Note: in unit test environment where localhost:3001 is offline or fetch is unmocked,
    // generateDeepSeekReply must gracefully catch and fall back to rule engine!
    const res = await AIEngineService.generateDeepSeekReply({
      customerQuery: '什么时候发货？',
      order: mockSensitiveOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.ok(res.replyText.length > 10, '降级后必须产生有效的安全回复文本');
    assert.equal(res.source, 'rule', '未连接大模型时必须标明降级为 rule');
    assert.ok(res.reasoningSteps.some((step) => step.includes('降级运行') || step.includes('规则引擎')));
    assert.doesNotMatch(res.replyText, /义乌市极速画框源头工厂/);
  });

  test('6. 本地代理 HTTP 服务接口：接口鉴权拦截、输入限制与状态检查校验', async () => {
    const testServer = createServer();
    const TEST_PORT = 3199;

    await new Promise<void>((resolve) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
    });

    try {
      // A. Status Check Endpoint
      const statusRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/status`);
      assert.equal(statusRes.status, 200);
      const statusJson = await statusRes.json();
      assert.equal(statusJson.status, 'ok');
      assert.ok('configured' in statusJson);

      // B. Missing Key Protection: without API Key, POST must return 400 KEY_NOT_CONFIGURED
      const originalKey = process.env.DEEPSEEK_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;

      const chatResNoKey = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuery: '你好' }),
      });
      assert.equal(chatResNoKey.status, 400);
      const chatNoKeyJson = await chatResNoKey.json();
      assert.equal(chatNoKeyJson.code, 'KEY_NOT_CONFIGURED');

      // C. Empty Query Validation
      process.env.DEEPSEEK_API_KEY = 'sk-mock-key-for-unit-test';
      const emptyQueryRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/deepseek/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuery: '' }),
      });
      assert.equal(emptyQueryRes.status, 400);
      const emptyJson = await emptyQueryRes.json();
      assert.equal(emptyJson.code, 'INVALID_INPUT');

      // Restore env
      if (originalKey) {
        process.env.DEEPSEEK_API_KEY = originalKey;
      } else {
        delete process.env.DEEPSEEK_API_KEY;
      }
    } finally {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
    }
  });
});
