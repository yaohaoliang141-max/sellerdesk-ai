import type { Order, Product, StorePolicies, StoreSettings, Message } from '../types/index.ts';

export interface GenerateReplyParams {
  customerQuery: string;
  order?: Order;
  product?: Product;
  policies: StorePolicies;
  settings: StoreSettings;
  conversationHistory?: Message[];
}

export interface GeneratedReplyResult {
  replyText: string;
  reasoningSteps: string[];
  intent: 'logistics' | 'return_refund' | 'product_inquiry' | 'urgent_shipping' | 'general';
  confidence: number;
  requiresHumanReview: boolean;
}

export class AIEngineService {
  /**
   * Generates a strictly grounded reply suggestion for the buyer.
   *
   * BUSINESS PRIVACY & SAFETY PRINCIPLES:
   * 1. STRICT SEPARATION: "Merchant Internal Data" vs "Buyer-Facing Reply".
   * 2. NEVER leak to buyers: Supplier names, 1688 / procurement order numbers,
   *    purchase cost, profit margins, or internal supplier notes.
   * 3. Internal procurement details remain solely in `reasoningSteps` and admin panels
   *    for merchant decision-making.
   * 4. Supplier notes/schedules must NOT be treated as guaranteed promises to buyers;
   *    any unverified timeline must prompt human review (`requiresHumanReview = true`).
   * 5. NEVER invent unverified delivery days, return addresses, phone numbers, or refund time limits.
   */
  static generateReply(params: GenerateReplyParams): GeneratedReplyResult {
    const { customerQuery, order, product, policies, settings } = params;
    const query = customerQuery.trim().toLowerCase();

    const reasoningSteps: string[] = [];
    let reply = '';
    let intent: GeneratedReplyResult['intent'] = 'general';
    let confidence = 0.95;
    let requiresHumanReview = false;

    // 1. Intent Recognition
    const isLogistics = /物流|单号|发货|几天|多久|送到|快递|什么时候|在途|查单|进度|催发/.test(query);
    const isReturn = /退货|退款|换货|质量问题|退换|坏了|退款流程|退钱|寄回|换一个/.test(query);
    const isProduct =
      /尺寸|材质|颜色|规格|怎么用|安装|有挂钩|质保|正品|电池|功能|收纳包|防水|防潮|参数|配件|说明|支持|适合|可以/.test(query) ||
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

    // 2. Logic based strictly on Order, Procurement, and Knowledge Base Policies
    if (intent === 'logistics') {
      reasoningSteps.push('识别客户意图：【物流进度与发货时效咨询】');

      if (order) {
        reasoningSteps.push(`读取客户销售订单 [${order.id}] 履约状态: ${this.getOrderStatusLabel(order.orderStatus)}`);

        if (order.purchaseOrder) {
          // Merchant-internal data logged for seller review only
          reasoningSteps.push(
            `【商家内部供应链数据】关联采购单 [${order.purchaseOrder.id}]，供应商：${order.purchaseOrder.supplierName}，采购状态：${this.getPurchaseStatusLabel(
              order.purchaseOrder.status
            )}，采购成本：¥${order.purchaseOrder.costAmount.toFixed(2)}`
          );
          if (order.purchaseOrder.notes) {
            reasoningSteps.push(`【商家内部备注】${order.purchaseOrder.notes}`);
          }
          reasoningSteps.push(
            '【商业隐私脱敏保护】已脱敏：严禁向买家暴露供应商名称、采购单号、进货成本及内部备注，已转为买家合规说明'
          );
        }

        if (order.orderStatus === 'shipped') {
          reasoningSteps.push('订单已发货：仅向买家提供已登记的承运快递与运单号，不向买家编造预计到达天数');
          const carrier = order.shippingCarrier ? `【${order.shippingCarrier}】` : '快递公司';
          const tracking = order.trackingNumber ? `运单号为：${order.trackingNumber}` : '运单号正在同步中';

          reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
包裹已通过 ${carrier} 发出，${tracking}。
快件具体到达时间受快递公司实际运输轨迹与当地派送影响，系统暂无具体到货时间承诺，建议您关注运单实时物流更新。如需加急催件可联系人工客服协助跟进。${closing}`;
        } else if (order.orderStatus === 'paid_pending_shipment') {
          if (order.purchaseOrder) {
            reasoningSteps.push(
              '订单待发货且有关联采购单：提示备货质检中，供应商内部排期备注未转为实际物流揽收，不作绝对承诺，提示人工确认'
            );

            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
您的订单目前处于【备货制作与出库质检】阶段。
商品按工序完成质检与加固打包后，将第一时间交由快递公司发出并同步运单信息。出库时效以快递实际揽收为准，暂无法承诺绝对发货日期。如您有紧急时效要求或特殊安排，建议由人工客服为您进一步向仓库跟进核实。${closing}`;
            requiresHumanReview = true;
          } else {
            reasoningSteps.push('订单待发货且未关联采购单：读取知识库发货规则，脱敏说明待发货');
            const policySummary = policies.shippingRules?.trim()
              ? `\n本店发货参考规则：\n${policies.shippingRules.trim()}`
              : '';

            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
目前订单处于待发货状态。${policySummary || '\n具体备货与发货排期需由人工客服为您查询确认。'}
一旦包裹打包并交接物流，我们将第一时间同步物流单号。${closing}`;
            if (!policies.shippingRules?.trim()) {
              requiresHumanReview = true;
            }
          }
        } else if (order.orderStatus === 'delivered') {
          reasoningSteps.push('订单已送达：依据系统妥投状态回复，不捏造配送过程');
          const tracking = order.trackingNumber ? `（运单号：${order.trackingNumber}）` : '';
          reply = `${greeting}
系统记录显示您的订单（编号：${order.id}${tracking}）已妥投签收。
请确认您是否已顺利收到包裹。如未收到或包裹存在破损，请联系人工客服协助核查派送情况。${closing}`;
        } else {
          reasoningSteps.push(`订单状态为 [${order.orderStatus}]，如实说明当前状态`);
          reply = `${greeting}
您的订单（编号：${order.id}）当前状态为【${this.getOrderStatusLabel(order.orderStatus)}】。如有特殊进度要求，人工客服可为您具体核查。${closing}`;
        }
      } else {
        reasoningSteps.push('未选择或未关联具体订单：读取知识库通用发货规则，声明需订单号确认');
        const policyText = policies.shippingRules?.trim()
          ? `本店参考发货规则：\n${policies.shippingRules.trim()}\n\n`
          : '';

        reply = `${greeting}
${policyText}如需查询特定订单的发货与运输进展，请提供您的销售订单编号（例如：XY-1001），以便核对准确的备货与物流信息。${closing}`;
        requiresHumanReview = true;
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

      if (order && order.orderStatus === 'refund_requested') {
        reasoningSteps.push('订单已处于申请退款状态：依据商家设置的政策解答，不编造未经证实的地址或时限');

        if (merchantReturnPolicy) {
          reply = `${greeting}
已查看到您的订单（编号：${order.id}）目前处于申请退换状态。
根据本店已公示的售后政策：
${merchantReturnPolicy}

【特别提醒】为保障退件顺利入库与退款审核，具体的退货收件人姓名、退货仓库地址及电话需由人工客服审核后向您提供，请暂勿自行寄出。寄出后请将回邮单号告知我们以便登记。${closing}`;
        } else {
          reasoningSteps.push('知识库中未配置退换货政策：提示需人工确认');
          reply = `${greeting}
已查看到您的订单（编号：${order.id}）提交了退换货申请。
由于具体退货地址、时效要求及退款流程需结合商品实际情况确认，人工客服将尽快为您审核并提供详细的退货指引，请稍候。${closing}`;
          requiresHumanReview = true;
        }
      } else {
        reasoningSteps.push('常规退换政策咨询：如实展示商家设置的退换规则');
        if (merchantReturnPolicy) {
          reply = `${greeting}
关于本店退换货规定，请参考已公布的售后政策：
${merchantReturnPolicy}

如需对具体订单办理退换货，请提供您的订单编号，我们将由人工客服为您核实是否符合退换条件并出具退货地址指引。${closing}`;
        } else {
          reasoningSteps.push('知识库无退换政策：明确说明需要人工确认');
          reply = `${greeting}
关于退换货与退款规定，相关政策细节需由人工客服根据具体商品品类为您核实确认。请提供您的订单编号或意向商品，我们将由人工客服为您解答。${closing}`;
          requiresHumanReview = true;
        }
      }
    } else if (intent === 'product_inquiry') {
      reasoningSteps.push('识别客户意图：【商品属性、材质、规格与功能咨询】');

      const targetProduct = product || (order ? { name: order.productName, specs: '', faqList: [] } : undefined);

      if (targetProduct) {
        reasoningSteps.push(`检索商品 [${targetProduct.name}] 知识库信息`);
        let hasExactMatch = false;
        let matchedFaqText = '';

        // Match FAQ
        if ('faqList' in targetProduct && targetProduct.faqList && targetProduct.faqList.length > 0) {
          const match = targetProduct.faqList.find(f => {
            const q = f.question.toLowerCase();
            return query.includes(q.slice(0, 3)) ||
              (query.includes('材质') && q.includes('材质')) ||
              (query.includes('安装') && q.includes('安装')) ||
              (query.includes('挂钩') && q.includes('挂钩')) ||
              (query.includes('收纳') && q.includes('收纳')) ||
              (query.includes('电池') && q.includes('电池')) ||
              (query.includes('双设备') && q.includes('电脑'));
          });

          if (match) {
            hasExactMatch = true;
            matchedFaqText = `\n【参考解答】${match.answer}`;
            reasoningSteps.push(`知识库成功命中精准问答条目：${match.question}`);
          }
        }

        const isQueryRelatedToSpecs = /尺寸|大小|长宽|规格|参数|属性|材质|配件|外框|挂钩|重量|接口|多少厘米/.test(query);
        const specsText = ('specs' in targetProduct && targetProduct.specs?.trim())
          ? `\n【商品规格】${targetProduct.specs.trim()}`
          : '';

        if (specsText && isQueryRelatedToSpecs) {
          hasExactMatch = true;
          reasoningSteps.push('知识库成功匹配商品规格参数');
        }

        if (hasExactMatch) {
          reply = `${greeting}
关于【${targetProduct.name}】的相关信息：${specsText}${matchedFaqText}
如需了解更多未列明的参数细节或特殊定制要求，建议由人工客服进一步为您确认。${closing}`;
        } else {
          reasoningSteps.push('知识库中未找到该商品对应问题的确切记载，明确需要人工确认，不编造功能');
          reply = `${greeting}
关于【${targetProduct.name}】：
对于您所咨询的具体细节，当前商品知识库中暂未收录确切说明。为避免提供不准确信息，该问题需由人工客服核对实物或联系供货商后为您答复，请您稍候。${closing}`;
          requiresHumanReview = true;
        }
      } else {
        reasoningSteps.push('未匹配到具体商品信息，提示需人工客服协助');
        reply = `${greeting}
请问您想要咨询的是哪款商品的具体规格或使用方法？您可以提供商品名称或订单号，人工客服将为您查阅准确的产品资料。${closing}`;
        requiresHumanReview = true;
      }
    } else {
      reasoningSteps.push('通用问询或未匹配特定意图：生成礼貌应答，不作任何无依据承诺');
      reply = `${greeting}
收到您的留言。请问有什么具体问题需要协助？如果是关于已有订单的疑问，请提供订单编号，人工客服将为您具体核查并处理。${closing}`;
      requiresHumanReview = true;
    }

    return {
      replyText: reply.trim(),
      reasoningSteps,
      intent,
      confidence,
      requiresHumanReview,
    };
  }

  static getOrderStatusLabel(status: Order['orderStatus']): string {
    const map: Record<Order['orderStatus'], string> = {
      pending_payment: '待付款',
      paid_pending_shipment: '已付款，待发货',
      shipped: '已发货 (运输中)',
      delivered: '已送达签收',
      refund_requested: '申请退换中',
      refunded: '已完成退款'
    };
    return map[status] || status;
  }

  static getPurchaseStatusLabel(status: Order['purchaseOrder'] extends undefined ? never : NonNullable<Order['purchaseOrder']>['status']): string {
    const map: Record<string, string> = {
      supplier_processing: '供应商制单排期中',
      procured_pending_shipment: '已采购，待发货',
      supplier_shipped: '供应商已出库',
      warehouse_received: '中转仓/质检已收货'
    };
    return map[status] || status;
  }
}
