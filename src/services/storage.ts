import { Order, Product, Conversation, StorePolicies, StoreSettings } from '../types';

const STORAGE_KEYS = {
  ORDERS: 'sellerdesk_orders_v1',
  PRODUCTS: 'sellerdesk_products_v1',
  CONVERSATIONS: 'sellerdesk_conversations_v1',
  POLICIES: 'sellerdesk_policies_v1',
  SETTINGS: 'sellerdesk_settings_v1',
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'ART-DECOR-01',
    name: '复古装饰画 (Vintage Art Print)',
    category: '家居饰品',
    price: 168.0,
    cost: 52.0,
    stock: 45,
    description: '采用进口棉质油画布与环保微喷工艺，复古质感，搭配精制松木实木相框。',
    specs: '尺寸: 40x60cm; 画框: 原木色纯实木; 包含专用金属无痕挂钩及安装配件。',
    faqList: [
      { question: '画框是什么材质？', answer: '采用精选新西兰进口松木实木外框，表面经过环保清漆防潮处理。' },
      { question: '如何安装在墙上？', answer: '包装内附赠专用无痕钢钉挂钩与水平仪，敲击入墙即可悬挂，不伤墙面。' }
    ]
  },
  {
    id: 'prod-002',
    sku: 'AUDIO-ANC-02',
    name: '极简降噪头戴式蓝牙耳机',
    category: '数码配件',
    price: 399.0,
    cost: 160.0,
    stock: 28,
    description: '双重主动降噪，40小时长续航，低延迟蓝牙5.3芯片，蛋白皮透气耳罩。',
    specs: '降噪深度: -38dB; 续航: 降噪开30小时/关40小时; 重量: 220g; 接口: Type-C。',
    faqList: [
      { question: '支持佩戴眼镜使用吗？', answer: '耳罩采用慢回弹记忆海绵和超柔蛋白皮，对眼镜腿有很好缓冲，长时间佩戴不压耳。' },
      { question: '支持同时连接手机和电脑吗？', answer: '支持双设备智能连接，无缝自动切换音频流。' }
    ]
  },
  {
    id: 'prod-003',
    sku: 'CUP-THERMO-03',
    name: '智能数显保温咖啡杯 (500ml)',
    category: '生活家居',
    price: 99.0,
    cost: 32.0,
    stock: 120,
    description: '顶部高清LED轻触温显，食品级316不锈钢内胆，6小时强效保温保冷。',
    specs: '容量: 500ml; 材质: 316L医用级不锈钢内胆 + 304外壳; 防漏密封硅胶圈。',
    faqList: [
      { question: '电池可以用多久？需要充电吗？', answer: '内置低功耗高能纽扣电池，日常轻触数显可使用约1-2年，无需频繁充电。' }
    ]
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'XY-1001',
    customerName: '李梦琪',
    customerEmail: 'limengqi@example.com',
    customerPhone: '138****6672',
    customerAddress: '上海市浦东新区张江高科科技园 8号楼 302室',
    productId: 'prod-001',
    productName: '复古装饰画',
    quantity: 1,
    amount: 168.0,
    currency: '¥',
    orderStatus: 'paid_pending_shipment',
    createdAt: '2026-10-19 14:20:00',
    notes: '客户在会话中催促发货，已催促供应商优先打木架发出。',
    purchaseOrder: {
      id: 'CG-8001',
      supplierName: '杭州艺景工坊家居供应链',
      status: 'procured_pending_shipment',
      costAmount: 52.0,
      notes: '工厂排单制作完成，正在检验包装，准备今天下午交接给顺丰速运。',
      updatedAt: '2026-10-20 09:30:00'
    }
  },
  {
    id: 'XY-1002',
    customerName: '张伟',
    customerEmail: 'zhangwei.tech@example.com',
    customerPhone: '186****9012',
    customerAddress: '北京市海淀区中关村南大街1号 鼎好大厦A座15层',
    productId: 'prod-002',
    productName: '极简降噪头戴式蓝牙耳机',
    quantity: 1,
    amount: 399.0,
    currency: '¥',
    orderStatus: 'shipped',
    createdAt: '2026-10-18 10:15:00',
    shippingCarrier: '顺丰速运',
    trackingNumber: 'SF149928172901',
    purchaseOrder: {
      id: 'CG-7994',
      supplierName: '深圳声韵声学科技有限公司',
      status: 'warehouse_received',
      costAmount: 160.0,
      trackingNumber: 'SF149928172901',
      notes: '仓储质检已过，已贴单由顺丰发出。',
      updatedAt: '2026-10-18 17:40:00'
    }
  },
  {
    id: 'XY-1003',
    customerName: '王舒曼',
    customerEmail: 'wangshuman@example.com',
    customerPhone: '159****3321',
    customerAddress: '浙江省杭州市西湖区文三路 252号 云创空间',
    productId: 'prod-003',
    productName: '智能数显保温咖啡杯 (500ml)',
    quantity: 2,
    amount: 198.0,
    currency: '¥',
    orderStatus: 'refund_requested',
    createdAt: '2026-10-17 19:30:00',
    shippingCarrier: '中通快递',
    trackingNumber: 'ZT78239011928',
    notes: '客户表示颜色买错了想换磨砂黑，申请退款退货。',
    purchaseOrder: {
      id: 'CG-7988',
      supplierName: '永康市精工五金实业',
      status: 'warehouse_received',
      costAmount: 64.0,
      updatedAt: '2026-10-17 21:00:00'
    }
  },
  {
    id: 'XY-1004',
    customerName: '陈建国',
    customerEmail: 'chenjianguo@example.com',
    customerPhone: '135****8844',
    customerAddress: '广东省广州市天河区珠江新城 华夏路10号 富力中心',
    productId: 'prod-001',
    productName: '复古装饰画',
    quantity: 2,
    amount: 336.0,
    currency: '¥',
    orderStatus: 'delivered',
    createdAt: '2026-10-15 11:00:00',
    shippingCarrier: '顺丰速运',
    trackingNumber: 'SF148293817263',
    purchaseOrder: {
      id: 'CG-7950',
      supplierName: '杭州艺景工坊家居供应链',
      status: 'warehouse_received',
      costAmount: 104.0,
      notes: '已送达签收，客户已给出五星好评。',
      updatedAt: '2026-10-17 14:10:00'
    }
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    orderId: 'XY-1001',
    customerName: '李梦琪',
    customerEmail: 'limengqi@example.com',
    status: 'pending',
    lastMessage: '你好，我的复古装饰画（订单XY-1001）什么时候能发货呢？周五前能收到吗？',
    updatedAt: '2026-10-20 10:12:00',
    messages: [
      {
        id: 'msg-101',
        sender: 'customer',
        content: '你好，昨天拍下的复古装饰画（订单XY-1001）还没发出，请问什么时候发货呢？周末新家暖房急用！',
        timestamp: '2026-10-20 10:12:00'
      }
    ]
  },
  {
    id: 'conv-002',
    orderId: 'XY-1002',
    customerName: '张伟',
    customerEmail: 'zhangwei.tech@example.com',
    status: 'in_progress',
    lastMessage: '请问耳机有配套的收纳包吗？',
    updatedAt: '2026-10-19 16:45:00',
    messages: [
      {
        id: 'msg-201',
        sender: 'customer',
        content: '查到顺丰已经发出去了，想问下包装里有送硬壳收纳包吗？平时放双肩包怕压坏。',
        timestamp: '2026-10-19 16:30:00'
      },
      {
        id: 'msg-202',
        sender: 'agent',
        content: '张先生您好！这款极简降噪耳机标配附赠高品质抗压便携收纳硬包及Type-C编织音频充电线，收纳非常安全，请您放心！顺丰单号 SF149928172901 预计明天下午送达。',
        timestamp: '2026-10-19 16:45:00'
      }
    ]
  },
  {
    id: 'conv-003',
    orderId: 'XY-1003',
    customerName: '王舒曼',
    customerEmail: 'wangshuman@example.com',
    status: 'pending',
    lastMessage: '保温杯买错颜色了，怎么办理换货？',
    updatedAt: '2026-10-20 09:05:00',
    messages: [
      {
        id: 'msg-301',
        sender: 'customer',
        content: '你好，我刚收到咖啡杯，不小心选成了奶白色，我想要换成磨砂黑，还没拆封使用，请问怎么办理？',
        timestamp: '2026-10-20 09:05:00'
      }
    ]
  }
];

