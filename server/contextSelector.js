/**
 * SellerDesk AI - 上下文信息精选与历史冲突研判器
 * 核心职责：
 * 1. 意图驱动的信息筛选：买家问什么就只提供什么背景事实，坚决杜绝无关参数/物流倾倒
 * 2. 事实可信度与历史冲突研判：检测历史客服承诺与商家知识库的冲突，生成澄清策略
 */

import { INTENTS } from './dialogueIntent.js';

/**
 * 历史承诺与知识库冲突检测器
 * @param {Array} history 历史对话记录
 * @param {Object} product 商品白名单对象
 * @param {Object} policies 店铺政策对象
 * @param {string} currentQuery 当前买家提问
 * @returns {{ hasConflict: boolean, conflictDetails: string | null, conflictType: string | null }}
 */
export function detectHistoricalConflict(history = [], product = null, policies = null, currentQuery = '') {
  if (!Array.isArray(history) || history.length === 0) {
    return { hasConflict: false, conflictDetails: null, conflictType: null };
  }

  const queryLower = (currentQuery || '').toLowerCase();
  const pastAssistantMsgs = history.filter(
    (m) => m.role === 'assistant' || m.sender === 'agent' || m.sender === 'assistant'
  );

  // 1. 配件赠品承诺冲突检测（典型案例：历史客服答应送收纳包/赠品，但知识库未明确记载）
  const accessoryPromiseMsg = pastAssistantMsgs.find((m) =>
    /赠送.*收纳包|送.*收纳包|附带.*收纳包|会附收纳包|送.*耳机包|赠送.*保护壳|送原装/.test(m.content || '')
  );

  if (accessoryPromiseMsg) {
    // 检查商品知识库中是否确实包含该配件
    const specsText = (product?.specs || '') + (product?.description || '');
    const faqAnswers = (product?.faqList || []).map((f) => f.answer).join(' ');
    const allProductText = (specsText + ' ' + faqAnswers).toLowerCase();

    // 必须有“标配/包含/附带/赠送”收纳包的明确说明才算知识库证实
    const kbConfirmsAccessory = /(?:标配|包含|附带|内含|赠送)[^，。；;\n]*(?:收纳包|耳机包|硬壳包)/.test(allProductText);

    // 如果知识库未明确证实，且买家正在追问配件相关问题（如“确定有收纳包吗？”、“刚才说送包”）
    if (!kbConfirmsAccessory && /收纳包|耳机包|包|赠品|送|配件|确定|真的吗/.test(queryLower)) {
      return {
        hasConflict: true,
        conflictType: 'accessory_promise_unverified',
        conflictDetails:
          '历史客服曾答应买家“赠送收纳包/赠品”，但商品知识库中未明确收录该配件信息，属于缺乏验证依据的历史承诺。',
      };
    }
  }

  // 2. 发货时效绝对承诺冲突（历史客服答应“明天一定到/今天必发”，但当前订单无运单号）
  const urgentShippingPromise = pastAssistantMsgs.find((m) =>
    /明天一定到|保证今天发|今天肯定发|后天必达/.test(m.content || '')
  );
  if (urgentShippingPromise && /什么时候|今天|明天|催|发货|到哪/.test(queryLower)) {
    return {
      hasConflict: true,
      conflictType: 'shipping_promise_unverified',
      conflictDetails:
        '历史客服曾给出绝对发货或到货时间承诺，但系统履约数据尚无明确运单号证实，存在过度承诺风险。',
    };
  }

  return { hasConflict: false, conflictDetails: null, conflictType: null };
}

/**
 * 根据对话意图对上下文事实进行精准切片与信息筛选
 * @param {Object} safeContext 经过白名单提取的完整上下文
 * @param {Object} intentAnalysis 意图分析结果
 * @returns {{ relevantFactsPrompt: string, conflictInstruction: string | null, conflictAuditReason: string | null }}
 */
