import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntent, INTENTS } from '../server/dialogueIntent.js';
import { detectHistoricalConflict, buildSelectiveContextPrompt } from '../server/contextSelector.js';
import {
  HUMAN_STYLE_SPECIFICATION,
  FACTUAL_SAFETY_SPECIFICATION,
  FEW_SHOT_HUMAN_EXAMPLES,
  buildSystemPrompt,
} from '../server/dialoguePrompts.js';
import { cleanReplyText, buildPromptPayload, extractSafeContext } from '../server/index.js';
import { AIEngineService } from '../src/services/aiEngine.ts';
import type { Order, Product, StorePolicies, StoreSettings, Message } from '../src/types/index.ts';

// 基础 Mock 资料
const mockEarphoneProduct: Product = {
  id: 'prod-headphone',
  sku: 'HP-PRO-01',
  name: '极简主动降噪头戴式无线蓝牙耳机',
  category: '数码',
  price: 499.0,
  cost: 180.0,
  stock: 50,
  description: '支持40dB混合主动降噪，40小时长续航，蓝牙5.3高清传输',
  specs: '40dB混合降噪; 40小时长续航; 包含Type-C充电线、3.5mm音频线与说明书',
  faqList: [
    {
      question: '耳机有配收纳包吗？',
      answer: '标准装标配包含Type-C充电线与音频线，收纳包需根据活动赠送或单独加购。',
    },
    {
      question: '充满电能用多久？',
      answer: '开启降噪续航约30小时，关闭降噪续航可达40小时。',
    },
  ],
};

const mockPaintingProduct: Product = {
  id: 'prod-art-01',
  sku: 'ART-FRAME-01',
  name: '现代极简复古装饰画',
  category: '家居',
  price: 168.0,
  cost: 45.0,
  stock: 25,
  description: '进口微喷艺术画心，实木画框',
  specs: '外框尺寸: 40x60cm; 材质: 新西兰进口松木实木; 附带专用金属无痕挂钩',
  faqList: [
    {
      question: '画框是什么材质？多大尺寸？',
      answer: '采用精选新西兰进口松木纯实木外框，整体画框外径为40x60厘米。',
    },
  ],
};

const mockOrderUnshipped: Order = {
  id: 'XY-TEST-1001',
  customerName: '赵小敏',
  customerEmail: 'zhaoxiaomin@test.com',
  customerPhone: '13911112222',
  customerAddress: '北京市朝阳区酒仙桥路4号798艺术区',
  productId: 'prod-art-01',
  productName: '现代极简复古装饰画',
  quantity: 1,
  amount: 168.0,
  currency: '¥',
  orderStatus: 'paid_pending_shipment',
  createdAt: '2026-10-21 14:00:00',
  purchaseOrder: {
    id: 'CG-5566-SECRET',
    supplierName: '杭州画框源头工厂',
    status: 'supplier_shipped',
    costAmount: 45.0,
    notes: '工厂已出库大卡车发走',
    updatedAt: '2026-10-21 15:00:00',
  },
};

const mockOrderShipped: Order = {
  id: 'XY-TEST-1002',
  customerName: '孙磊',
  customerEmail: 'sunlei@test.com',
  customerPhone: '13833334444',
  customerAddress: '上海市徐汇区虹桥路1号',
  productId: 'prod-headphone',
  productName: '极简主动降噪头戴式无线蓝牙耳机',
  quantity: 1,
  amount: 499.0,
  currency: '¥',
  orderStatus: 'shipped',
  createdAt: '2026-10-20 10:00:00',
  shippingCarrier: '顺丰速运',
  trackingNumber: 'SF8899001122',
};

const mockStorePolicies: StorePolicies = {
  shippingRules: '常规现货在付款后48小时内经质检打包后发出，以快递实际揽收录入为准。',
  returnPolicy: '支持签收后7天无理由退换货（需保证商品完好不影响二次销售），退货前需核对退货信息。',
  faqList: [
    {
      id: 'faq-invoice',
      category: '发票政策',
      question: '支持开具发票吗？',
      answer: '支持开具增值税普通电子发票，确认收货后联系客服提供开票抬头即可，2个工作日内开出。',
    },
    {
      id: 'faq-genuine',
      category: '正品承诺',
      question: '是官方正品吗？',
      answer: '本店所有商品均为正规渠道一手直采，假一赔十，支持防伪查验。',
    },
  ],
};

