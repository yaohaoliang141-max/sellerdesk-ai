import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { AIEngineService } from '../src/services/aiEngine.ts';
import type { Order, Product, StorePolicies, StoreSettings } from '../src/types/index.ts';

const mockSettings: StoreSettings = {
  storeName: 'SellerDesk 测试生活馆',
  brandTone: 'professional',
  signature: '—— SellerDesk AI 客服',
  autoQuoteOrder: true,
  notifyEmail: 'service@sellerdesk.io',
  currencySymbol: '¥',
};

const mockPolicies: StorePolicies = {
  shippingRules: '本店常规现货订单在付款后 24-48 小时内完成质检打包并交接物流。',
  returnPolicy: '支持签收后 7 天无理由退换。退货运费按责任方归属办理。',
  faqList: [
    {
      id: 'faq-1',
      category: '发货时效',
      question: '下单后多久发货？',
      answer: '所有现货订单均会在 48 小时内按付款顺序完成质检并交接快递发出。',
    },
    {
      id: 'faq-invoice',
      category: '发票与开票',
      question: '支持开具发票吗？',
      answer: '支持开具正规增值税普通发票与专票，下单后在客服对话中提供开票抬头和税号即可在2个工作日内开具。',
    },
    {
      id: 'faq-guarantee',
      category: '正品保障',
      question: '是官方正品吗？有假一赔十吗？',
      answer: '本店所有商品均为品牌正规渠道一手直采直发，支持官方正品防伪查验，假一赔十。',
    },
  ],
};

const mockProduct: Product = {
  id: 'prod-001',
  sku: 'ART-DECOR-01',
  name: '复古装饰画',
  category: '家居',
  price: 168.0,
  cost: 52.0,
  stock: 40,
  description: '进口棉质微喷复古画',
  specs: '尺寸: 40x60cm; 画框: 原木色纯实木; 包含专用金属无痕挂钩',
  faqList: [
    {
      question: '画框是什么材质？',
      answer: '采用精选新西兰进口松木实木外框。',
    },
  ],
};

const mockPendingOrder: Order = {
  id: 'XY-1001',
  customerName: '李梦琪',
  customerEmail: 'limengqi@example.com',
  customerPhone: '138****6672',
  customerAddress: '上海市浦东新区张江高科科技园 8号楼',
  productId: 'prod-001',
  productName: '复古装饰画',
  quantity: 1,
  amount: 168.0,
  currency: '¥',
  orderStatus: 'paid_pending_shipment',
  createdAt: '2026-10-19 14:20:00',
  purchaseOrder: {
    id: 'CG-8001',
    supplierName: '杭州艺景工坊家居供应链',
    status: 'procured_pending_shipment',
    costAmount: 52.0,
    notes: '工厂排单检验中，预计明天可交接顺丰',
    updatedAt: '2026-10-20 09:30:00',
  },
};

const mockShippedOrder: Order = {
  id: 'XY-1002',
  customerName: '张伟',
  customerEmail: 'zhangwei@example.com',
  customerPhone: '186****9012',
  customerAddress: '北京市海淀区中关村南大街1号',
  productId: 'prod-002',
  productName: '极简降噪头戴式蓝牙耳机',
  quantity: 1,
  amount: 399.0,
  currency: '¥',
  orderStatus: 'shipped',
  createdAt: '2026-10-18 10:15:00',
  shippingCarrier: '顺丰速运',
  trackingNumber: 'SF149928172901',
};

const mockRefundOrder: Order = {
  id: 'XY-1003',
  customerName: '王舒曼',
  customerEmail: 'wangshuman@example.com',
  customerPhone: '159****3321',
  customerAddress: '浙江省杭州市西湖区文三路 252号',
  productId: 'prod-003',
  productName: '智能数显保温咖啡杯',
  quantity: 2,
  amount: 198.0,
  currency: '¥',
  orderStatus: 'refund_requested',
  createdAt: '2026-10-17 19:30:00',
  purchaseOrder: {
    id: 'CG-7988',
    supplierName: '永康市精工五金实业',
    status: 'warehouse_received',
    costAmount: 64.0,
    notes: '供应商已送达质检仓',
    updatedAt: '2026-10-17 21:00:00',
  },
};