export const INITIAL_POLICIES: StorePolicies = {
  shippingRules: `1. 发货时效：常规现货订单在付款后 24-48 小时内完成质检打包并发出。
2. 合作快递：默认顺丰速运或中通快递，支持全国大部分地区（港澳台及海外需联系客服另补运费）。
3. 采购协同机制：部分定制或大件家居（如画框、工艺摆件）从源头供应商直发，系统关联采购订单实时跟踪发货进度，严禁编造虚假虚假单号。
4. 特殊天气与节假日：如遇暴雨台风或法定节假日，时效可能顺延 1-2 天。`,

  returnPolicy: `1. 7天无理由退换货：在商品未拆封、配件齐全、不影响二次销售的前提下，支持签收后 7 天内无理由退换。
2. 质量问题与破损：若收货时发现外包装严重破损或产品故障，请在签收 48 小时内拍照留存并联系客服，由本店全额承担往返运费并立即补发新机/新画。
3. 个人原因退换：因个人喜好、拍错颜色或规格需要退换的，买家需承担退回快递运费。
4. 退货退款流程：联系在线客服确认 -> 获取退货仓库地址与退货授权码 -> 寄出并填写回邮单号 -> 仓库收到核验无误后 24 小时内原路退款。`,

  faqList: [
    {
      id: 'faq-1',
      category: '发货与时效',
      question: '下单后多久可以发货？什么时候能到？',
      answer: '您好！我们所有正常现货订单均会在 48 小时内按付款顺序发出。江浙沪广深等核心城市通常发出后次日或隔日送达，其他地区一般 2-4 天左右送达。'
    },
    {
      id: 'faq-2',
      category: '售后退换',
      question: '商品不满意可以退货吗？怎么退？',
      answer: '支持签收后 7 天无理由退换货！只要未拆封使用且包装完好，联系我们客服即可获取退货地址，仓库签收确认后将在 24 小时内原路全额退款。'
    },
    {
      id: 'faq-3',
      category: '正品与质保',
      question: '产品是正品吗？有质保吗？',
      answer: '本店所有商品均为正规渠道一手直采，出厂均经过严格质检。数码电子类产品均提供 1 年官方联保与以换代修服务。'
    }
  ]
};

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'SellerDesk 精品生活馆 (SellerDesk Demo Store)',
  brandTone: 'professional',
  signature: '—— SellerDesk AI 客服小助手',
  autoQuoteOrder: true,
  notifyEmail: 'service@sellerdesk.io',
  currencySymbol: '¥'
};

export class StorageService {
  static getOrders(): Order[] {
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_ORDERS;
    }
  }

  static saveOrders(orders: Order[]): void {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  static getProducts(): Product[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_PRODUCTS;
    }
  }

  static saveProducts(products: Product[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  static getConversations(): Conversation[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(INITIAL_CONVERSATIONS));
      return INITIAL_CONVERSATIONS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_CONVERSATIONS;
    }
  }

  static saveConversations(convs: Conversation[]): void {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs));
  }

  static getPolicies(): StorePolicies {
    const data = localStorage.getItem(STORAGE_KEYS.POLICIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(INITIAL_POLICIES));
      return INITIAL_POLICIES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_POLICIES;
    }
  }

  static savePolicies(policies: StorePolicies): void {
    localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(policies));
  }

  static getSettings(): StoreSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(settings: StoreSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  static resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.POLICIES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
}
