import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, PurchaseOrderStatus, Product } from '../../types';
import { Modal } from '../common/Modal';
import { Package, Truck, User } from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  products: Product[];
  onSaveOrder: (updated: Order) => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  order,
  products,
  onSaveOrder,
}) => {
  const [formData, setFormData] = useState<Order | null>(null);

  useEffect(() => {
    if (order) {
      setFormData(JSON.parse(JSON.stringify(order)));
    }
  }, [order]);

  if (!formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSaveOrder(formData);
      onClose();
    }
  };

  const handleProductSelect = (selectedId: string) => {
    if (!formData) return;
    if (selectedId === 'custom') {
      setFormData({
        ...formData,
        productId: '',
      });
    } else {
      const matched = products.find((p) => p.id === selectedId);
      if (matched) {
        setFormData({
          ...formData,
          productId: matched.id,
          productName: matched.name,
          amount: matched.price * (formData.quantity || 1),
        });
      }
    }
  };

  const currentMatchedProduct = products.find(
    (p) => p.id === formData.productId || p.name === formData.productName
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑订单协同详情 - ${formData.id}`}
      subtitle="销售订单与供应商采购订单双向联动管理"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* 1. Sales Order Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900 pb-1.5 border-b border-zinc-100">
            <Package className="w-4 h-4 text-sky-600" />
            <span>销售订单基础信息</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 font-medium mb-1">销售订单号 (不可修改)</label>
              <input
                type="text"
                disabled
                value={formData.id}
                className="w-full px-3 py-2 bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">销售订单履约状态</label>
              <select
                value={formData.orderStatus}
                onChange={(e) =>
                  setFormData({ ...formData, orderStatus: e.target.value as OrderStatus })
                }
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="pending_payment">待付款</option>
                <option value="paid_pending_shipment">已付款，待发货</option>
                <option value="shipped">已发货 (运输中)</option>
                <option value="delivered">已妥投签收</option>
                <option value="refund_requested">客户申请退款/退换</option>
                <option value="refunded">已退款</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">从知识库关联商品</label>
              <select
                value={currentMatchedProduct ? currentMatchedProduct.id : 'custom'}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:bg-white focus:outline-none"
              >
                <option value="custom">-- 自定义商品 (未录入知识库) --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (售价: ¥{p.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">商品名称</label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">购买数量</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 1;
                  const unitPrice = currentMatchedProduct ? currentMatchedProduct.price : (formData.amount / (formData.quantity || 1));
                  setFormData({
                    ...formData,
                    quantity: qty,
                    amount: unitPrice * qty,
                  });
                }}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">订单金额 (元)</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">快递承运商</label>
              <input
                type="text"
                placeholder="例如：顺丰速运 / 中通快递"
                value={formData.shippingCarrier || ''}
                onChange={(e) => setFormData({ ...formData, shippingCarrier: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">快递单号</label>
              <input
                type="text"
                placeholder="例如：SF149928172901"
                value={formData.trackingNumber || ''}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Customer Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900 pb-1.5 border-b border-zinc-100">
            <User className="w-4 h-4 text-emerald-600" />
            <span>客户收件信息</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">客户姓名</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">联系电话</label>
              <input
                type="text"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg font-mono focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-700 font-medium mb-1">收货详细地址</label>
              <input
                type="text"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Linked Procurement / Supplier Purchase Order */}
        <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-200/80">
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
              <Truck className="w-4 h-4 text-amber-600" />
              <span>关联供应商采购单（真实供应链事实 · 仅商家可见）</span>
            </div>
            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">
              客服 AI 必读依据
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">采购单号 (如 CG-8001)</label>
              <input
                type="text"
                value={formData.purchaseOrder?.id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchaseOrder: {
                      id: e.target.value,
                      supplierName: formData.purchaseOrder?.supplierName || '',
                      status: formData.purchaseOrder?.status || 'procured_pending_shipment',
                      costAmount: formData.purchaseOrder?.costAmount || 0,
                      notes: formData.purchaseOrder?.notes || '',
                      updatedAt: new Date().toISOString(),
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">供应商真实状态</label>
              <select
                value={formData.purchaseOrder?.status || 'procured_pending_shipment'}
                onChange={(e) => {
                  if (formData.purchaseOrder) {
                    setFormData({
                      ...formData,
                      purchaseOrder: {
                        ...formData.purchaseOrder,
                        status: e.target.value as PurchaseOrderStatus,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              >
                <option value="supplier_processing">供应商制单排期中</option>
                <option value="procured_pending_shipment">已采购，待发货</option>
                <option value="supplier_shipped">供应商已出库</option>
                <option value="warehouse_received">中转仓/质检已收货</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">供应商名称</label>
              <input
                type="text"
                value={formData.purchaseOrder?.supplierName || ''}
                onChange={(e) => {
                  if (formData.purchaseOrder) {
                    setFormData({
                      ...formData,
                      purchaseOrder: {
                        ...formData.purchaseOrder,
                        supplierName: e.target.value,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">采购成本 (元)</label>
              <input
                type="number"
                step="0.01"
                value={formData.purchaseOrder?.costAmount || 0}
                onChange={(e) => {
                  if (formData.purchaseOrder) {
                    setFormData({
                      ...formData,
                      purchaseOrder: {
                        ...formData.purchaseOrder,
                        costAmount: parseFloat(e.target.value) || 0,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-700 font-medium mb-1">工厂发货排期备注</label>
              <input
                type="text"
                placeholder="例如：工厂排单制作完成，正在检验包装，准备今天交接顺丰..."
                value={formData.purchaseOrder?.notes || ''}
                onChange={(e) => {
                  if (formData.purchaseOrder) {
                    setFormData({
                      ...formData,
                      purchaseOrder: {
                        ...formData.purchaseOrder,
                        notes: e.target.value,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium shadow-xs"
          >
            保存并同步
          </button>
        </div>
      </form>
    </Modal>
  );
};
