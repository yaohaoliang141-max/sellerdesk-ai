import React, { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  Plus,
  Truck,
  Edit2,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { Badge } from '../common/Badge';
import { OrderModal } from './OrderModal';
import { Modal } from '../common/Modal';
import { TabType } from '../layout/Sidebar';
import { AIEngineService } from '../../services/aiEngine';

interface OrdersViewProps {
  orders: Order[];
  onUpdateOrders: (orders: Order[]) => void;
  onNavigate: (tab: TabType) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onUpdateOrders,
  onNavigate,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // New Order Form state
  const [newOrderForm, setNewOrderForm] = useState({
    id: `XY-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    productName: '复古装饰画',
    quantity: 1,
    amount: 168.0,
    orderStatus: 'paid_pending_shipment' as OrderStatus,
    purchaseOrderId: `CG-${Math.floor(7000 + Math.random() * 1000)}`,
    supplierName: '杭州艺景工坊家居供应链',
    purchaseStatus: 'procured_pending_shipment' as const,
    costAmount: 52.0,
    supplierNotes: '工厂已确认接单，待出库'
  });

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customerName.trim()) {
      onShowToast('请填写客户姓名', 'error');
      return;
    }

    const created: Order = {
      id: newOrderForm.id,
      customerName: newOrderForm.customerName,
      customerEmail: newOrderForm.customerEmail || `${newOrderForm.customerName}@example.com`,
      customerPhone: newOrderForm.customerPhone || '138****0000',
      customerAddress: newOrderForm.customerAddress || '上海市浦东新区示例地址',
      productId: 'prod-001',
      productName: newOrderForm.productName,
      quantity: Number(newOrderForm.quantity),
      amount: Number(newOrderForm.amount),
      currency: '¥',
      orderStatus: newOrderForm.orderStatus,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      purchaseOrder: {
        id: newOrderForm.purchaseOrderId,
        supplierName: newOrderForm.supplierName,
        status: newOrderForm.purchaseStatus,
        costAmount: Number(newOrderForm.costAmount),
        notes: newOrderForm.supplierNotes,
        updatedAt: new Date().toISOString()
      }
    };

    onUpdateOrders([created, ...orders]);
    setIsNewOrderModalOpen(false);
    onShowToast(`新订单 ${created.id} 已创建并关联采购单 ${created.purchaseOrder?.id}`, 'success');
  };

  const handleSaveOrder = (updated: Order) => {
    const nextOrders = orders.map((o) => (o.id === updated.id ? updated : o));
    onUpdateOrders(nextOrders);
    onShowToast(`订单 ${updated.id} 协同数据已更新`, 'success');
  };

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all' && order.orderStatus !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = order.id.toLowerCase().includes(term);
      const matchCustomer = order.customerName.toLowerCase().includes(term);
      const matchProduct = order.productName.toLowerCase().includes(term);
      const matchPurchase = order.purchaseOrder?.id.toLowerCase().includes(term) || false;
      return matchId || matchCustomer || matchProduct || matchPurchase;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">
            销售与供应链协同订单
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            每笔终端销售订单（如 <span className="font-mono font-medium text-zinc-800">XY-1001</span>）均可穿透追溯源头采购订单（如 <span className="font-mono font-medium text-zinc-800">CG-8001</span>）
          </p>
        </div>

        <button
          onClick={() => {
            setNewOrderForm({
              ...newOrderForm,
              id: `XY-${Math.floor(1000 + Math.random() * 9000)}`,
              purchaseOrderId: `CG-${Math.floor(7000 + Math.random() * 1000)}`,
            });
            setIsNewOrderModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>创建新测试订单</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索销售单号、采购单号、客户姓名或商品..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-800"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {[
            { id: 'all', label: '全部订单' },
            { id: 'paid_pending_shipment', label: '已付款待发货' },
            { id: 'shipped', label: '运输中' },
            { id: 'delivered', label: '已签收' },
            { id: 'refund_requested', label: '申请退换' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-zinc-900 text-white font-medium shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 border-b border-zinc-100">
              <tr>
                <th className="px-5 py-3 font-medium">销售单号</th>
                <th className="px-5 py-3 font-medium">客户收件人</th>
                <th className="px-5 py-3 font-medium">商品及数量</th>
                <th className="px-5 py-3 font-medium">销售履约状态</th>
                <th className="px-5 py-3 font-medium">关联采购单 (供应链)</th>
                <th className="px-5 py-3 font-medium">采购状态</th>
                <th className="px-5 py-3 font-medium text-right">订单金额</th>
                <th className="px-5 py-3 font-medium text-center">协同操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-zinc-400">
                    未找到符合条件的订单
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/70 transition-colors group">
                    {/* Sales Order ID */}
                    <td className="px-5 py-4 font-mono font-semibold text-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                          {order.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                        {order.createdAt.split(' ')[0]}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-zinc-900">{order.customerName}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{order.customerPhone}</div>
                    </td>

                    {/* Product */}
                    <td className="px-5 py-4 max-w-[200px]">
                      <div className="font-medium text-zinc-800 truncate" title={order.productName}>
                        {order.productName}
                      </div>
                      <div className="text-[10px] text-zinc-400">数量: ×{order.quantity}</div>
                    </td>

                    {/* Sales Status */}
                    <td className="px-5 py-4">
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
                      {order.trackingNumber && (
                        <div className="text-[10px] text-zinc-400 font-mono mt-1 truncate max-w-[120px]">
                          {order.shippingCarrier}: {order.trackingNumber}
                        </div>
                      )}
                    </td>

                    {/* Linked Purchase Order */}
                    <td className="px-5 py-4">
                      {order.purchaseOrder ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                              {order.purchaseOrder.id}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[140px]">
                            {order.purchaseOrder.supplierName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-xs">无采购协同</span>
                      )}
                    </td>

                    {/* Purchase Status */}
                    <td className="px-5 py-4">
                      {order.purchaseOrder ? (
                        <span className="text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                          {AIEngineService.getPurchaseStatusLabel(order.purchaseOrder.status)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 text-right">
                      <div className="font-bold text-zinc-900">
                        {order.currency}{order.amount.toFixed(2)}
                      </div>
                      {order.purchaseOrder && (
                        <div className="text-[10px] text-zinc-400 font-mono">
                          成本: ¥{order.purchaseOrder.costAmount.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="编辑订单与采购单"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onNavigate('inbox')}
                          className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors"
                          title="前往客服沟通"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Order Modal */}
      <OrderModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onSaveOrder={handleSaveOrder}
      />

      {/* Create New Order Modal */}
      <Modal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        title="创建新测试销售订单"
        subtitle="自动关联供应商采购协同单，用于测试客服 AI 答复"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">销售单号</label>
              <input
                type="text"
                value={newOrderForm.id}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, id: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">客户姓名</label>
              <input
                type="text"
                placeholder="例如：周杰"
                value={newOrderForm.customerName}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">商品名称</label>
              <input
                type="text"
                value={newOrderForm.productName}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, productName: e.target.value })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">订单金额 (元)</label>
              <input
                type="number"
                value={newOrderForm.amount}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60 space-y-2">
            <span className="font-semibold text-zinc-900 block">协同供应商采购单配置:</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-500 text-[11px] mb-0.5">采购单号</label>
                <input
                  type="text"
                  value={newOrderForm.purchaseOrderId}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, purchaseOrderId: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-[11px] mb-0.5">采购单状态</label>
                <select
                  value={newOrderForm.purchaseStatus}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, purchaseStatus: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded text-xs"
                >
                  <option value="procured_pending_shipment">已采购，待发货</option>
                  <option value="supplier_shipped">供应商已出库</option>
                  <option value="supplier_processing">供应商制单中</option>
                  <option value="warehouse_received">中转仓已质检</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsNewOrderModalOpen(false)}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium"
            >
              立即创建
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