describe('AIEngineService - 商业隐私、真实性与知识库检索测试', () => {
  test('商业隐私保护：买家可见回复绝不泄露供应商名称、采购单号、采购成本与工厂内部备注', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '你好，我的复古装饰画什么时候发货？周五前能收到吗？',
      order: mockPendingOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'logistics');
    assert.match(res.replyText, /XY-1001/);

    // 严禁向买家泄露任何供应链商业私密信息
    assert.doesNotMatch(res.replyText, /CG-8001/, '严禁在买家回复中出现采购订单号');
    assert.doesNotMatch(res.replyText, /杭州艺景工坊/, '严禁在买家回复中泄露供应商名称');
    assert.doesNotMatch(res.replyText, /52\.00|52元|采购成本/, '严禁在买家回复中泄露供货成本');
    assert.doesNotMatch(res.replyText, /工厂排单检验中/, '严禁在买家回复中透露内部工厂排单备注');

    // 合规面向买家的备货阶段说明
    assert.match(res.replyText, /备货制作与出库质检/);

    // 供应商备注中的发货时间不得当作已确认承诺，必须提示人工确认并说明理由
    assert.doesNotMatch(res.replyText, /预计明天可交接/);
    assert.doesNotMatch(res.replyText, /明天发货/);
    assert.equal(res.requiresHumanReview, true);
    assert.ok(res.reviewReasons.length > 0);
    assert.ok(res.reviewReasons.some((r) => r.includes('采购单') || r.includes('出库时间')));

    // 商家后台推理链中应保留供卖家核查判断的内部数据
    const allSteps = res.reasoningSteps.join(' ');
    assert.match(allSteps, /CG-8001/, '商家决策步骤应保留采购单号供卖家参考');
    assert.match(allSteps, /杭州艺景工坊家居供应链/, '商家决策步骤应保留供应商名称供卖家参考');
  });

  test('知识库全店 FAQ 检索：能够检索全店 FAQ 知识并精准回答开票与质保问题', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '请问购买后可以开具增值税发票吗？抬头怎么提供？',
      policies: mockPolicies,
      settings: mockSettings,
    });

    // 能够命中全店 FAQ
    assert.match(res.replyText, /增值税普通发票与专票/);
    assert.match(res.replyText, /2个工作日/);
    const steps = res.reasoningSteps.join(' ');
    assert.match(steps, /发票/);
  });

  test('多级状态细分：供应商已出库但终端未录入运单号时，说明中转揽收中并触发人工审核', () => {
    const suppShippedOrder: Order = {
      ...mockPendingOrder,
      id: 'XY-2001',
      orderStatus: 'paid_pending_shipment',
      purchaseOrder: {
        id: 'CG-9001',
        supplierName: '深圳某源头工厂',
        status: 'supplier_shipped',
        costAmount: 80,
        updatedAt: '2026-10-20 12:00:00',
      },
    };

    const res = AIEngineService.generateReply({
      customerQuery: '我的包裹发货了吗？单号多少？',
      order: suppShippedOrder,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.requiresHumanReview, true);
    assert.ok(res.reviewReasons.some((r) => r.includes('出库转运') || r.includes('尚未生成')));
    assert.match(res.replyText, /出库.*转运/);
    assert.match(res.replyText, /等待快递公司完成揽收/);
    assert.doesNotMatch(res.replyText, /深圳某源头工厂/);
    assert.doesNotMatch(res.replyText, /CG-9001/);
  });

  test('缺失物流信息：订单标记为已发货但无运单号，触发人工审核与原因说明', () => {
    const missingTrackingOrder: Order = {
      ...mockShippedOrder,
      id: 'XY-2002',
      trackingNumber: '', // 缺少运单号
    };

    const res = AIEngineService.generateReply({
      customerQuery: '为什么查不到我的物流单号？',
      order: missingTrackingOrder,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.requiresHumanReview, true);
    assert.ok(res.reviewReasons.some((r) => r.includes('缺少物流运单号')));
    assert.match(res.replyText, /正在录入同步中/);
  });

  test('售后场景隐私保护：退换货咨询中严禁暴露关联采购单信息或供货成本', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '保温杯买错颜色了，怎么办理换货？',
      order: mockRefundOrder,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'return_refund');
    assert.match(res.replyText, /7 天无理由退换/);

    // 严禁泄露五金实业供应商与采购单
    assert.doesNotMatch(res.replyText, /CG-7988/);
    assert.doesNotMatch(res.replyText, /永康市精工五金实业/);
    assert.doesNotMatch(res.replyText, /64\.00/);

    // 严禁捏造虚假退货地址或电话
    assert.doesNotMatch(res.replyText, /上海市青浦区仓储物流园/);
    assert.doesNotMatch(res.replyText, /400-800-8899/);
    assert.match(res.replyText, /人工客服审核后向您提供/);
    assert.equal(res.requiresHumanReview, true);
  });

  test('物流测试：已发货订单只提供已有单号与承运商，不编造预计送达时间', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '请问我的耳机几天能到？',
      order: mockShippedOrder,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'logistics');
    assert.match(res.replyText, /顺丰速运/);
    assert.match(res.replyText, /SF149928172901/);

    // 严禁捏造到达承诺
    assert.doesNotMatch(res.replyText, /预计明天下午送达/);
    assert.doesNotMatch(res.replyText, /2-4 天内即可送达/);
    assert.match(res.replyText, /实际运输/);
  });

  test('商品问答测试：精准命中专属知识库规格与问答', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '画框是什么材质？有挂钩吗？',
      order: mockPendingOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'product_inquiry');
    assert.match(res.replyText, /纯实木/);
    assert.match(res.replyText, /新西兰进口松木实木外框/);
    assert.match(res.replyText, /无痕挂钩/);
  });

  test('商品问答测试：知识库未收录的问题明确提示需人工核实，拒绝胡编乱造', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '这款画支持放在浴室桑拿房防水吗？',
      order: mockPendingOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'product_inquiry');
    assert.equal(res.requiresHumanReview, true);
    assert.match(res.replyText, /暂未收录确切说明/);
    assert.match(res.replyText, /需由人工客服核对/);
    assert.ok(res.reviewReasons.some((r) => r.includes('商品资料不足')));
  });
});
