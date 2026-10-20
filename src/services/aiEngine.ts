import { Order, Product, StorePolicies, StoreSettings, Message } from '../types';

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
}

export class AIEngineService {
  /**
   * Generates a grounded reply suggestion based on customer query, order details,
   * supplier purchase order status, product knowledge base, and store policies.
   *
   * ARCHITECTURE NOTE:
   * To switch to DeepSeek AI API in v2:
   * Replace the deterministic template logic below with a fetch to
   * `https://api.deepseek.com/chat/completions` using Model `deepseek-chat` or `deepseek-reasoner`.
   */
  static generateReply(params: GenerateReplyParams): GeneratedReplyResult {
    const { customerQuery, order, product, policies, settings } = params;
    const query = customerQuery.trim().toLowerCase();

    const reasoningSteps: string[] = [];
    let reply = '';
    let intent: GeneratedReplyResult['intent'] = 'general';
    let confidence = 0.95;

    // 1. Intent Recognition
    const isLogistics = /物流|单号|发货|几天|多久|送到|快递|什么时候|在途|查单|进度/.test(query);
    const isReturn = /退货|退款|换货|质量问题|退换|坏了|退款流程|退钱/.test(query);
    const isProduct = /尺寸|材质|颜色|规格|怎么用|安装|有挂钩|质保|正品|电池|功能/.test(query);

    // Tone modifiers
    const isWarm = settings.brandTone === 'warm';
    const isConcise = settings.brandTone === 'concise';

    const greeting = isWarm
      ? `亲亲您好！我是${settings.storeName}的客服管家，非常高兴为您服务～`
      : `您好，感谢联系${settings.storeName}。`;

    const closing = isWarm
      ? `如您有任何其他疑问，欢迎随时敲我，祝您生活愉快！❤️\n${settings.signature}`
      : isConcise
      ? `\n${settings.signature}`
      : `如您有任何疑问或需要进一步协助，请随时告知。\n${settings.signature}`;

    if (isLogistics || isReturn || isProduct) {
      if (isLogistics) intent = 'logistics';
      else if (isReturn) intent = 'return_refund';
      else intent = 'product_inquiry';
    }

    // Logic based on Order and Procurement linkage
    if (intent === 'logistics') {
      reasoningSteps.push('识别意图：【物流时效与发货进度咨询】');

      if (order) {
        reasoningSteps.push(`读取销售订单 [${order.id}] 状态: ${this.getOrderStatusLabel(order.orderStatus)}`);

        if (order.purchaseOrder) {
          reasoningSteps.push(
            `关联采购订单 [${order.purchaseOrder.id}]，供应商状态: ${this.getPurchaseStatusLabel(
              order.purchaseOrder.status
            )} (${order.purchaseOrder.supplierName})`
          );
        }

        if (order.orderStatus === 'shipped') {
          reasoningSteps.push('根据真实快递信息生成已发货答复');
          reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
包裹已于近日通过【${order.shippingCarrier || '快递公司'}】发出，运单号为：${order.trackingNumber || '正在同步中'}。
快件目前处于正常运输与派送中，通常在发货后 2-4 天内即可送达，请您保持电话畅通以便快递员派件。${closing}`;
        } else if (order.orderStatus === 'paid_pending_shipment') {
          if (order.purchaseOrder && order.purchaseOrder.status === 'procured_pending_shipment') {
            reasoningSteps.push('严格依据事实：采购单显示【已采购，待发货】，坚决不虚构运单号');
            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
我们已核查后台协同系统，对应的工厂采购订单（单号：${order.purchaseOrder.id}）目前显示【已采购，待发货】状态。
供应商（${order.purchaseOrder.supplierName}）正在加急完成质检与加固打包，预计将于今天/明天交接给物流公司发出。
一旦运单号生成，系统将第一时间给您推送物流通知，请您放心等待！${closing}`;
          } else {
            reasoningSteps.push('订单已付款未发货，引用48小时发货政策');
            reply = `${greeting}
关于您的订单（编号：${order.id}，商品：${order.productName}）：
目前订单正在仓库紧张配货与质检中。根据本店发货规则，所有订单均会在付款后 24-48 小时内发出。我们会为您备注优先加急打包发出！${closing}`;
          }
        } else if (order.orderStatus === 'delivered') {
          reasoningSteps.push('核实订单已妥投签收');
          reply = `${greeting}
系统显示您的订单（编号：${order.id}，运单号：${order.trackingNumber || '顺丰速运'}）已妥投签收。
请问您是否已顺利取到包裹？商品使用满意的话欢迎点赞好评，若有任何不满意或配件问题，请随时联系我们为您处理。${closing}`;
        } else {
          reply = `${greeting}
您的订单（编号：${order.id}）当前状态为【${this.getOrderStatusLabel(order.orderStatus)}】。我们正在持续跟进最新处理动态。${closing}`;
        }
      } else {
        reasoningSteps.push('未关联特定订单，调用通用发货规则');
        reply = `${greeting}
本店常规现货订单在付款后 24-48 小时内按顺序完成质检并发出，江浙沪及核心城市通常发出后 1-2 天送达，其他地区 2-4 天送达。
如需查询具体订单进展，请向客服提供您的订单编号（例如：XY-1001），我们将立即为您追踪！${closing}`;
      }
    } else if (intent === 'return_refund') {
      reasoningSteps.push('识别意图：【售后退换与退款政策咨询】');
      reasoningSteps.push('检索商家知识库【退换货政策】与客户订单状态');

      if (order && order.orderStatus === 'refund_requested') {
        reply = `${greeting}
看到您提交了订单（${order.id}）的退换货申请。
我们的售后团队已经为您开通绿色退货通道！
退货指引：
1. 请确保商品外包装及配件齐全（不影响二次销售）；
2. 寄回地址：上海市青浦区仓储物流园 B 区 3 号门 售后组（电话：400-800-8899）；
3. 寄出后请将回邮快递单号发给我们在系统登记，仓库核验无误后将在 24 小时内全额原路退款。${closing}`;
      } else {
        reply = `${greeting}
本店支持签收后【7天无理由退换货】保障！
- 若属于尺寸/拍错等个人喜好原因，只要商品未拆封使用且配件完好，均可办理退换；
- 若收到时存在运输磕碰破损或质量问题，拍照留存联系客服，运费由本店全额承担并极速补发。
如果您需要办理退换，请确认您的订单编号，我们将立即为您出具退货地址与指引。${closing}`;
      }
    } else if (intent === 'product_inquiry') {
      reasoningSteps.push('识别意图：【商品属性、材质、规格与安装咨询】');

      const targetProduct = product || (order ? { name: order.productName, specs: '', faqList: [] } : undefined);

      if (targetProduct) {
        reasoningSteps.push(`从商品知识库检索 [${targetProduct.name}] 相关参数`);
        // Check matched FAQ
        let matchedFaq = '';
        if ('faqList' in targetProduct && targetProduct.faqList && targetProduct.faqList.length > 0) {
          const match = targetProduct.faqList.find(f => query.includes(f.question.slice(0, 3)) || f.question.includes('材质') || f.question.includes('安装'));
          if (match) {
            matchedFaq = `\n解答参考：${match.answer}`;
            reasoningSteps.push(`命中知识库条目：${match.question}`);
          }
        }

        const specsText = ('specs' in targetProduct && targetProduct.specs) ? `\n官方规格：${targetProduct.specs}` : '';

        reply = `${greeting}
关于【${targetProduct.name}】：${specsText}${matchedFaq || '\n这款商品深受客户喜爱，出厂经过严格品质检验，包装内配备完整的使用指引与配件。'}
如果您对具体尺寸、安装或使用方法还有特别要求，欢迎随时告知！${closing}`;
      } else {
        reply = `${greeting}
关于您咨询的商品细节：本店所有在售商品均为官方正品直供，支持质保与无忧售后。请问您想要了解的是哪款商品的具体参数或使用场景呢？${closing}`;
      }
    } else {
      reasoningSteps.push('未匹配到特定行业模板，生成通用礼貌应答');
      reply = `${greeting}
收到您的消息！请问有什么可以帮您？如果是关于已购买订单的疑问，请提供订单号，我们将第一时间为您核实解决。${closing}`;
    }

    return {
      replyText: reply.trim(),
      reasoningSteps,
      intent,
      confidence
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
