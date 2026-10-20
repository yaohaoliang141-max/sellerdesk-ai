import React from 'react';
import {
  Package,
  Clock,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Truck,
  ExternalLink
} from 'lucide-react';
import { Order, Conversation } from '../../types';
import { Badge } from '../common/Badge';
import { TabType } from '../layout/Sidebar';
import { AIEngineService } from '../../services/aiEngine';

interface OverviewViewProps {
  orders: Order[];
  conversations: Conversation[];
  onNavigate: (tab: TabType) => void;
  onSelectConversation?: (convId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  orders,
  conversations,
  onNavigate,
}) => {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.orderStatus === 'paid_pending_shipment' || o.orderStatus === 'pending_payment'
  ).length;
  const pendingInbox = conversations.filter((c) => c.status === 'pending').length;
  const resolvedInbox = conversations.filter((c) => c.status === 'resolved').length;

  const statCards = [
    {
      label: '全部订单',
      value: totalOrders,
      change: '+12% 较上周',
      icon: Package,
      color: 'text-zinc-900',
      bgColor: 'bg-zinc-100',
    },
    {
      label: '待处理/待发货',
      value: pendingOrders,
      subtext: '包含已采购未发订单',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: '待回复客服会话',
      value: pendingInbox,
      subtext: '需要人工或AI辅助答复',
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
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold flex items-center gap-1 border border-sky-400/30">
              <Sparkles className="w-3 h-3" />
              Siena-Inspired 电商协同模式已就绪
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            欢迎使用 SellerDesk AI 运营中台
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm mt-1 max-w-xl">
            系统已实现销售订单与供应商采购单状态双向打通，AI 客服在生成回复时将严格依照真实物流事实，绝不凭空编造。
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
                {card.change && (
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    {card.change}
                  </span>
                )}
              </div>
              {card.subtext && (
                <p className="text-[11px] text-zinc-400 mt-1">{card.subtext}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Action alerts & Efficiency Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Attention / Action items */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-zinc-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900">协同待办预警</h3>
              </div>
              <span className="text-xs text-zinc-400">优先处理</span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Highlight Item 1: XY-1001 */}
              <div className="p-3 rounded-lg border border-amber-200/60 bg-amber-50/40 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-900">
                      订单 XY-1001
                    </span>
                    <Badge variant="amber">已采购，待发货</Badge>
                    <span className="text-xs text-zinc-500">客户：李梦琪</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    客户在客服中催单（“什么时候发货？急用”）。后台采购单 <span className="font-mono font-medium text-zinc-900">CG-8001</span>（杭州艺景工坊家居）正在备货质检中；AI 生成买家答复时已执行隐私脱敏，不泄露供货商与采购单号。
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('inbox')}
                  className="shrink-0 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  前往答复
                </button>
              </div>

              {/* Highlight Item 2: XY-1003 */}
              <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-900">
                      订单 XY-1003
                    </span>
                    <Badge variant="rose">申请退换中</Badge>
                    <span className="text-xs text-zinc-500">客户：王舒曼</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    客户收到“智能数显保温杯”因颜色拍错想换货，客服需调取退换货政策提供回邮地址。
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('inbox')}
                  className="shrink-0 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  处理售后
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>当前所有预警均受 AI 知识库规则保护</span>
            <button
              onClick={() => onNavigate('orders')}
              className="text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              查看完整订单列表 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* AI Efficiency & Rule Readiness */}
        <div className="rounded-xl bg-white border border-zinc-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-semibold text-zinc-900">AI 效能指标</h3>
              </div>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                正常运作
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">建议采纳率 (无需大幅重写)</span>
                  <span className="font-semibold text-zinc-900">92%</span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2">
                  <div className="bg-sky-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">物流事实真实性审计</span>
                  <span className="font-semibold text-emerald-600">100% 拒绝捏造</span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs text-zinc-600 space-y-1">
                <div className="font-medium text-zinc-900">预估已节省客服时间</div>
                <p className="text-[11px] text-zinc-500">
                  自动读取采购单状态 CG-8001 并关联知识库，单均回复用时减少约 3.5 分钟。
                </p>
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
