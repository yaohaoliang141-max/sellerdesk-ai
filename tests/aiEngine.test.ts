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
      category: '发货',
      question: '下单后多久发货？',
      answer: '付款后 48 小时内发货。',
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
    notes: '工厂排单检验中',
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
};

describe('AIEngineService - 物流、退款与问答真实性约束测试', () => {
  test('物流测试：待发货且有关联采购单时，必须依据真实状态，不得虚构发货时间或伪造单号', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '你好，我的复古装饰画什么时候发货？',
      order: mockPendingOrder,
      product: mockProduct,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'logistics');
    assert.match(res.replyText, /XY-1001/);
    assert.match(res.replyText, /CG-8001/);
    assert.match(res.replyText, /已采购，待发货/);
    assert.match(res.replyText, /杭州艺景工坊家居供应链/);

    // 确保绝无编造的虚假承诺
    assert.doesNotMatch(res.replyText, /预计将于今天\/明天交接/);
    assert.doesNotMatch(res.replyText, /2-4 天内即可送达/);
    assert.doesNotMatch(res.replyText, /次日或隔日送达/);
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

  test('退换货测试：拒绝捏造虚假仓库地址、电话或24小时退款时限', () => {
    const res = AIEngineService.generateReply({
      customerQuery: '这个杯子买错了，怎么退货？',
      order: mockRefundOrder,
      policies: mockPolicies,
      settings: mockSettings,
    });

    assert.equal(res.intent, 'return_refund');
    // 真实读取商家设置的退换政策
    assert.match(res.replyText, /7 天无理由退换/);

    // 严禁输出任何虚构的地址与电话与时限
    assert.doesNotMatch(res.replyText, /上海市青浦区仓储物流园/);
    assert.doesNotMatch(res.replyText, /400-800-8899/);
    assert.doesNotMatch(res.replyText, /24 小时内全额原路退款/);
    assert.match(res.replyText, /人工客服审核后向您提供/);
  });

  test('商品问答测试：精准命中知识库规格与问答', () => {
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
    assert.doesNotMatch(res.replyText, /深受客户喜爱，出厂经过严格品质检验/);
  });
});