export function buildSelectiveContextPrompt(safeContext, intentAnalysis) {
  const { customerQuery, order, product, policies, conversationHistory } = safeContext;
  const { primaryIntent, intents, isMultiQuestion } = intentAnalysis;

  // 1. 冲突检测
  const conflict = detectHistoricalConflict(conversationHistory, product, policies, customerQuery);

  let conflictInstruction = null;
  let conflictAuditReason = null;
  if (conflict.hasConflict) {
    conflictAuditReason = `历史客服承诺赠送收纳包/配件，但商品知识库缺少可验证依据，需要人工确认。`;
    conflictInstruction = `【历史客服说法与知识库核验冲突】
注意：买家询问的内容在历史客服回复中曾有承诺（如赠送收纳包），但当前已核实的知识库中无明确记载！
处理原则：
1. 采取真人客服的自然澄清方式：“之前跟您说过会附收纳包，不过我还得再核对一下配件清单，确认好再给您准确答复”。
2. 严禁直接盲目承认“确定赠送”，也严禁武断否定“没有赠送”。
3. 态度诚恳客观，说明正在核对确认。`;
  }

  // 2. 意图驱动的信息切片
  const factsSections = [];

  // 辅助函数：提取商品配件信息（过滤掉降噪、续航等无关参数）
  const getAccessoryFacts = () => {
    if (!product || !product.name) return '商品暂未录入规格资料';
    const lines = [`- 商品名称: ${product.name}`];
    // 提取规格中与配件/包装相关的描述（过滤掉降噪、续航、材质等无关参数）
    if (product.specs) {
      const parts = product.specs.split(/[;；]/).map((s) => s.trim()).filter(Boolean);
      const accessoryParts = parts.filter((s) => /包含|包装|配件|充电线|挂钩|赠品|送|清单|标配|附带/.test(s));
      if (accessoryParts.length > 0) {
        lines.push(`- 包装清单/配件: ${accessoryParts.join('；')}`);
      }
    }
    // 筛选只与配件/包装/包含物相关的 FAQ
    const accessoryFaqs = (product.faqList || []).filter((f) =>
      /收纳包|包装|配件|充电线|挂钩|赠品|送|清单|包含/.test(f.question + f.answer)
    );
    if (accessoryFaqs.length > 0) {
      lines.push(
        `- 相关问答: ${accessoryFaqs.map((f) => `问：${f.question} 答：${f.answer}`).join('； ')}`
      );
    } else {
      lines.push(`- 专属配件记录: 知识库中暂未明确列出赠送收纳包或额外赠品`);
    }
    return lines.join('\n');
  };

  // 辅助函数：提取商品常规规格信息
  const getProductSpecFacts = () => {
    if (!product || !product.name) return '商品暂未录入规格资料';
    const lines = [`- 商品名称: ${product.name}`];
    if (product.specs) lines.push(`- 规格参数: ${product.specs}`);
    if (product.description) lines.push(`- 商品简介: ${product.description}`);
    if (product.faqList && product.faqList.length > 0) {
      lines.push(
        `- 常见规格问答: ${product.faqList.map((f) => `问：${f.question} 答：${f.answer}`).join('； ')}`
      );
    }
    return lines.join('\n');
  };

  // 辅助函数：提取发货与物流事实（不包含商品参数）
  const getLogisticsFacts = () => {
    if (!order || !order.id) {
      return `- 暂无关联订单信息\n- 全店发货标准: ${policies.shippingRules}`;
    }
    const lines = [
      `- 销售订单号: ${order.id}`,
      `- 商品名称: ${order.productName || '未指定'}`,
      `- 销售履约状态: ${order.orderStatus}`,
      `- 快递承运商: ${order.shippingCarrier || '尚未录入'}`,
      `- 快递运单号: ${order.trackingNumber || '尚未生成'}`,
      `- 履约协同阶段: ${order.fulfillmentStage}`,
      `- 发货政策规范: ${policies.shippingRules}`,
    ];
    return lines.join('\n');
  };

  // 辅助函数：提取退换货售后事实
  const getReturnPolicyFacts = () => {
    const lines = [
      `- 售后退换政策: ${policies.returnPolicy}`,
      order && order.id ? `- 关联订单状态: ${order.orderStatus}` : '- 订单状态: 咨询期',
    ];
    return lines.join('\n');
  };

  // 3. 按照意图按需装配
  if (primaryIntent === INTENTS.PRODUCT_ACCESSORIES) {
    // 案例 A：买家问收纳包/配件 -> 只提供配件信息，严禁输入降噪、续航或物流信息
    factsSections.push(`【当前问题相关事实：商品配件与包装信息】\n${getAccessoryFacts()}`);
  } else if (primaryIntent === INTENTS.LOGISTICS_TRACKING || primaryIntent === INTENTS.SHIPPING_TIME) {
    // 案例 B：买家只问发货/物流 -> 只提供订单物流与发货政策，严禁输入商品规格参数
    factsSections.push(`【当前问题相关事实：订单履约与物流进度】\n${getLogisticsFacts()}`);
  } else if (primaryIntent === INTENTS.RETURN_REFUND) {
    factsSections.push(`【当前问题相关事实：店铺售后退换货规则】\n${getReturnPolicyFacts()}`);
  } else if (primaryIntent === INTENTS.AFTERSALES_QUALITY) {
    factsSections.push(
      `【当前问题相关事实：质量售后与保障】\n${getReturnPolicyFacts()}\n- 处理准则: 遇到质量问题先安抚买家并请买家提供照片凭据，不擅自直接退款`
    );
  } else if (primaryIntent === INTENTS.CHANGE_ORDER) {
    factsSections.push(
      `【当前问题相关事实：订单修改规则】\n${getLogisticsFacts()}\n- 处理准则: 若未发货可协助人工核实是否能修改，若已打单发出则说明快递已揽收无法直接改址`
    );
  } else if (primaryIntent === INTENTS.STOCK_PRICE) {
    factsSections.push(
      `【当前问题相关事实：库存与价格】\n- 商品名称: ${product?.name || order?.productName || '本品'}\n- 标价: ¥${order?.amount || product?.price || 0}\n- 现货情况: 支持拍下即按序安排排单质检发出`
    );
  } else if (primaryIntent === INTENTS.MULTI_INTENT || isMultiQuestion) {
    // 案例 E：多问题混合咨询（例如既问发货时间又问退款条件）
    if (intents.includes(INTENTS.SHIPPING_TIME) || intents.includes(INTENTS.LOGISTICS_TRACKING)) {
      factsSections.push(`【发货与物流事实】\n${getLogisticsFacts()}`);
    }
    if (intents.includes(INTENTS.RETURN_REFUND) || intents.includes(INTENTS.AFTERSALES_QUALITY)) {
      factsSections.push(`【售后政策事实】\n${getReturnPolicyFacts()}`);
    }
    if (intents.includes(INTENTS.PRODUCT_SPECS) || intents.includes(INTENTS.PRODUCT_ACCESSORIES)) {
      factsSections.push(`【商品规格事实】\n${getProductSpecFacts()}`);
    }
    if (factsSections.length === 0) {
      factsSections.push(`【履约与政策事实】\n${getLogisticsFacts()}\n${getReturnPolicyFacts()}`);
    }
  } else {
    // 常规或商品规格咨询
    factsSections.push(`【商品基础信息】\n${getProductSpecFacts()}`);
    if (order && order.id) {
      factsSections.push(`【关联订单简况】\n- 订单: ${order.id} 状态: ${order.orderStatus}`);
    }
  }

  // 补充全店通用 FAQ（仅当与提问相关时引入）
  if (policies.faqList && policies.faqList.length > 0) {
    const qLower = customerQuery.toLowerCase();
    const matchedStoreFaqs = policies.faqList.filter((f) => {
      const text = (f.question + ' ' + f.answer + ' ' + f.category).toLowerCase();
      return (
        qLower.includes('发票') && text.includes('发票') ||
        qLower.includes('开票') && text.includes('发票') ||
        qLower.includes('正品') && text.includes('正品') ||
        qLower.includes('质保') && text.includes('质保')
      );
    });
    if (matchedStoreFaqs.length > 0) {
      factsSections.push(
        `【相关全店政策】\n${matchedStoreFaqs.map((f) => `- ${f.question}: ${f.answer}`).join('\n')}`
      );
    }
  }

  return {
    relevantFactsPrompt: factsSections.join('\n\n'),
    conflictInstruction,
    conflictAuditReason,
  };
}
