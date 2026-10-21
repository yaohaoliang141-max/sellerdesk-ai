import type { Order, Product, StorePolicies, StoreSettings, Message, GeneratedReplyResult } from '../types/index.ts';

export interface GenerateReplyParams {
  customerQuery: string;
  order?: Order;
  product?: Product;
  policies: StorePolicies;
  settings: StoreSettings;
  conversationHistory?: Message[];
}

export class AIEngineService {
  /**
   * Generates a strictly grounded reply suggestion for the buyer.
   *
   * BUSINESS PRIVACY & SAFETY PRINCIPLES:
   * 1. STRICT SEPARATION: "Merchant Internal Data" vs "Buyer-Facing Reply".
   * 2. NEVER leak to buyers: Supplier names, 1688 / procurement order numbers,
   *    purchase cost, profit margins, or internal supplier notes.
   * 3. Comprehensive multi-tier status evaluation (sales status + procurement status + logistics tracking).
   * 4. Full Knowledge Base retrieval (product specs, product FAQs, store-wide FAQs, policies).
   * 5. When information is incomplete, unverified, or conflicting, `requiresHumanReview = true`
   *    with explicit `reviewReasons`.
   */
  static generateReply(params: GenerateReplyParams): GeneratedReplyResult {
    const { customerQuery, order, product, policies, settings } = params;
    const query = customerQuery.trim().toLowerCase();

    const reasoningSteps: string[] = [];
    const reviewReasons: string[] = [];
    let reply = '';
    let intent: GeneratedReplyResult['intent'] = 'general';
    let confidence = 0.95;
    let requiresHumanReview = false;

    // 1. Intent Recognition
    const isLogistics = /物流|单号|发货|几天|多久|送到|快递|什么时候|在途|查单|进度|催发|出库/.test(query);
    const isReturn = /退货|退款|换货|质量问题|退换|坏了|退款流程|退钱|寄回|换一个/.test(query);
    const isProduct =
      /尺寸|材质|颜色|规格|怎么用|安装|有挂钩|质保|正品|电池|功能|收纳包|防水|防潮|参数|配件|说明|支持|适合|可以|多少厘米/.test(query) ||
      Boolean((product || order) && !isLogistics && !isReturn && query.length > 2);

    // Tone modifiers
    const isWarm = settings.brandTone === 'warm';
    const isConcise = settings.brandTone === 'concise';

    const greeting = isWarm
      ? `亲亲您好！我是${settings.storeName}的客服助手～`
      : `您好，感谢联系${settings.storeName}。`;

    const closing = isWarm
      ? `\n如需进一步协助，欢迎随时联系，祝您生活愉快！❤️\n${settings.signature}`
      : isConcise
      ? `\n${settings.signature}`
      : `\n如有其他疑问，请随时告知。\n${settings.signature}`;

    if (isLogistics || isReturn || isProduct) {
      if (isLogistics) intent = 'logistics';
      else if (isReturn) intent = 'return_refund';
      else intent = 'product_inquiry';
    }

    // Check store-wide FAQs early for general queries
    const matchedStoreFaq = policies.faqList?.find((f) => {
      const q = f.question.toLowerCase();
      const cat = f.category.toLowerCase();
      if (!q) return false;
      return (
        query.includes(q) ||
        (query.includes('开票') && (q.includes('发票') || cat.includes('发票'))) ||
        (query.includes('发票') && (q.includes('发票') || cat.includes('发票'))) ||
        (query.includes('正品') && (q.includes('正品') || cat.includes('正品'))) ||
        (query.includes('质保') && (q.includes('质保') || cat.includes('质保'))) ||
        (query.includes('假一赔') && (q.includes('正品') || cat.includes('正品')))
      );
    });

    // 2. Logic based strictly on Order, Procurement, and Knowledge Base Policies
    if (intent === 'logistics') {
      reasoningSteps.push('识别客户意图：【物流进度与发货时效咨询】');

      if (order) {
        reasoningSteps.push(`读取客户销售订单 [${order.id}] 履约状态: ${this.getOrderStatusLabel(order.orderStatus)}`);

        if (order.purchaseOrder) {
          reasoningSteps.push(
            `【商家内部供应链数据】关联采购单 [${order.purchaseOrder.id}]，供应商：${order.purchaseOrder.supplierName}，采购状态：${this.getPurchaseStatusLabel(
              order.purchaseOrder.status
            )}，采购成本：¥${order.purchaseOrder.costAmount.toFixed(2)}`
          );
          if (order.purchaseOrder.notes) {
            reasoningSteps.push(`【商家内部排期备注】${order.purchaseOrder.notes}`);
          }
          reasoningSteps.push(
            '【商业隐私脱敏保护】已脱敏：严禁向买家暴露供应商名称、采购单号、进货成本及内部备注，已转为买家合规说明'
          );
        }

        // Comprehensive status evaluation
        if (order.orderStatus === 'delivered') {
          // Conflict check: delivered but purchase still processing?
          if (order.purchaseOrder && order.purchaseOrder.status === 'supplier_processing') {
            reasoningSteps.push('【状态冲突预警】销售订单已签收，但采购单仍在供应商制单中');
            requiresHumanReview = true;
            reviewReasons.push('订单状态冲突：销售状态已签收，但关联采购单仍显示供应商制单排期中');
          }

          const tracking = order.trackingNumber ? `（运单号：${order.trackingNumber}）` : '';
          reply = `${greeting}
系统记录显示您的订单（编号：${order.id}${tracking}）已妥投签收。
请确认您是否已顺利收到包裹。如未收到或包裹存在破损，请联系人工客服协助核查派送情况。${closing}`;
        } else if (order.orderStatus === 'shipped') {
          if (order.trackingNumber) {
            reasoningSteps.push('订单已发货且有运单号：仅提供已登记承运商与单号，不编造预计送达天数');
            const carrier = order.shippingCarrier ? `【${order.shippingCarrier}】` : '快递公司';
            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
包裹已通过 ${carrier} 发出，运单号为：${order.trackingNumber}。
快件具体到达时间受快递公司实际运输轨迹与当地派送影响，系统暂无具体到货时间承诺，建议您关注运单实时物流更新。如需加急催件可联系人工客服协助跟进。${closing}`;
          } else {
            reasoningSteps.push('【物流信息缺失】销售订单显示已发货，但系统中未录入运单号');
            requiresHumanReview = true;
            reviewReasons.push('缺少物流运单号：销售订单标为已发货，但尚未录入承运商及快递单号');

            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
您的订单已进入发货运输流程，由于物流承运单号正在录入同步中，具体运单号需由人工客服为您查询确认。我们将尽快为您核对准确单号。${closing}`;
          }
        } else if (order.orderStatus === 'paid_pending_shipment') {
          if (order.purchaseOrder) {
            const pStatus = order.purchaseOrder.status;

            if (pStatus === 'supplier_shipped') {
              reasoningSteps.push(
                '【多级状态细分】供应商已出库转运，但销售订单尚未登记终端买家快递单号'
              );
              requiresHumanReview = true;
              reviewReasons.push('供货方已出库转运，但终端买家快递单号尚未生成或录入');

              reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
供货工厂已完成制作出库并交接转运，目前正在等待快递公司完成揽收并回传单号。一旦运单号生成，我们将第一时间为您同步更新。如有加急要求可联系人工客服进一步跟进。${closing}`;
            } else if (pStatus === 'warehouse_received') {
              reasoningSteps.push('【多级状态细分】中转仓/质检已收货，等待最终打包发出');
              requiresHumanReview = true;
              reviewReasons.push('商品已入中转仓质检，等待打单分配快递发出');

              reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
商品已送达仓储质检中心并完成品质检验，正在进行加固打包准备交接快递揽收。生成运单号后将第一时间为您同步。${closing}`;
            } else if (pStatus === 'supplier_processing') {
              reasoningSteps.push('【多级状态细分】供应商正在制单排产，出库时效需人工核实');
              requiresHumanReview = true;
              reviewReasons.push('采购订单处于供应商制单排期中，尚未出库');

              reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
您的订单目前处于供应链排期制单备货阶段。出库时效以实际生产进度及物流揽收为准，暂无法承诺绝对发货日期。如有紧急时效要求，建议由人工客服向工厂进一步核实跟进。${closing}`;
            } else {
              // procured_pending_shipment
              reasoningSteps.push(
                '【多级状态细分】已采购待发货：脱敏为备货质检中，供应商内部排期备注未转为实际物流揽收，不作绝对承诺，提示人工确认'
              );
              requiresHumanReview = true;
              reviewReasons.push('采购单显示已采购待发货，出库时间未经快递揽收证实，需人工跟进');

              reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
您的订单目前处于【备货制作与出库质检】阶段。
商品按工序完成质检与加固打包后，将第一时间交由快递公司发出并同步运单信息。出库时效以快递实际揽收为准，暂无法承诺绝对发货日期。如您有紧急时效要求或特殊安排，建议由人工客服为您进一步向仓库跟进核实。${closing}`;
            }
          } else {
            reasoningSteps.push('【供应链断点】订单已付款，但尚未关联供应商采购订单');
            requiresHumanReview = true;
            reviewReasons.push('销售订单已付款，尚未建立关联的采购订单');

            const policySummary = policies.shippingRules?.trim()
              ? `\n本店发货参考规则：\n${policies.shippingRules.trim()}`
              : '';

            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
目前订单处于待发货状态。${policySummary || '\n具体备货与发货排期需由人工客服为您查询确认。'}
一旦包裹打包并交接物流，我们将第一时间同步物流单号。${closing}`;
          }
        } else if (order.orderStatus === 'pending_payment') {
          reply = `${greeting}
您的订单（编号：${order.id}）目前处于待付款状态。系统将在您完成付款后自动流转进入备货与发货流程。${closing}`;
        } else {
          reasoningSteps.push(`订单状态为 [${order.orderStatus}]，如实说明当前状态`);
          reply = `${greeting}
您的订单（编号：${order.id}）当前状态为【${this.getOrderStatusLabel(order.orderStatus)}】。如有特殊进度要求，人工客服可为您具体核查。${closing}`;
        }
      } else {
        reasoningSteps.push('未选择或未关联具体订单：读取知识库通用发货规则，声明需订单号确认');
        requiresHumanReview = true;
        reviewReasons.push('未关联特定订单，无法提供个性化物流跟踪');

        // Check if store FAQ has shipping answers
        const shippingFaq = policies.faqList?.find((f) => f.category.includes('发货') || f.question.includes('发货'));
        const faqText = shippingFaq ? `\n参考常见问答：${shippingFaq.answer}\n` : '';

        const policyText = policies.shippingRules?.trim()
          ? `本店参考发货规则：\n${policies.shippingRules.trim()}\n\n`
          : '';

        reply = `${greeting}
${policyText}${faqText}如需查询特定订单的发货与运输进展，请提供您的销售订单编号（例如：XY-1001），以便核对准确的备货与物流信息。${closing}`;
      }
    } else if (intent === 'return_refund') {
      reasoningSteps.push('识别客户意图：【退换货与退款政策咨询】');
      reasoningSteps.push('真实读取商家知识库【退换货政策】，杜绝编造退货地址、电话与退款时限');

      if (order && order.purchaseOrder) {
        reasoningSteps.push(
          `【商业隐私脱敏保护】已脱敏：买家端绝不显示供货商成本 ¥${order.purchaseOrder.costAmount} 及采购单号 ${order.purchaseOrder.id}`
        );
      }

      const merchantReturnPolicy = policies.returnPolicy?.trim();
      const returnFaq = policies.faqList?.find((f) => f.category.includes('退') || f.question.includes('退'));

      if (order && order.orderStatus === 'refund_requested') {
        reasoningSteps.push('订单已处于申请退款状态：依据商家设置的政策解答，不编造未经证实的地址或时限');
        requiresHumanReview = true;
        reviewReasons.push('退货退款申请需人工客服审核退货条件，并向买家提供准确仓库地址与授权码');

        if (merchantReturnPolicy) {
          reply = `${greeting}
已查看到您的订单（编号：${order.id}）目前处于申请退换状态。
根据本店已公示的售后政策：
${merchantReturnPolicy}

【特别提醒】为保障退件顺利入库与退款审核，具体的退货收件人姓名、退货仓库地址及电话需由人工客服审核后向您提供，请暂勿自行寄出。寄出后请将回邮单号告知我们以便登记。${closing}`;
        } else {
          reasoningSteps.push('知识库中未配置退换货政策：提示需人工确认');
          reviewReasons.push('商家知识库中尚未配置退换货政策，需人工补充完善');
          reply = `${greeting}
已查看到您的订单（编号：${order.id}）提交了退换货申请。
由于具体退货地址、时效要求及退款流程需结合商品实际情况确认，人工客服将尽快为您审核并提供详细的退货指引，请稍候。${closing}`;
        }
      } else {
        reasoningSteps.push('常规退换政策咨询：如实展示商家设置的退换规则');
        if (merchantReturnPolicy) {
          const faqAddon = returnFaq ? `\n常见问答说明：${returnFaq.answer}\n` : '';
          reply = `${greeting}
关于本店退换货规定，请参考已公布的售后政策：
${merchantReturnPolicy}
${faqAddon}
如需对具体订单办理退换货，请提供您的订单编号，我们将由人工客服为您核实是否符合退换条件并出具退货地址指引。${closing}`;
        } else {
          reasoningSteps.push('知识库无退换政策：明确说明需要人工确认');
          requiresHumanReview = true;
          reviewReasons.push('未配置售后退换政策，需人工客服解答');
          reply = `${greeting}
关于退换货与退款规定，相关政策细节需由人工客服根据具体商品品类为您核实确认。请提供您的订单编号或意向商品，我们将由人工客服为您解答。${closing}`;
        }
      }
    } else if (intent === 'product_inquiry') {
      reasoningSteps.push('识别客户意图：【商品属性、材质、规格与功能咨询】');

      const targetProduct = product || (order ? { name: order.productName, specs: '', faqList: [] } : undefined);

      if (targetProduct) {
        reasoningSteps.push(`检索商品 [${targetProduct.name}] 知识库信息`);
        let hasExactMatch = false;
        let matchedFaqText = '';

        // Priority 1: Match Product-specific FAQ
        if ('faqList' in targetProduct && targetProduct.faqList && targetProduct.faqList.length > 0) {
          const match = targetProduct.faqList.find((f) => {
            const q = f.question.toLowerCase();
            return (
              query.includes(q.slice(0, 3)) ||
              (query.includes('材质') && q.includes('材质')) ||
              (query.includes('安装') && q.includes('安装')) ||
              (query.includes('挂钩') && q.includes('挂钩')) ||
              (query.includes('收纳') && q.includes('收纳')) ||
              (query.includes('电池') && q.includes('电池')) ||
              (query.includes('双设备') && q.includes('电脑'))
            );
          });

          if (match) {
            hasExactMatch = true;
            matchedFaqText = `\n【参考解答】${match.answer}`;
            reasoningSteps.push(`商品专属知识库成功命中精准问答条目：${match.question}`);
          }
        }

        // Priority 2: Match Product Specs if query is about specs
        const isQueryRelatedToSpecs = /尺寸|大小|长宽|规格|参数|属性|材质|配件|外框|挂钩|重量|接口|多少厘米/.test(query);
        const specsText =
          'specs' in targetProduct && targetProduct.specs?.trim()
            ? `\n【商品规格】${targetProduct.specs.trim()}`
            : '';

        if (specsText && isQueryRelatedToSpecs) {
          hasExactMatch = true;
          reasoningSteps.push('商品知识库成功匹配官方规格参数');
        }

        // Priority 3: Check store-wide FAQ if no product FAQ matched
        if (!hasExactMatch && matchedStoreFaq) {
          hasExactMatch = true;
          matchedFaqText = `\n【店铺通用问答 - ${matchedStoreFaq.category}】${matchedStoreFaq.answer}`;
          reasoningSteps.push(`命中全店通用知识库条目：${matchedStoreFaq.question}`);
        }

        if (hasExactMatch) {
          reply = `${greeting}
关于【${targetProduct.name}】的相关信息：${specsText}${matchedFaqText}
如需了解更多未列明的参数细节或特殊定制要求，建议由人工客服进一步为您确认。${closing}`;
        } else {
          reasoningSteps.push('知识库中未找到该商品对应问题的确切记载，明确需要人工确认，不编造功能');
          requiresHumanReview = true;
          reviewReasons.push('商品资料不足：知识库中未收录该问题的确切说明，需人工核对实物或供货商');

          reply = `${greeting}
关于【${targetProduct.name}】：
对于您所咨询的具体细节，当前商品知识库中暂未收录确切说明。为避免提供不准确信息，该问题需由人工客服核对实物或联系供货商后为您答复，请您稍候。${closing}`;
        }
      } else {
        // No product matched in order or params, check store-wide FAQ
        if (matchedStoreFaq) {
          reasoningSteps.push(`无具体关联商品，但命中全店通用问答：${matchedStoreFaq.question}`);
          reply = `${greeting}
关于您咨询的【${matchedStoreFaq.question}】：
${matchedStoreFaq.answer}
如需了解具体商品的适用情况，欢迎提供商品名称或订单号。${closing}`;
        } else {
          reasoningSteps.push('未匹配到具体商品信息，提示需人工客服协助');
          requiresHumanReview = true;
          reviewReasons.push('缺少商品匹配项：未指定具体商品或订单，知识库无法定位资料');

          reply = `${greeting}
请问您想要咨询的是哪款商品的具体规格或使用方法？您可以提供商品名称或订单号，人工客服将为您查阅准确的产品资料。${closing}`;
        }
      }
    } else {
      // General Inquiry: check store-wide FAQ first
      if (matchedStoreFaq) {
        reasoningSteps.push(`通用问答命中全店知识库 [${matchedStoreFaq.category}]：${matchedStoreFaq.question}`);
        reply = `${greeting}
关于【${matchedStoreFaq.question}】：
${matchedStoreFaq.answer}
如需进一步协助或处理具体订单，请随时告知。${closing}`;
      } else {
        reasoningSteps.push('通用问询或未匹配特定意图：生成礼貌应答，不作任何无依据承诺');
        requiresHumanReview = true;
        reviewReasons.push('未识别到明确业务意图，需人工客服接入判断');

        reply = `${greeting}
收到您的留言。请问有什么具体问题需要协助？如果是关于已有订单的疑问，请提供订单编号，人工客服将为您具体核查并处理。${closing}`;
      }
    }

    if (reviewReasons.length > 0) {
      requiresHumanReview = true;
    }

    return {
      replyText: reply.trim(),
      reasoningSteps,
      intent,
      confidence,
      requiresHumanReview,
      reviewReasons,
    };
  }

  static getOrderStatusLabel(status: Order['orderStatus']): string {
    const map: Record<Order['orderStatus'], string> = {
      pending_payment: '待付款',
      paid_pending_shipment: '已付款，待发货',
      shipped: '已发货 (运输中)',
      delivered: '已送达签收',
      refund_requested: '申请退换中',
      refunded: '已完成退款',
    };
    return map[status] || status;
  }

  static getPurchaseStatusLabel(
    status: Order['purchaseOrder'] extends undefined ? never : NonNullable<Order['purchaseOrder']>['status']
  ): string {
    const map: Record<string, string> = {
      supplier_processing: '供应商制单排期中',
      procured_pending_shipment: '已采购，待发货',
      supplier_shipped: '供应商已出库',
      warehouse_received: '中转仓/质检已收货',
    };
    return map[status] || status;
  }

  /**
   * 严格过滤发送给大模型的上下文数据，阻断供应链机密与用户私密信息泄露
   */
  static sanitizeContextForAI(order?: Order, product?: Product) {
    let sanitizedOrder: Record<string, any> | undefined = undefined;
    if (order) {
      sanitizedOrder = {
        id: order.id,
        productName: order.productName,
        quantity: order.quantity,
        amount: order.amount,
        currency: order.currency,
        orderStatus: this.getOrderStatusLabel(order.orderStatus),
        shippingCarrier: order.shippingCarrier || '未分配',
        trackingNumber: order.trackingNumber || '未生成',
        // 仅传递采购状态枚举值（由服务端转换为中立履约阶段描述）
        // 绝不能传输供应商名称、采购单号、成本或内部备注
        purchaseStatus: order.purchaseOrder?.status,
      };
      // 绝对不包含 purchaseOrder (供应商名、1688单号、成本、工厂备注)
      // 绝对不包含 customerPhone、customerAddress
    }

    let sanitizedProduct: Record<string, any> | undefined = undefined;
    if (product) {
      sanitizedProduct = {
        name: product.name,
        specs: product.specs,
        description: product.description,
        price: product.price,
        faqList: product.faqList || [],
      };
      // 绝对不包含 product.cost (进货成本)
    }

    return { sanitizedOrder, sanitizedProduct };
  }

  /**
   * 清理模型回复中残留的机械八股、外层引号或签名落款
   */
  static cleanReplyText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    let clean = text.trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith('“') && clean.endsWith('”'))) {
      clean = clean.slice(1, -1).trim();
    }
    clean = clean.replace(/^(回复|客服|店主|建议回复|卖家)[：:]\s*/i, '');
    clean = clean.replace(/\s*(——|--|——\s*|--\s*)(SellerDesk|智能|AI|店铺)?\s*(AI\s*)?客服.*$/i, '');
    clean = clean.replace(/^(尊敬的客户[，,。\s]*|亲亲[，,！!\s]*|亲爱的买家[，,。\s]*)/i, '');
    return clean.trim();
  }

  /**
   * 对大模型返回的回复进行独立安全审查（二次防御）
   * 严格区分：
   * 1. 事实安全风险 (Factual Safety Risk) - 虚假物流承诺、假单号、虚假退款完成、未核实修改成功 -> 触发安全阻断并替换为保守可用回复
   * 2. 普通表达风格建议 (Style Advisory) - 无关参数冗余、用词提示 -> 仅作提示优化，不作阻断
   */
  static checkDeepSeekReplySafety(
    replyText: string,
    context: {
      order?: Order;
      product?: Product;
      policies: StorePolicies;
      query?: string;
      history?: Message[];
      conflictAuditReason?: string | null;
    }
  ): {
    rawReply: string;
    safeReply: string;
    hasFactualRisk: boolean;
    isBlocked: boolean;
    factualRiskReasons: string[];
    styleAdvisories: string[];
    requiresHumanReview: boolean;
    reviewReasons: string[];
    reasoningSteps: string[];
    isPrivacyBreached: boolean;
  } {
    const rawReply = this.cleanReplyText(replyText);
    const reviewReasons: string[] = [];
    const factualRiskReasons: string[] = [];
    const styleAdvisories: string[] = [];
    const reasoningSteps: string[] = ['【DeepSeek 独立安全校验】开始对大模型生成内容执行事实核对与风格审查...'];

    let safeReply = rawReply;
    let requiresHumanReview = true;
    let isPrivacyBreached = false;
    let hasFactualRisk = false;
    let isBlocked = false;

    // 准则：测试阶段所有真实大模型生成回复均必须要求人工核验，严禁自动化发送或自动结单
    reviewReasons.push('【测试阶段安全确认】当前处于真实大模型测试阶段，AI 生成建议必须经人工核验后方可采纳，禁止自动发送或修改订单');
    styleAdvisories.push('当前处于真实大模型测试阶段，AI 生成建议必须经人工核验');
    reasoningSteps.push('🛡️ 测试阶段安全准则：大模型生成建议必须经人工核对把关，杜绝静默自动操作');

    const { order, query, conflictAuditReason } = context;

    // 0. 历史客服承诺与知识库冲突提示 (案例 C)
    if (conflictAuditReason) {
      reviewReasons.push(conflictAuditReason);
      factualRiskReasons.push(conflictAuditReason);
      hasFactualRisk = true;
      reasoningSteps.push(`⚠️ 历史承诺冲突警告: ${conflictAuditReason}`);
    }

    // 1. 供应链核心机密泄露审查 (商业隐私绝对红线)
    if (order?.purchaseOrder) {
      const p = order.purchaseOrder;
      const lower = rawReply.toLowerCase();
      if (p.supplierName && lower.includes(p.supplierName.toLowerCase())) {
        isPrivacyBreached = true;
        hasFactualRisk = true;
        const msg = `【商业隐私安全拦截】检测到大模型回复输出了供应商名称“${p.supplierName}”`;
        reviewReasons.push(msg);
        factualRiskReasons.push(msg);
      }
      if (p.id && rawReply.includes(p.id)) {
        isPrivacyBreached = true;
        hasFactualRisk = true;
        const msg = `【商业隐私安全拦截】检测到大模型回复输出了内部采购单号“${p.id}”`;
        reviewReasons.push(msg);
        factualRiskReasons.push(msg);
      }
      if (/1688|阿里巴巴|进货底价|出厂价|采购成本|供货商/.test(rawReply)) {
        isPrivacyBreached = true;
        hasFactualRisk = true;
        const msg = '【商业隐私安全拦截】检测到敏感供应链关键词';
        reviewReasons.push(msg);
        factualRiskReasons.push(msg);
      }
    }

    if (isPrivacyBreached) {
      reasoningSteps.push('❌ 检测到商业隐私泄露风险，大模型原始回复已被安全阻断，自动生成保守安全回复');
      isBlocked = true;
      safeReply = '您好，关于您关心的订单与发货进度，目前商品正在正常备货转运中，有新的物流动态会第一时间同步给您。';
    } else {
      reasoningSteps.push('✔ 商业隐私合规：回复未泄露供应商、内部采购单号及进货成本');
    }

    // 2. 物流事实与时效过度承诺校验 (未录入真实运单号时严禁过度承诺)
    const isOrderUnshipped = !order?.trackingNumber || order.orderStatus === 'paid_pending_shipment' || order.orderStatus === 'pending_payment';
    let unverifiedShippingRisk = false;

    if (isOrderUnshipped) {
      const unverifiedShipping = /今天(?:一定|保证|会)?发货|明天(?:一定|保证|会)?发货|24小时内(?:发货|发出)|48小时内(?:发货|发出)|立即发货|马上安排发出|已经打单发出|包裹已寄出|已为您安排发货/.test(rawReply);
      const unverifiedDelivery = /保证(?:明天|今天|后天|\d+天内).*?(?:送达|送到|到货|收到)|保证(?:明天|今天|后天|\d+天内)|明天(?:一定|准时|肯定)(?:到|送达|送到)|后天必达|预计\d+天内送达|\d+天左右收到|很快就能收到/.test(rawReply);
      const unverifiedCarrier = /(?:运单号|快递单号|单号)(?:为|是)?[:：\s]*[A-Za-z0-9]{8,}|(?:已通过|由)(?:顺丰|中通|圆通|韵达|申通|极兔|京东|邮政|EMS)发出/.test(rawReply);

      if (unverifiedShipping || unverifiedDelivery || unverifiedCarrier) {
        unverifiedShippingRisk = true;
        hasFactualRisk = true;
        const reason = '【未核实物流承诺预警】订单尚未录入终端运单号，回复中包含未证实的具体发货时效、快递单号或送达承诺，严禁以此直接回复买家';
        reviewReasons.push(reason);
        factualRiskReasons.push(reason);
        reasoningSteps.push('⚠️ 物流事实核验拦截：检测到未被系统订单证实的物流或时效承诺，已阻断原始危险回复并生成保守回复');
      }
    }

    // 3. 售后与退款承诺校验 (未经核准严禁擅自宣称退款完成或承诺免退款)
    const unverifiedRefund = /款项已(?:经)?.*?(?:退回|退还|到账)|退款已(?:经)?到账|立即为您全额退款|同意退款|为您办理全额退款|直接退款给您|退款已申请成功|无需退货直接退款/.test(rawReply);
    const unverifiedReplacement = /为您补发|马上补寄|重新寄一份|免费换新/.test(rawReply);
    const unverifiedAddress = /退货地址(?:为|是)[:：\s]*[^\n，。]+(?:路|街|区|室|栋|号)/.test(rawReply);
    let unverifiedRefundRisk = false;

    if (unverifiedRefund || unverifiedReplacement || unverifiedAddress) {
      unverifiedRefundRisk = true;
      hasFactualRisk = true;
      const reason = '【未核实售后退款预警】大模型回复中包含了即时退款、补寄或未经核实的退货地址承诺，需人工核对实际售后审批权限';
      reviewReasons.push(reason);
      factualRiskReasons.push(reason);
      reasoningSteps.push('⚠️ 售后事实核验拦截：检测到未经核实的退款或售后承诺，已阻断原始危险回复并生成保守回复');
    }

    // 4. 订单修改结果过度承诺校验 (未核验时严禁宣称已修改成功)
    const unverifiedOrderChange = /(?:已经|已)(?:帮您|为您)?(?:修改成功|改成|换成|改好|修改完毕|备注好|登记成功)|新地址已(?:生效|保存|更新)/.test(rawReply);
    let unverifiedChangeRisk = false;

    if (unverifiedOrderChange) {
      unverifiedChangeRisk = true;
      hasFactualRisk = true;
      const reason = '【未核实订单修改预警】模型宣称已完成地址/订单修改，但系统尚未完成人工核实与仓库拦截，严禁直接对买家承诺已修改完毕';
      reviewReasons.push(reason);
      factualRiskReasons.push(reason);
      reasoningSteps.push('⚠️ 订单修改核验拦截：检测到未经确认的修改成功声明，已阻断原始危险回复并生成保守回复');
    }

    // 5. 危险内容安全阻断与保守可用回复生成
    if (unverifiedShippingRisk) {
      isBlocked = true;
      safeReply = '您的订单目前处于排单备货中，运单号尚未生成，暂时无法查询实时轨迹。现货会在承诺时效内质检发出，一旦快递揽收录入单号，我第一时间同步发您。';
    } else if (unverifiedRefundRisk) {
      isBlocked = true;
      safeReply = '关于退换货与退款，本店支持签收后7天无理由退换（需保证商品完好不影响二次销售）。具体的退货核对与退款审批需由人工客服进一步办理，请暂勿自行寄出包裹。';
    } else if (unverifiedChangeRisk) {
      isBlocked = true;
      safeReply = '收到您修改订单的申请。由于订单目前尚未发货，我已先为您记录修改诉求，具体能否成功拦截修改需向仓库核实后告知您，请稍候。';
    }

    // 6. 普通表达风格问题审查 (仅作提示，不作事实安全阻断)
    if (query) {
      const qLower = query.toLowerCase();
      // 案例 A：买家只问配件/收纳包，不能主动倾倒降噪、续航或物流单号
      const isAccessoryOnly =
        /收纳包|配件|赠品|送什么/.test(qLower) && !/降噪|续航|电池|参数|物流|单号|发货/.test(qLower);
      if (isAccessoryOnly && /降噪|分贝|续航|\d+小时|运单号|快递单号/.test(rawReply)) {
        const msg = '【无关信息倾倒预警】买家仅询问配件信息，回复中输出了未询问的降噪、续航或物流信息';
        reviewReasons.push(msg);
        styleAdvisories.push('买家仅询问配件信息，建议删减未询问的降噪或续航参数');
        reasoningSteps.push('ℹ️ 风格优化提示：检测到无关参数倾倒');
      }

      // 案例 B：买家只问发货/物流，不能主动倾倒商品参数
      const isLogisticsOnly =
        /发货|发出来|出库|发走|物流|单号|催发|几天到|什么时候发|到哪了/.test(qLower) &&
        !/材质|尺寸|规格|木质|款式|功能/.test(qLower);
      if (isLogisticsOnly && /新西兰进口松木|木质|40x60|纯实木/.test(rawReply)) {
        const msg = '【无关参数倾倒预警】买家仅咨询物流发货，回复中输出了未询问的商品规格参数';
        reviewReasons.push(msg);
        styleAdvisories.push('买家仅咨询物流发货，建议删减未询问的商品规格参数');
        reasoningSteps.push('ℹ️ 风格优化提示：检测到无关规格倾倒');
      }
    }

    // 7. 超出知识库需要人工跟进
    if (/转交人工|人工客服进一步确认|稍后为您核实|记录并反馈/.test(rawReply)) {
      const msg = '【人工跟进预警】模型研判该问题超出标准知识库，提示需要人工跟进核实';
      reviewReasons.push(msg);
      styleAdvisories.push('该咨询超出标准知识库，建议人工跟进');
      reasoningSteps.push('ℹ️ 模型提示：当前咨询涉及特殊诉求，建议人工跟进');
    }

    return {
      rawReply,
      safeReply,
      hasFactualRisk,
      isBlocked,
      factualRiskReasons,
      styleAdvisories,
      requiresHumanReview: true,
      reviewReasons,
      reasoningSteps,
      isPrivacyBreached,
    };
  }

  /**
   * 检查本地 DeepSeek 代理服务状态
   */
  static async checkServerStatus(): Promise<{ online: boolean; configured: boolean; model: string }> {
    try {
      const res = await fetch('/api/deepseek/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return { online: false, configured: false, model: 'unknown' };
      }
      const data = await res.json();
      return {
        online: true,
        configured: Boolean(data.configured),
        model: data.model || 'deepseek-flash',
      };
    } catch {
      return { online: false, configured: false, model: 'offline' };
    }
  }

  /**
   * 真实 DeepSeek 模型回复生成（通过本地 Node 服务端安全代理）
   */
  static async generateDeepSeekReply(params: GenerateReplyParams): Promise<GeneratedReplyResult> {
    const { customerQuery, order, product, policies, settings, conversationHistory } = params;

    // 1. 发送前数据脱敏
    const { sanitizedOrder, sanitizedProduct } = this.sanitizeContextForAI(order, product);

    try {
      const res = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerQuery,
          order: sanitizedOrder,
          product: sanitizedProduct,
          policies,
          settings,
          conversationHistory: conversationHistory?.map((m) => ({
            sender: m.sender,
            content: m.content,
          })),
        }),
        signal: AbortSignal.timeout(22000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `服务端响应错误 [${res.status}]`);
      }

      const data = await res.json();
      const rawReply = (data.replyText || '').trim();

      // 2. 独立安全检查 (传入用户提问、会话历史与冲突研判原因)
      const safety = this.checkDeepSeekReplySafety(rawReply, {
        order,
        product,
        policies,
        query: customerQuery,
        history: conversationHistory,
        conflictAuditReason: data.conflictAuditReason,
      });

      return {
        replyText: safety.safeReply,
        rawReply: safety.rawReply,
        safeReply: safety.safeReply,
        hasFactualRisk: safety.hasFactualRisk,
        isBlocked: safety.isBlocked,
        factualRiskReasons: safety.factualRiskReasons,
        styleAdvisories: safety.styleAdvisories,
        reasoningSteps: [
          `【DeepSeek 模型推理】已成功连接本地 AI 服务，调用模型: ${data.model || 'deepseek-flash'}`,
          '【隐私脱敏保障】向大模型发送的数据已隐去供应商名称、采购单号、采购成本及客户联系方式',
          ...safety.reasoningSteps,
        ],
        intent: (data.intent as any) || 'general',
        confidence: 0.98,
        requiresHumanReview: safety.requiresHumanReview,
        reviewReasons: safety.reviewReasons,
        source: 'deepseek',
        model: data.model || 'deepseek-flash',
        usage: data.usage || null,
      };
    } catch (err: any) {
      console.warn('[DeepSeek] 调用异常，系统自动无缝降级为规则引擎:', err.message);

      // 3. 失败时无缝优雅降级为规则引擎
      const fallback = this.generateReply(params);
      return {
        ...fallback,
        reasoningSteps: [
          `⚠️ 【降级运行】未能连接本地 DeepSeek 服务（原因: ${err.message || '网络超时或未启动服务'}）`,
          '已自动平滑回退至确定性规则引擎，保证客服业务不中断。',
          ...fallback.reasoningSteps,
        ],
        source: 'rule',
      };
    }
  }
}
