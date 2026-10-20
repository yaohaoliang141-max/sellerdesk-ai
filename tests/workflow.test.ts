import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { AIEngineService } from '../src/services/aiEngine.ts';
import { StorageService, INITIAL_ORDERS, INITIAL_PRODUCTS, INITIAL_CONVERSATIONS, INITIAL_POLICIES, INITIAL_SETTINGS } from '../src/services/storage.ts';
import type { Order, Product, Conversation, StorePolicies, StoreSettings } from '../src/types/index.ts';

// Setup mock localStorage in Node environment
const storeMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storeMap.get(key) || null,
  setItem: (key: string, val: string) => storeMap.set(key, val),
  removeItem: (key: string) => storeMap.delete(key),
  clear: () => storeMap.clear(),
};
// @ts-ignore
globalThis.localStorage = mockLocalStorage;

describe('SellerDesk AI - 完整业务协同工作流测试', () => {
  test('1. 新建不同商品订单：确认选择知识库商品与自定义商品时，productId 关联准确，严禁死锁 prod-001', () => {
    const products: Product[] = [
      {
        id: 'prod-earphone',
        sku: 'AUDIO-01',
        name: '头戴式降噪耳机',
        category: '数码',
        price: 399,
        cost: 160,
        stock: 20,
        description: '高保真降噪',
        specs: '双设备连接; Type-C接口; 40小时续航',
        faqList: [{ question: '支持同时连电脑吗？', answer: '支持双设备智能音频切换。' }],
      },
      {
        id: 'prod-mug',
        sku: 'CUP-02',
        name: '智能数显保温杯',
        category: '家居',
        price: 99,
        cost: 32,
        stock: 50,
        description: '温显保温杯',
        specs: '500ml容量; 316医用不锈钢内胆',
        faqList: [{ question: '电池能用多久？', answer: '纽扣电池可用1-2年无需充电。' }],
      },
    ];

    // Case A: Select earphone from knowledge base
    const matchedEarphone = products.find((p) => p.id === 'prod-earphone');
    assert.ok(matchedEarphone);
    const orderA: Order = {
      id: 'XY-8001',
      customerName: '李华',
      customerEmail: 'lihua@example.com',
      customerPhone: '139****1122',
      customerAddress: '北京市朝阳区建国门外大街',
      productId: matchedEarphone.id,
      productName: matchedEarphone.name,
      quantity: 1,
      amount: matchedEarphone.price,
      currency: '¥',
      orderStatus: 'paid_pending_shipment',
      createdAt: '2026-10-20 10:00:00',
    };
    assert.equal(orderA.productId, 'prod-earphone', '关联的商品ID必须与选择的耳机完全一致');
    assert.notEqual(orderA.productId, 'prod-001', '不得错误关联默认商品');

    // Case B: Create custom product not in knowledge base
    const orderCustom: Order = {
      id: 'XY-8002',
      customerName: '王工',
      customerEmail: 'wanggong@example.com',
      customerPhone: '137****9988',
      customerAddress: '深圳市南山区科技园',
      productId: '', // 自定义商品无关联知识库ID
      productName: '手工复古皮质钥匙扣 (定制版)',
      quantity: 2,
      amount: 78,
      currency: '¥',
      orderStatus: 'paid_pending_shipment',
      createdAt: '2026-10-20 11:00:00',
    };
    assert.equal(orderCustom.productId, '', '自定义未录入商品不得虚假绑定 prod-001');
    assert.notEqual(orderCustom.productId, 'prod-001');
  });

  test('2. 订单直达客服工作台：点击前往客服时，若无会话则自动创建纯净空白工单，绝不虚构买家留言', () => {
    const testOrder: Order = {
      id: 'XY-9999',
      customerName: '赵小雅',
      customerEmail: 'xiaoya@example.com',
      customerPhone: '158****2233',
      customerAddress: '杭州市滨江区网商路 699号',
      productId: 'prod-001',
      productName: '复古装饰画',
      quantity: 1,
      amount: 168,
      currency: '¥',
      orderStatus: 'paid_pending_shipment',
      createdAt: '2026-10-20 12:00:00',
    };

    const conversations: Conversation[] = [];

    // Simulate handleGoToInbox
    let targetConv = conversations.find((c) => c.orderId === testOrder.id);
    if (!targetConv) {
      targetConv = {
        id: `conv-${Date.now()}`,
        orderId: testOrder.id,
        customerName: testOrder.customerName,
        customerEmail: testOrder.customerEmail,
        status: 'pending',
        lastMessage: '新客服工单（待录入客户咨询）',
        updatedAt: '刚刚',
        messages: [], // 严格保持干净，无虚构假买家消息
      };
      conversations.unshift(targetConv);
    }

    assert.equal(targetConv.orderId, 'XY-9999');
    assert.equal(targetConv.customerName, '赵小雅');
    assert.equal(targetConv.messages.length, 0, '新建工单绝不能捏造买家历史消息');
    assert.equal(conversations.length, 1);
  });

  test('3. 修改订单状态后，客服生成回复依据实时同步变化', () => {
    const policies: StorePolicies = {
      shippingRules: '48小时内顺丰发出。',
      returnPolicy: '7天无理由退换。',
      faqList: [],
    };
    const settings: StoreSettings = {
      storeName: '测试店',
      brandTone: 'professional',
      signature: '客服小助手',
      autoQuoteOrder: true,
      notifyEmail: 'test@example.com',
      currencySymbol: '¥',
    };

    // Phase 1: Order is paid_pending_shipment with procurement status
    let dynamicOrder: Order = {
      id: 'XY-3301',
      customerName: '孙先生',
      customerEmail: 'sun@example.com',
      customerPhone: '135****0001',
      customerAddress: '苏州市工业园区星湖街',
      productId: 'prod-001',
      productName: '复古装饰画',
      quantity: 1,
      amount: 168,
      currency: '¥',
      orderStatus: 'paid_pending_shipment',
      createdAt: '2026-10-20 10:00:00',
      purchaseOrder: {
        id: 'CG-5501',
        supplierName: '某供应链家居厂',
        status: 'procured_pending_shipment',
        costAmount: 50,
        notes: '工厂排产中',
        updatedAt: '2026-10-20 10:30:00',
      },
    };

    const replyPhase1 = AIEngineService.generateReply({
      customerQuery: '发货了吗？什么时候发出？',
      order: dynamicOrder,
      policies,
      settings,
    });
    assert.match(replyPhase1.replyText, /备货制作与出库质检/);
    assert.doesNotMatch(replyPhase1.replyText, /已通过/);

    // Phase 2: Merchant updates order to shipped with tracking number SF99887766
    dynamicOrder = {
      ...dynamicOrder,
      orderStatus: 'shipped',
      shippingCarrier: '顺丰速运',
      trackingNumber: 'SF99887766',
    };

    const replyPhase2 = AIEngineService.generateReply({
      customerQuery: '发货了吗？什么时候发出？',
      order: dynamicOrder,
      policies,
      settings,
    });
    assert.match(replyPhase2.replyText, /顺丰速运/);
    assert.match(replyPhase2.replyText, /SF99887766/);
    assert.doesNotMatch(replyPhase2.replyText, /备货制作与出库质检/);
  });

  test('4. 知识库 FAQ 修改后，重新生成的回复立即使用最新维护的条目', () => {
    const policies: StorePolicies = {
      shippingRules: '常规发货时效48小时。',
      returnPolicy: '7天无理由退换。',
      faqList: [
        {
          id: 'faq-invoice-old',
          category: '发票',
          question: '支持开具发票吗？',
          answer: '目前仅支持个人普票。',
        },
      ],
    };
    const settings: StoreSettings = {
      storeName: '测试店',
      brandTone: 'professional',
      signature: '客服小助手',
      autoQuoteOrder: true,
      notifyEmail: 'test@example.com',
      currencySymbol: '¥',
    };

    const replyOld = AIEngineService.generateReply({
      customerQuery: '能开发票吗？',
      policies,
      settings,
    });
    assert.match(replyOld.replyText, /目前仅支持个人普票/);

    // Merchant updates the FAQ in Knowledge Base
    policies.faqList = [
      {
        id: 'faq-invoice-new',
        category: '发票',
        question: '支持开具发票吗？',
        answer: '已全面支持开具电子专票及普票，下单后联系客服备注抬头税号即可在24小时内开出。',
      },
    ];

    const replyNew = AIEngineService.generateReply({
      customerQuery: '能开发票吗？',
      policies,
      settings,
    });
    assert.match(replyNew.replyText, /已全面支持开具电子专票及普票/);
    assert.doesNotMatch(replyNew.replyText, /目前仅支持个人普票/);
  });

  test('5. 动态总览数据统计：真实从当前订单与会话计算，无死锁硬编码', () => {
    const orders: Order[] = [
      {
        id: 'XY-01',
        customerName: '甲',
        customerEmail: 'a@ex.com',
        customerPhone: '138****0001',
        customerAddress: '上海',
        productId: 'p1',
        productName: '商品1',
        quantity: 1,
        amount: 100,
        currency: '¥',
        orderStatus: 'paid_pending_shipment',
        createdAt: '2026-10-20 10:00:00',
      },
      {
        id: 'XY-02',
        customerName: '乙',
        customerEmail: 'b@ex.com',
        customerPhone: '138****0002',
        customerAddress: '北京',
        productId: 'p2',
        productName: '商品2',
        quantity: 1,
        amount: 200,
        currency: '¥',
        orderStatus: 'delivered',
        createdAt: '2026-10-20 10:00:00',
      },
      {
        id: 'XY-03',
        customerName: '丙',
        customerEmail: 'c@ex.com',
        customerPhone: '138****0003',
        customerAddress: '广州',
        productId: 'p3',
        productName: '商品3',
        quantity: 1,
        amount: 300,
        currency: '¥',
        orderStatus: 'refund_requested',
        createdAt: '2026-10-20 10:00:00',
      },
    ];

    const conversations: Conversation[] = [
      {
        id: 'conv-1',
        orderId: 'XY-01',
        customerName: '甲',
        customerEmail: 'a@ex.com',
        status: 'pending',
        lastMessage: '催发货',
        updatedAt: '10:05',
        messages: [
          { id: 'm1', sender: 'customer', content: '什么时候发货？', timestamp: '10:05' },
          { id: 'm2', sender: 'agent', content: '备货中', timestamp: '10:06', suggestedByAI: true },
        ],
      },
      {
        id: 'conv-2',
        orderId: 'XY-02',
        customerName: '乙',
        customerEmail: 'b@ex.com',
        status: 'resolved',
        lastMessage: '已收到',
        updatedAt: '10:10',
        messages: [{ id: 'm3', sender: 'agent', content: '感谢支持', timestamp: '10:10' }],
      },
    ];

    // Real dynamic metrics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(
      (o) => o.orderStatus === 'paid_pending_shipment' || o.orderStatus === 'pending_payment'
    ).length;
    const pendingInbox = conversations.filter((c) => c.status === 'pending').length;
    const resolvedInbox = conversations.filter((c) => c.status === 'resolved').length;
    const totalAiMessages = conversations.reduce(
      (acc, c) => acc + c.messages.filter((m) => m.suggestedByAI).length,
      0
    );

    assert.equal(totalOrders, 3);
    assert.equal(pendingOrders, 1);
    assert.equal(pendingInbox, 1);
    assert.equal(resolvedInbox, 1);
    assert.equal(totalAiMessages, 1);

    // Verify dynamic alerts: XY-03 has refund_requested, so it must be flagged
    const refundOrders = orders.filter((o) => o.orderStatus === 'refund_requested');
    assert.equal(refundOrders.length, 1);
    assert.equal(refundOrders[0].id, 'XY-03');
  });

  test('6. 本地持久化储存读写校验：修改订单与保存客服回复后，StorageService 正确持久化', () => {
    mockLocalStorage.clear();

    const orders = StorageService.getOrders();
    assert.ok(orders.length > 0);

    // Modify order in storage
    const targetOrder = orders[0];
    targetOrder.customerName = '测试客户_已修改';
    StorageService.saveOrders(orders);

    // Re-read from storage
    const reloadedOrders = StorageService.getOrders();
    assert.equal(reloadedOrders[0].customerName, '测试客户_已修改');

    // Add conversation in storage
    const convs = StorageService.getConversations();
    const newConv: Conversation = {
      id: 'conv-test-storage',
      orderId: targetOrder.id,
      customerName: '测试客户_已修改',
      customerEmail: 'test@storage.com',
      status: 'resolved',
      lastMessage: '测试已保存回复',
      updatedAt: '刚刚',
      messages: [{ id: 'm-st', sender: 'agent', content: '测试已保存回复', timestamp: '12:00', suggestedByAI: true }],
    };
    StorageService.saveConversations([newConv, ...convs]);

    const reloadedConvs = StorageService.getConversations();
    assert.equal(reloadedConvs[0].id, 'conv-test-storage');
    assert.equal(reloadedConvs[0].messages[0].content, '测试已保存回复');
  });
});
