/**
 * SellerDesk AI - 对话意图识别器
 * 识别买家当前咨询的核心意图与复合意图，为后续精准信息筛选与回复策略提供依据
 */

export const INTENTS = {
  PRODUCT_SPECS: 'product_specs', // 商品规格与材质
  PRODUCT_ACCESSORIES: 'product_accessories', // 配件与赠品清单
  STOCK_PRICE: 'stock_price', // 库存、现货与价格/优惠
  SHIPPING_TIME: 'shipping_time', // 发货时效与催发货
  LOGISTICS_TRACKING: 'logistics_tracking', // 物流轨迹与运单号
  RETURN_REFUND: 'return_refund', // 退货退款政策与流程
  AFTERSALES_QUALITY: 'aftersales_quality', // 售后质量问题与损坏
  CHANGE_ORDER: 'change_order', // 修改地址、规格或联系人
  MULTI_INTENT: 'multi_intent', // 多问题混合咨询
  UNCLASSIFIED: 'unclassified', // 其他或无法归类
};

/**
 * 分析买家当前输入的意图
 * @param {string} query 买家提问文本
 * @param {Array} history 会话历史
 * @returns {{ primaryIntent: string, intents: string[], isFollowUp: boolean, isMultiQuestion: boolean }}
 */
export function analyzeIntent(query, history = []) {
  if (!query || typeof query !== 'string') {
    return {
      primaryIntent: INTENTS.UNCLASSIFIED,
      intents: [INTENTS.UNCLASSIFIED],
      isFollowUp: false,
      isMultiQuestion: false,
    };
  }

  const q = query.trim().toLowerCase();
  const matchedIntents = new Set();

  // 1. 判断是否为连续上下文追问（如“那到底什么时候发？”、“确定吗？”、“那另一个颜色呢？”）
  const isFollowUp =
    /^(那|那到底|到底|然后呢|确定吗|真的吗|为啥|为什么|现在呢|多久呢|还要多久|那黑色呢|那白色呢|行不行|好不好)/.test(
      q
    ) ||
    (q.length <= 10 && history.length > 0 && /什么时候|几天|发吗|有吗|在吗|确定|怎么说/.test(q));

  // 2. 规则特征匹配
  // 配件与赠品（优先识别，避免被泛化的规格规则覆盖）
  if (/收纳包|包装盒|充电线|挂钩|赠品|送什么|带不带|送不送|有没有包|配件|全套|包装清单|附带|单机还是|包含什么/.test(q)) {
    matchedIntents.add(INTENTS.PRODUCT_ACCESSORIES);
  }

  // 商品规格与材质
  if (
    /尺寸|大小|多大|多少厘米|材质|实木|塑料|金属|参数|重量|多重|续航|电池|降噪|音质|蓝牙|防水|兼容|怎么用|怎么安装|功能|正品|保真|质保多久/.test(
      q
    )
  ) {
    matchedIntents.add(INTENTS.PRODUCT_SPECS);
  }

  // 库存与价格
  if (/有货吗|现货|还能买吗|多少钱|最低多少|便宜点|能少点吗|包邮吗|包邮不|优惠|打折|议价/.test(q)) {
    matchedIntents.add(INTENTS.STOCK_PRICE);
  }

  // 发货时效与催发货
  if (/发货|什么时候发|几天.*发|多久.*发|今天发|明天发|何时发|催发|能快点发|排单|什么时候寄|何时发货|发货了吗|发出来/.test(q)) {
    matchedIntents.add(INTENTS.SHIPPING_TIME);
  }

  // 物流跟踪与运单号
  if (/物流|运单号|单号|快递单号|查单|到哪了|在途|快递|顺丰|中通|圆通|派送|几天到|什么时候到|送到哪了/.test(q)) {
    matchedIntents.add(INTENTS.LOGISTICS_TRACKING);
  }

  // 退货退款
  if (/退货|退款|不想要了|退货地址|退款流程|七天无理由|能退吗|退钱|寄回|退运费/.test(q)) {
    matchedIntents.add(INTENTS.RETURN_REFUND);
  }

  // 售后质量问题
  if (/坏了|质量问题|破损|划痕|不能用|无法开机|开裂|少件|漏发|换货|补发|维修/.test(q)) {
    matchedIntents.add(INTENTS.AFTERSALES_QUALITY);
  }

  // 改地址或改规格
  if (/改地址|修改地址|换地址|写错地址|填错地址|地址填错|改电话|改收货人|换颜色|换规格|拍错了|能改吗|改成|改到/.test(q)) {
    matchedIntents.add(INTENTS.CHANGE_ORDER);
  }

  // 3. 判断是否为多问题复合提问
  // 特征：包含多个问号，或同时命中两个跨领域的独立意图（例如同时问发货和退款）
  // 注意：发货时间与物流追踪均属物流领域，同时出现不视为主类别割裂的复合提问
  const isBothLogistics =
    matchedIntents.size === 2 &&
    matchedIntents.has(INTENTS.SHIPPING_TIME) &&
    matchedIntents.has(INTENTS.LOGISTICS_TRACKING);

  const questionMarks = (q.match(/[？?]/g) || []).length;
  const hasMultipleClauses = /[，,；;以及还有另外并且].*(?:什么时候|多久|退|换|能不能|怎么样)/.test(q);
  const isMultiQuestion =
    !isBothLogistics &&
    ((matchedIntents.size >= 2 && (questionMarks >= 2 || hasMultipleClauses)) ||
      (matchedIntents.has(INTENTS.SHIPPING_TIME) && matchedIntents.has(INTENTS.RETURN_REFUND)) ||
      (matchedIntents.has(INTENTS.PRODUCT_SPECS) && matchedIntents.has(INTENTS.SHIPPING_TIME)) ||
      (matchedIntents.has(INTENTS.PRODUCT_SPECS) && matchedIntents.has(INTENTS.RETURN_REFUND)));

  let primaryIntent = INTENTS.UNCLASSIFIED;
  if (isMultiQuestion) {
    primaryIntent = INTENTS.MULTI_INTENT;
  } else if (matchedIntents.size > 0) {
    primaryIntent = Array.from(matchedIntents)[0];
  } else if (isFollowUp && history.length > 0) {
    // 若当前追问无明确词，继承上一轮用户提问意图
    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user' || m.sender === 'customer');
    if (lastUserMsg) {
      const prev = analyzeIntent(lastUserMsg.content);
      primaryIntent = prev.primaryIntent;
    }
  }

  return {
    primaryIntent,
    intents: Array.from(matchedIntents),
    isFollowUp,
    isMultiQuestion,
  };
}
