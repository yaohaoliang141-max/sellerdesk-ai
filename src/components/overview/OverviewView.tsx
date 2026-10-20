import React from 'react';
import {
  Package,
  Clock,
  MessageSquare,
  CheckCircle,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Truck,
  ExternalLink,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Order, Conversation } from '../../types';
import { Badge } from '../common/Badge';
import { TabType } from '../layout/Sidebar';
import { AIEngineService } from '../../services/aiEngine';

interface OverviewViewProps {
  orders: Order[];
  conversations: Conversation[];
  onNavigate: (tab: TabType) => void;
  onGoToInbox: (order: Order) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  orders,
  conversations,
  onNavigate,
  onGoToInbox,
}) => {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.orderStatus === 'paid_pending_shipment' || o.orderStatus === 'pending_payment'
  ).length;
  const pendingInbox = conversations.filter((c) => c.status === 'pending').length;
  const resolvedInbox = conversations.filter((c) => c.status === 'resolved').length;

  // Real data calculations
  const totalAgentMessages = conversations.reduce(
    (acc, c) => acc + c.messages.filter((m) => m.sender === 'agent').length,
    0
  );
  const totalAiMessages = conversations.reduce(
    (acc, c) => acc + c.messages.filter((m) => m.suggestedByAI).length,
    0
  );

  // Dynamic alerts generated strictly from current data
  interface DynamicAlert {
    id: string;
    order: Order;
    badgeVariant: 'amber' | 'rose' | 'blue';
    badgeText: string;
    description: string;
  }

  const dynamicAlerts: DynamicAlert[] = [];

  // Check for orders needing refund processing
  orders
    .filter((o) => o.orderStatus === 'refund_requested')
    .forEach((o) => {
      dynamicAlerts.push({
        id: `refund-${o.id}`,
        order: o,
        badgeVariant: 'rose',
        badgeText: '申请退换中',
        description: `客户 ${o.customerName} 申请退换商品【${o.productName}】，需核验退货政策并向买家提供退货指引。`,
      });
    });

  // Check for pending shipment with supplier tracking or notes
  orders
    .filter((o) => o.orderStatus === 'paid_pending_shipment')
    .forEach((o) => {
      if (o.purchaseOrder) {
        if (o.purchaseOrder.status === 'supplier_shipped') {
          dynamicAlerts.push({
            id: `supp-shipped-${o.id}`,
            order: o,
            badgeVariant: 'blue',
            badgeText: '供应商已出库',
            description: `供货方已发货，销售单尚未录入终端运单号。出库时间以快递实际揽收为准，需人工跟进单号。`,
          });
        } else {
          dynamicAlerts.push({
            id: `prep-${o.id}`,
            order: o,
            badgeVariant: 'amber',
            badgeText: AIEngineService.getPurchaseStatusLabel(o.purchaseOrder.status),
            description: `客户 ${o.customerName} 订单处于备货阶段，出库时效未经最终物流揽收核实，回复买家时需人工复核。`,
          });
        }
      } else {
        dynamicAlerts.push({
          id: `no-po-${o.id}`,
          order: o,
          badgeVariant: 'amber',
          badgeText: '未关联采购单',
          description: `订单已付款但尚未关联供应链采购单，需人工创建采购协同单。`,
        });
      }
    });

  const statCards = [
    {
      label: '全部销售订单',
      value: totalOrders,
      subtext: '本地已保存的模拟订单',
      icon: Package,
      color: 'text-zinc-900',
      bgColor: 'bg-zinc-100',
    },
    {
      label: '待处理/待发货',
      value: pendingOrders,
      subtext: '包含备货及采购待发订单',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: '待回复客服会话',
      value: pendingInbox,
      subtext: '需要人工审核或回复',
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      label: '已完成会话',
      value: resolvedInbox,
      subtext: '已满意结单',
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="p-6 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-400/30">
              <ShieldCheck className="w-3 h-3" />
              演示沙盒环境 · 本地离线持久化
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            SellerDesk AI 协同运营中台
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm mt-1 max-w-xl">
            销售订单与源头供应链采购状态无缝对齐。面向买家回复时自动执行商业脱敏，绝不捏造假单号或虚构物流。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('inbox')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-100 transition-colors shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
            <span>进入 AI 客服工作台</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
          >
            <span>管理协同订单</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs hover:border-zinc-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900 tracking-tight">{card.value}</span>
              </div>
              {card.subtext && (
                <p className="text-[11px] text-zinc-400 mt-1">{card.subtext}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Action alerts & Real Operating Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Attention / Action items (Dynamically computed!) */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-zinc-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900">协同待办预警</h3>
              </div>
              <span className="text-xs text-zinc-400">
                {dynamicAlerts.length > 0 ? `共 ${dynamicAlerts.length} 项需关注` : '无待办'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {dynamicAlerts.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                  目前暂无加急预警，所有订单与会话均处于正常流转中。
                </div>
              ) : (
                dynamicAlerts.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-900">
                          订单 {item.order.id}
                        </span>
                        <Badge variant={item.badgeVariant}>{item.badgeText}</Badge>
                        <span className="text-xs text-zinc-500">客户：{item.order.customerName}</span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <button
                      onClick={() => onGoToInbox(item.order)}
                      className="shrink-0 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      前往客服
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>预警列表由订单及采购实时数据动态计算</span>
            <button
              onClick={() => onNavigate('orders')}
              className="text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              查看完整订单列表 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Real Operating Stats (Zero fake numbers) */}
        <div className="rounded-xl bg-white border border-zinc-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-semibold text-zinc-900">会话处理统计</h3>
              </div>
              <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                实时统计
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">AI 辅助生成并保存回复</span>
                  <span className="font-semibold text-zinc-900">
                    {totalAiMessages > 0 ? `${totalAiMessages} 条` : '暂无统计数据'}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{
                      width: totalAgentMessages > 0 ? `${Math.min(100, Math.round((totalAiMessages / totalAgentMessages) * 100))}%` : '0%',
                    }}
                  ></div>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {totalAgentMessages > 0
                    ? `在全部 ${totalAgentMessages} 条客服已发送记录中占比 ${Math.round((totalAiMessages / totalAgentMessages) * 100)}%`
                    : '在客服工单中生成并保存模拟回复后显示统计'}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">工时与提效统计</span>
                  <span className="text-zinc-400 text-[11px]">暂无统计数据</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-500 leading-relaxed">
                  当前为轻量演示环境，未接入外部考勤与真实工时计算系统，不展示未经证实的节省分钟数。
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <button
              onClick={() => onNavigate('knowledge')}
              className="w-full py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-center transition-colors"
            >
              配置商品与发货规则知识库
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Overview Table */}
      <div className="rounded-xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">最新协同订单动态</h3>
            <p className="text-xs text-zinc-400 mt-0.5">每笔订单均已绑定对应的源头供应链状态</p>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            全部订单 <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 border-b border-zinc-100">
              <tr>
                <th className="px-5 py-3 font-medium">销售单号</th>
                <th className="px-5 py-3 font-medium">关联采购单</th>
                <th className="px-5 py-3 font-medium">客户</th>
                <th className="px-5 py-3 font-medium">商品名称</th>
                <th className="px-5 py-3 font-medium">销售状态</th>
                <th className="px-5 py-3 font-medium">供应商发货状态</th>
                <th className="px-5 py-3 font-medium text-right">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.slice(0, 4).map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-semibold text-zinc-900">
                    {order.id}
                  </td>
                  <td className="px-5 py-3.5">
                    {order.purchaseOrder ? (
                      <span className="font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">
                        {order.purchaseOrder.id}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">未关联</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-800 font-medium">
                    {order.customerName}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 truncate max-w-[180px]">
                    {order.productName}
                  </td>
                  <td className="px-5 py-3.5">
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
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">
                    {order.purchaseOrder ? (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Truck className="w-3 h-3 text-zinc-400" />
                        <span>{AIEngineService.getPurchaseStatusLabel(order.purchaseOrder.status)}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-zinc-900">
                    {order.currency}{order.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