const mockSettings: StoreSettings = {
  storeName: 'SellerDesk 闲置生活馆',
  brandTone: 'professional',
  signature: '—— SellerDesk AI 客服',
  autoQuoteOrder: true,
  notifyEmail: 'service@sellerdesk.io',
  currencySymbol: '¥',
};

describe('SellerDesk AI - 真人客服对话规则系统与 20 项质量体系测试', () => {
  // ==========================================
  // 一、核心案例专项重点验证 (Cases A ~ F)
  // ==========================================

  test('案例 A：买家询问配件（收纳包），信息切片严禁主动倾倒降噪、续航或物流信息', () => {
    const query = '这款耳机有配收纳包吗？';
    const safeContext = extractSafeContext({
      customerQuery: query,
      product: mockEarphoneProduct,
      order: mockOrderShipped,
      policies: mockStorePolicies,
    });

    const intent = analyzeIntent(query);
    assert.equal(intent.primaryIntent, INTENTS.PRODUCT_ACCESSORIES, '必须准确识别配件意图');

    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    // 必须包含配件相关内容
    assert.match(relevantFactsPrompt, /商品配件与包装信息/);
    assert.match(relevantFactsPrompt, /极简主动降噪头戴式无线蓝牙耳机/);

    // 严禁将无关的降噪分贝、续航时长、物流单号灌入模型 Prompt
    assert.doesNotMatch(relevantFactsPrompt, /40dB混合降噪/, '严禁主动倾倒未询问的40dB降噪参数');
    assert.doesNotMatch(relevantFactsPrompt, /40小时长续航/, '严禁主动倾倒未询问的续航参数');
    assert.doesNotMatch(relevantFactsPrompt, /SF8899001122/, '严禁主动倾倒未询问的物流单号');

    // 检验安全审查层：若模型幻觉输出了降噪/续航，安全检查器必须拦截预警
    const hallucinatedReply = '有的，包装里有收纳包。另外我们耳机支持40dB降噪，续航40小时，单号是SF8899001122。';
    const safetyCheck = AIEngineService.checkDeepSeekReplySafety(hallucinatedReply, {
      product: mockEarphoneProduct,
      policies: mockStorePolicies,
      query,
    });
    assert.ok(
      safetyCheck.reviewReasons.some((r) => r.includes('无关信息倾倒预警')),
      '必须正确触发无关信息倾倒预警'
    );
  });

  test('案例 B：买家只咨询物流，信息切片严禁主动倾倒商品规格参数', () => {
    const query = '你好，我的画什么时候能发出来？到哪了？';
    const safeContext = extractSafeContext({
      customerQuery: query,
      product: mockPaintingProduct,
      order: mockOrderUnshipped,
      policies: mockStorePolicies,
    });

    const intent = analyzeIntent(query);
    assert.ok(
      intent.primaryIntent === INTENTS.LOGISTICS_TRACKING || intent.primaryIntent === INTENTS.SHIPPING_TIME
    );

    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    // 必须包含物流与履约信息
    assert.match(relevantFactsPrompt, /订单履约与物流进度/);
    assert.match(relevantFactsPrompt, /XY-TEST-1001/);
    assert.match(relevantFactsPrompt, /工厂已出库，干线转运中/);

    // 严禁包含木材材质与40x60规格等商品细节
    assert.doesNotMatch(relevantFactsPrompt, /新西兰进口松木/);
    assert.doesNotMatch(relevantFactsPrompt, /40x60cm/);

    // 安全审查验证：若模型意外输出木质规格，必须报警
    const verboseReply = '您的画目前在出库转运中。顺便提醒您，画框是新西兰进口松木纯实木材质，尺寸40x60。';
    const safetyCheck = AIEngineService.checkDeepSeekReplySafety(verboseReply, {
      order: mockOrderUnshipped,
      product: mockPaintingProduct,
      policies: mockStorePolicies,
      query,
    });
    assert.ok(safetyCheck.reviewReasons.some((r) => r.includes('无关参数倾倒预警')));
  });

  test('案例 C：历史客服承诺赠送配件但知识库无依据时，必须精准识别冲突并触发人工审核', () => {
    // 模拟历史对话中客服私自承诺赠送收纳包
    const historyWithPromise: Message[] = [
      { id: '1', sender: 'customer', content: '耳机送收纳盒吗？', timestamp: '10:00' },
      { id: '2', sender: 'agent', content: '亲，这款耳机会赠送原装硬壳收纳包的。', timestamp: '10:01' },
    ];

    const currentQuery = '刚才客服说送硬壳收纳包，确定有收纳包吗？';
    const conflict = detectHistoricalConflict(
      historyWithPromise,
      mockEarphoneProduct,
      mockStorePolicies,
      currentQuery
    );

    assert.equal(conflict.hasConflict, true, '必须成功识别历史客服承诺与知识库的冲突');
    assert.equal(conflict.conflictType, 'accessory_promise_unverified');

    // 验证切片提示词中是否注入澄清指导
    const safeContext = extractSafeContext({
      customerQuery: currentQuery,
      product: mockEarphoneProduct,
      policies: mockStorePolicies,
      conversationHistory: historyWithPromise,
    });
    const intent = analyzeIntent(currentQuery, historyWithPromise);
    const { conflictInstruction, conflictAuditReason } = buildSelectiveContextPrompt(safeContext, intent);

    assert.ok(conflictInstruction, '必须包含冲突澄清指导');
    assert.match(conflictInstruction, /之前跟您说过会附收纳包，不过我还得再核对一下配件清单/);
    assert.ok(conflictAuditReason);
    assert.match(conflictAuditReason, /历史客服承诺赠送收纳包/);

    // 验证安全审核机制在接收到冲突时自动标记
    const safetyCheck = AIEngineService.checkDeepSeekReplySafety(
      '之前跟您说过会附收纳包，不过我还得再核对一下配件清单，确认好再给您准确答复。',
      {
        product: mockEarphoneProduct,
        policies: mockStorePolicies,
        conflictAuditReason,
      }
    );
    assert.equal(safetyCheck.requiresHumanReview, true);
    assert.ok(safetyCheck.reviewReasons.some((r) => r.includes('历史客服承诺赠送收纳包')));
  });

  test('案例 D：用户连续追问“那到底什么时候发？”，识别上下文追问特征，不作为孤立全新问题', () => {
    const history: Message[] = [
      { id: '1', sender: 'customer', content: '画框尺寸是多少？', timestamp: '10:00' },
      { id: '2', sender: 'agent', content: '尺寸是40x60厘米的新西兰松木实木外框。', timestamp: '10:01' },
      { id: '3', sender: 'customer', content: '好的，我已经拍下了', timestamp: '10:02' },
      { id: '4', sender: 'agent', content: '感谢支持，我们尽快为您排单。', timestamp: '10:03' },
    ];

    const followUpQuery = '那到底什么时候发？';
    const intent = analyzeIntent(followUpQuery, history);

    assert.equal(intent.isFollowUp, true, '必须标记为上下文追问');
    assert.equal(intent.primaryIntent, INTENTS.SHIPPING_TIME, '意图准确映射为发货时效');

    // 验证 Prompt 组装历史清洗：历史消息中残留的落款签名必须被剥离
    const messages = buildPromptPayload({
      customerQuery: followUpQuery,
      order: mockOrderUnshipped,
      product: mockPaintingProduct,
      policies: mockStorePolicies,
      settings: mockSettings,
      conversationHistory: [
        { sender: 'agent', content: '尺寸是40x60厘米。 —— SellerDesk AI 客服' },
      ],
    });

    const assistantMsgInPrompt = messages.find((m: any) => m.role === 'assistant');
    assert.ok(assistantMsgInPrompt);
    assert.doesNotMatch(assistantMsgInPrompt.content, /—— SellerDesk AI 客服/, '历史机器人签名必须被清洗');
  });

  test('案例 E：复合多问题咨询（既问发货时间又问退款条件），识别多意图并切片双重信息', () => {
    const multiQuery = '请问几天能发货？如果不满意怎么退款？';
    const intent = analyzeIntent(multiQuery);

    assert.equal(intent.isMultiQuestion, true, '必须识别为复合多问题咨询');
    assert.equal(intent.primaryIntent, INTENTS.MULTI_INTENT);
    assert.ok(intent.intents.includes(INTENTS.SHIPPING_TIME));
    assert.ok(intent.intents.includes(INTENTS.RETURN_REFUND));

    const safeContext = extractSafeContext({
      customerQuery: multiQuery,
      order: mockOrderUnshipped,
      policies: mockStorePolicies,
    });
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    // 必须同时装配发货与售后两条事实
    assert.match(relevantFactsPrompt, /发货与物流事实/);
    assert.match(relevantFactsPrompt, /售后政策事实/);
    assert.match(relevantFactsPrompt, /48小时内.*发出/);
    assert.match(relevantFactsPrompt, /7天无理由退换/);
  });

  test('案例 F：知识库有明确已知事实时，直奔主题回答，拒绝无意义的推诿人工', () => {
    const directQuery = '画框是什么材质？多大尺寸？';
    const intent = analyzeIntent(directQuery);
    assert.equal(intent.primaryIntent, INTENTS.PRODUCT_SPECS);

    const safeContext = extractSafeContext({
      customerQuery: directQuery,
      product: mockPaintingProduct,
      policies: mockStorePolicies,
    });
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    assert.match(relevantFactsPrompt, /新西兰进口松木/);
    assert.match(relevantFactsPrompt, /40x60/);

    // 人性化语言示范：正确回复应直接告诉材质尺寸，不附带“已为您记录转交相关部门”
    const goodReply = '外框是新西兰进口松木实木材质的，整体外径尺寸为40x60厘米。';
    const badRoboticReply = '您好！该问题已为您记录并转交相关部门核实，请耐心等待！';

    assert.match(goodReply, /新西兰进口松木/);
    assert.doesNotMatch(goodReply, /转交相关部门|为您记录/);
    assert.match(badRoboticReply, /转交相关部门/);
  });

  // ==========================================
  // 二、其他典型买家场景与规范测试 (7 ~ 20)
  // ==========================================

  test('7. 催发货场景（未录运单号）：真实说明进度，严禁编造明天到或虚假单号', () => {
    const query = '老板能快点发吗？我着急出差！';
    const intent = analyzeIntent(query);
    assert.equal(intent.primaryIntent, INTENTS.SHIPPING_TIME);

    // 安全检查器验证：如果模型承诺“保证明天上午送达”，必须被捕获
    const badReply = '好的，我保证明天上午给您送到！';
    const check = AIEngineService.checkDeepSeekReplySafety(badReply, {
      order: mockOrderUnshipped,
      policies: mockStorePolicies,
      query,
    });
    assert.ok(check.reviewReasons.some((r) => r.includes('未核实物流承诺预警')));
  });

  test('8. 已发货订单查物流：如实提供已有单号与承运商，不编造绝对送达时间', () => {
    const query = '你好，我的耳机发出去了吗？有快递单号吗？';
    const safeContext = extractSafeContext({
      customerQuery: query,
      order: mockOrderShipped,
      policies: mockStorePolicies,
    });
    const intent = analyzeIntent(query);
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    assert.match(relevantFactsPrompt, /SF8899001122/);
    assert.match(relevantFactsPrompt, /顺丰速运/);
  });

  test('9. 售后咨询：讲清7天无理由退换条件与核对流程，不假装已退款', () => {
    const query = '东西我不想要了，怎么办理退款？';
    const badReply = '款项已经为您原路全额退回到付款账户了！';
    const check = AIEngineService.checkDeepSeekReplySafety(badReply, {
      order: mockOrderShipped,
      policies: mockStorePolicies,
      query,
    });
    assert.ok(check.reviewReasons.some((r) => r.includes('未核实售后退款预警')));
  });

  test('10. 质量瑕疵报损：自然关切并提示拍照凭证，不直接擅自承诺换新免退', () => {
    const query = '收到画框角上有一处明显磕碰划痕，坏了！';
    const intent = analyzeIntent(query);
    assert.equal(intent.primaryIntent, INTENTS.AFTERSALES_QUALITY);

    const badReply = '不用寄回了，我马上为您补发一个全新的，并且全额退款！';
    const check = AIEngineService.checkDeepSeekReplySafety(badReply, {
      order: mockOrderShipped,
      policies: mockStorePolicies,
      query,
    });
    assert.ok(check.reviewReasons.some((r) => r.includes('未核实售后退款预警')));
  });

  test('11. 买家要求改收货地址：如实说明未发货可人工备注，不假装系统已自动完成更改', () => {
    const query = '师傅我地址填错了，帮我改成朝阳区望京SOHO T3';
    const intent = analyzeIntent(query);
    assert.equal(intent.primaryIntent, INTENTS.CHANGE_ORDER);

    const safeContext = extractSafeContext({
      customerQuery: query,
      order: mockOrderUnshipped,
      policies: mockStorePolicies,
    });
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);
    assert.match(relevantFactsPrompt, /订单修改规则/);
    assert.match(relevantFactsPrompt, /协助人工核实是否能修改/);
  });

  test('12. 买家反复追问：说明当前所缺核验信息，避免机械复读', () => {
    const repeatedQuery = '到底能不能发？怎么还没动静？';
    const intent = analyzeIntent(repeatedQuery, [
      { sender: 'customer', content: '什么时候发货？' },
      { sender: 'agent', content: '已经在排单打包了。' },
    ]);
    assert.equal(intent.isFollowUp, true);
  });

  test('13. 买家要求保证明天必到：客观委婉告知快递实际时效，不作虚假担保', () => {
    const guaranteeQuery = '必须明天下午3点前送到，你们能保证吗？';
    const badReply = '没问题，我们保证明天下午3点准时送到您手上！';
    const check = AIEngineService.checkDeepSeekReplySafety(badReply, {
      order: mockOrderUnshipped,
      policies: mockStorePolicies,
      query: guaranteeQuery,
    });
    assert.ok(check.reviewReasons.some((r) => r.includes('未核实物流承诺预警')));
  });

  test('14. 议价与砍价：识别库存价格意图，温和简明回答', () => {
    const bargainQuery = '老板这画100块钱能出吗？包邮不？';
    const intent = analyzeIntent(bargainQuery);
    assert.equal(intent.primaryIntent, INTENTS.STOCK_PRICE);
  });

  test('15. 现货库存询问：识别现货意图，简明回复排单质检状态', () => {
    const stockQuery = '现在拍下有现货吗？能拍就是有货吧？';
    const intent = analyzeIntent(stockQuery);
    assert.equal(intent.primaryIntent, INTENTS.STOCK_PRICE);
  });

  test('16. 发票开具咨询：精准命中全店发票政策并回答2个工作日', () => {
    const invoiceQuery = '买这个能开发票吗？开的是什么发票？';
    const safeContext = extractSafeContext({
      customerQuery: invoiceQuery,
      product: mockPaintingProduct,
      policies: mockStorePolicies,
    });
    const intent = analyzeIntent(invoiceQuery);
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    assert.match(relevantFactsPrompt, /增值税普通电子发票/);
    assert.match(relevantFactsPrompt, /2个工作日内开出/);
  });

  test('17. 正品与假一赔十政策：精准命中全店正品 FAQ', () => {
    const genuineQuery = '这个是正品吗？支持验货不？';
    const safeContext = extractSafeContext({
      customerQuery: genuineQuery,
      product: mockEarphoneProduct,
      policies: mockStorePolicies,
    });
    const intent = analyzeIntent(genuineQuery);
    const { relevantFactsPrompt } = buildSelectiveContextPrompt(safeContext, intent);

    assert.match(relevantFactsPrompt, /假一赔十/);
  });

  test('18. 知识库未收录生僻问题：诚恳说明需要核对，不瞎猜', () => {
    const unknownQuery = '这款耳机防汗防水等级是IPX几？能不能戴着游泳？';
    const intent = analyzeIntent(unknownQuery);
    assert.equal(intent.primaryIntent, INTENTS.PRODUCT_SPECS);
  });

  test('19. 买家情绪激动投诉：就事论事直接回答问题，杜绝虚情假意连环道歉', () => {
    const angryQuery = '都三天了还没发出来！你们怎么做生意的？！不要了退钱！';
    const intent = analyzeIntent(angryQuery);
    assert.ok(intent.intents.includes(INTENTS.SHIPPING_TIME) || intent.intents.includes(INTENTS.RETURN_REFUND));
  });

  test('20. 表达规范清洗器：去除首尾多余引号、回复前缀与机械落款（—— SellerDesk AI 客服）', () => {
    const rawAiReply1 = '“有的，这款包装里是有收纳包的。”';
    assert.equal(cleanReplyText(rawAiReply1), '有的，这款包装里是有收纳包的。');

    const rawAiReply2 = '回复：新西兰进口松木实木材质，尺寸40x60cm。 —— SellerDesk AI 客服';
    assert.equal(cleanReplyText(rawAiReply2), '新西兰进口松木实木材质，尺寸40x60cm。');

    const rawAiReply3 = '尊敬的客户您好，商品将在48小时内为您质检发出。-- 客服小助手';
    assert.equal(cleanReplyText(rawAiReply3), '商品将在48小时内为您质检发出。');

    const rawAiReply4 = '亲亲，已经为您打包好啦！';
    assert.equal(cleanReplyText(rawAiReply4), '已经为您打包好啦！');
  });
});
