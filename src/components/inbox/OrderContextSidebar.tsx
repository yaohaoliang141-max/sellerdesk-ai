import React from 'react';
import {
  Package,
  Truck,
  User,
  MapPin,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Order, Product, StorePolicies } from '../../types';
import { Badge } from '../common/Badge';
import { AIEngineService } from '../../services/aiEngine';

interface OrderContextSidebarProps {
  order?: Order;
  product?: Product;
  policies: StorePolicies;
  onOpenOrderModal?: (order: Order) => void;
}

export const OrderContextSidebar: React.FC<OrderContextSidebarProps> = ({
  order,
  product,
  policies,
  onOpenOrderModal,
}) => {
  if (!order) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <Package className="w-10 h-10 stroke-1 mb-2 text-zinc-300" />
        <p className="text-xs font-medium">当前会话未关联销售订单</p>
        <p className="text-[11px] text-zinc-400 mt-1">可在上方下拉选择关联订单</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs">
      {/* Sales Order Card */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <Package className="w-4 h-4 text-zinc-500" />
            <span>销售订单</span>
            <span className="font-mono text-xs text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
              {order.id}
            </span>
          </div>
          {onOpenOrderModal && (
            <button
              onClick={() => onOpenOrderModal(order)}
              className="text-zinc-400 hover:text-zinc-700"
              title="编辑订单详情"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-1.5 text-zinc-600">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">销售状态:</span>
            <Badge
              variant={
                order.orderStatus === 'delivered'
                  ? 'emerald'
                  : order.orderStatus === 'shipped'
                  ? 'blue'
                  : order.orderStatus === 'refund_requested'
                  ? 'rose'
                  : 'amber'
              }
            >
              {AIEngineService.getOrderStatusLabel(order.orderStatus)}
            </Badge>
          </div>

          <div className="flex justify-between">
            <span className="text-zinc-400">商品名称:</span>
            <span className="font-medium text-zinc-900 truncate max-w-[140px]" title={order.productName}>
              {order.productName}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-zinc-400">数量 / 金额:</span>
            <span className="font-medium text-zinc-900">
              {order.quantity} 件 / {order.currency}{order.amount.toFixed(2)}
            </span>
          </div>

          {order.trackingNumber && (
            <div className="flex justify-between items-center pt-1 border-t border-zinc-100">
              <span className="text-zinc-400">物流单号:</span>
              <span className="font-mono text-zinc-800 text-[11px]">{order.trackingNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Linked Procurement / Supplier Order Card */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/60 to-white border border-amber-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <Truck className="w-4 h-4 text-amber-600" />
            <span>协同采购订单</span>
            {order.purchaseOrder && (
              <span className="font-mono text-xs text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                {order.purchaseOrder.id}
              </span>
            )}
          </div>
          <span className="text-[10px] text-amber-700 font-medium">真实供应链状态</span>
        </div>

        {order.purchaseOrder ? (
          <div className="space-y-1.5 text-zinc-600">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">采购状态:</span>
              <span className="font-medium text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                {AIEngineService.getPurchaseStatusLabel(order.purchaseOrder.status)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-400">供应商:</span>
              <span className="font-medium text-zinc-900 truncate max-w-[150px]">
                {order.purchaseOrder.supplierName}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-400">采购成本:</span>
              <span className="font-mono text-zinc-800">
                ¥{order.purchaseOrder.costAmount.toFixed(2)}
              </span>
            </div>

            {order.purchaseOrder.notes && (
              <div className="p-2 rounded bg-white/80 border border-amber-200/60 text-[11px] text-zinc-700 leading-relaxed mt-2">
                <span className="font-semibold text-amber-800">工厂进度备注：</span>
                {order.purchaseOrder.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-zinc-400 text-center py-2">
            未关联采购单
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>AI 客服将严格遵循此采购进度，不造假物流。</span>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/90 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-900 pb-1 border-b border-zinc-100">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span>客户与收件信息</span>
        </div>

        <div className="space-y-1 text-zinc-600">
          <div className="flex justify-between">
            <span className="text-zinc-400">客户姓名:</span>
            <span className="font-medium text-zinc-900">{order.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">联系电话:</span>
            <span className="font-mono text-zinc-800">{order.customerPhone}</span>
          </div>
          <div className="pt-1">
            <span className="text-zinc-400 block mb-0.5">收货地址:</span>
            <div className="flex items-start gap-1 text-zinc-700 text-[11px] leading-relaxed">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span>{order.customerAddress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product & Policies Reference */}
      {product && (
        <div className="p-4 rounded-xl bg-white border border-zinc-200/90 shadow-xs space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900 pb-1 border-b border-zinc-100">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>知识库匹配项</span>
          </div>

          <div className="space-y-1.5 text-zinc-600 text-[11px]">
            <div>
              <span className="font-semibold text-zinc-700">规格参数:</span>
              <p className="text-zinc-500 mt-0.5 leading-relaxed">{product.specs}</p>
            </div>
            {product.faqList && product.faqList.length > 0 && (
              <div className="pt-1 border-t border-zinc-100">
                <span className="font-semibold text-zinc-700">常见问答参考:</span>
                <p className="text-zinc-500 mt-0.5 line-clamp-2">
                  Q: {product.faqList[0].question}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
