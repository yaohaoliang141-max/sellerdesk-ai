import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Sparkles,
  Send,
  Copy,
  Edit3,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  ChevronRight,
  Info,
  ChevronDown
} from 'lucide-react';
import {
  Conversation,
  Order,
  Product,
  StorePolicies,
  StoreSettings,
  Message
} from '../../types';
import { Badge } from '../common/Badge';
import { AIEngineService, GeneratedReplyResult } from '../../services/aiEngine';
import { OrderContextSidebar } from './OrderContextSidebar';

interface InboxViewProps {
  conversations: Conversation[];
  orders: Order[];
  products: Product[];
  policies: StorePolicies;
  settings: StoreSettings;
  onUpdateConversations: (convs: Conversation[]) => void;
  onOpenOrderModal: (order: Order) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  orders,
  products,
  policies,
  settings,
  onUpdateConversations,
  onOpenOrderModal,
  onShowToast,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(
    conversations[0]?.id || ''
  );
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Current active conversation
  const activeConversation =
    conversations.find((c) => c.id === selectedConvId) || conversations[0];

  // Active linked order
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    activeConversation?.orderId || ''
  );

  useEffect(() => {
    if (activeConversation) {
      setSelectedOrderId(activeConversation.orderId);
    }
  }, [activeConversation]);

  const activeOrder = orders.find((o) => o.id === selectedOrderId);
  const activeProduct = activeOrder
    ? products.find((p) => p.id === activeOrder.productId || p.name === activeOrder.productName)
    : undefined;

  // AI Prompt Workspace State
  const [customerQueryInput, setCustomerQueryInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<GeneratedReplyResult | null>(null);
  const [editedReply, setEditedReply] = useState<string>('');
  const [showRightContext, setShowRightContext] = useState(true);

  // Sync latest customer message as default query when conversation changes
  useEffect(() => {
    if (activeConversation) {
      const customerMsgs = activeConversation.messages.filter(
        (m) => m.sender === 'customer'
      );
      const lastCust = customerMsgs[customerMsgs.length - 1];
      if (lastCust) {
        setCustomerQueryInput(lastCust.content);
      }
      setAiResult(null);
      setEditedReply('');
    }
  }, [activeConversation?.id]);

  // Trigger AI Suggestion
  const handleGenerateReply = () => {
    if (!customerQueryInput.trim()) {
      onShowToast('请输入或选择客户的问题', 'error');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      const result = AIEngineService.generateReply({
        customerQuery: customerQueryInput,
        order: activeOrder,
        product: activeProduct,
        policies,
        settings,
        conversationHistory: activeConversation?.messages,
      });

      setAiResult(result);
      setEditedReply(result.replyText);
      setIsGenerating(false);
      onShowToast('AI 建议回复生成完毕，已结合订单真实状态与知识库', 'success');
    }, 350);
  };

  // Copy reply to clipboard
  const handleCopyReply = () => {
    if (!editedReply) return;
    navigator.clipboard.writeText(editedReply);
    onShowToast('回复内容已复制到剪贴板！', 'success');
  };

  // Confirm and Send reply
  const handleConfirmAndSend = () => {
    if (!editedReply.trim() || !activeConversation) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      content: editedReply.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedByAI: true,
    };

    const updatedConvs = conversations.map((conv) => {
      if (conv.id === activeConversation.id) {
        return {
          ...conv,
          status: 'resolved' as const,
          lastMessage: newMsg.content,
          updatedAt: '刚刚',
          messages: [...conv.messages, newMsg],
        };
      }
      return conv;
    });

    onUpdateConversations(updatedConvs);
    setAiResult(null);
    setEditedReply('');
    setCustomerQueryInput('');
    onShowToast('回复已确认发出，会话已标记为已处理！', 'success');
  };

  // Send a quick direct reply
  const [directInput, setDirectInput] = useState('');
  const handleSendDirect = () => {
    if (!directInput.trim() || !activeConversation) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      content: directInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedConvs = conversations.map((conv) => {
      if (conv.id === activeConversation.id) {
        return {
          ...conv,
          lastMessage: newMsg.content,
          updatedAt: '刚刚',
          messages: [...conv.messages, newMsg],
        };
      }
      return conv;
    });

    onUpdateConversations(updatedConvs);
    setDirectInput('');
    onShowToast('消息已发送', 'success');
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterStatus === 'pending' && c.status !== 'pending') return false;
    if (filterStatus === 'resolved' && c.status !== 'resolved') return false;
    if (searchTerm) {
      const matchName = c.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOrder = c.orderId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMsg = c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
      return matchName || matchOrder || matchMsg;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs flex flex-col lg:flex-row h-[calc(100vh-140px)] min-h-[640px] overflow-hidden">
      {/* 1. Left Panel: Conversations List */}
      <div className="w-full lg:w-80 border-r border-zinc-200/80 flex flex-col shrink-0 bg-zinc-50/40">
        {/* Search & Tabs */}
        <div className="p-3.5 border-b border-zinc-100 space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索客户、订单号或消息..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          </div>

          <div className="flex rounded-lg bg-zinc-100 p-0.5 text-[11px] font-medium text-zinc-600">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 py-1 rounded-md text-center transition-colors ${
                filterStatus === 'all' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'hover:text-zinc-900'
              }`}
            >
              全部 ({conversations.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`flex-1 py-1 rounded-md text-center transition-colors ${
                filterStatus === 'pending' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'hover:text-zinc-900'
              }`}
            >
              待回复
            </button>
            <button
              onClick={() => setFilterStatus('resolved')}
              className={`flex-1 py-1 rounded-md text-center transition-colors ${
                filterStatus === 'resolved' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'hover:text-zinc-900'
              }`}
            >
              已解决
            </button>
          </div>
        </div>

        {/* Conversations Scroll list */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              未找到匹配的会话
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              const hasUnread = conv.status === 'pending';

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 cursor-pointer transition-all text-left relative ${
                    isSelected
                      ? 'bg-white shadow-2xs border-l-2 border-l-zinc-900'
                      : 'hover:bg-zinc-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-zinc-900">
                        {conv.customerName}
                      </span>
                      {hasUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {conv.updatedAt.split(' ')[1] || conv.updatedAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 rounded text-zinc-600 border border-zinc-200/60">
                      {conv.orderId}
                    </span>
                    <Badge
                      variant={
                        conv.status === 'resolved'
                          ? 'emerald'
                          : conv.status === 'pending'
                          ? 'rose'
                          : 'blue'
                      }
                      size="sm"
                    >
                      {conv.status === 'resolved'
                        ? '已解决'
                        : conv.status === 'pending'
                        ? '待回复'
                        : '处理中'}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-zinc-500 truncate leading-relaxed">
                    {conv.lastMessage}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Center Panel: Chat + AI Copilot */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Header */}
        {activeConversation ? (
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">
                    {activeConversation.customerName}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    ({activeConversation.customerEmail})
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500">关联销售订单:</span>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="text-xs font-mono font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 focus:outline-none"
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.productName} ({AIEngineService.getOrderStatusLabel(o.orderStatus)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const updatedConvs = conversations.map((conv) => {
                    if (conv.id === activeConversation.id) {
                      return {
                        ...conv,
                        status: (conv.status === 'resolved' ? 'pending' : 'resolved') as 'pending' | 'resolved',
                      };
                    }
                    return conv;
                  });
                  onUpdateConversations(updatedConvs);
                  onShowToast('会话状态已切换', 'info');
                }}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700"
              >
                {activeConversation.status === 'resolved' ? '设为待回复' : '标记为已解决'}
              </button>

              <button
                onClick={() => setShowRightContext(!showRightContext)}
                className="hidden xl:flex text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700"
              >
                {showRightContext ? '收起订单详情' : '展开订单详情'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/30">
          {activeConversation?.messages.map((msg) => {
            const isCustomer = msg.sender === 'customer';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-medium text-zinc-500">
                    {isCustomer ? activeConversation.customerName : 'SellerDesk 客服'}
                  </span>
                  {msg.suggestedByAI && (
                    <span className="text-[10px] text-sky-600 bg-sky-50 px-1 py-0.2 rounded border border-sky-100 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI 协同生成
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400">{msg.timestamp}</span>
                </div>

                <div
                  onClick={() => {
                    if (isCustomer) {
                      setCustomerQueryInput(msg.content);
                      onShowToast('已将此客户消息载入 AI 提问框', 'info');
                    }
                  }}
                  className={`max-w-md lg:max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed transition-shadow cursor-default ${
                    isCustomer
                      ? 'bg-white border border-zinc-200/90 text-zinc-800 rounded-tl-xs shadow-2xs hover:border-sky-300'
                      : 'bg-zinc-900 text-white rounded-tr-xs shadow-xs'
                  }`}
                  title={isCustomer ? '点击可直接载入下方 AI 回复生成器' : undefined}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Reply Copilot Zone */}
        <div className="p-4 border-t border-zinc-200/80 bg-white space-y-3 shrink-0">
          {/* Quick preset queries */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-500" />
              快捷场景:
            </span>
            {[
              '什么时候发货？',
              '查询物流到哪了',
              '拍错颜色想退换货',
              '画框是什么材质？有挂钩吗？',
              '有配套收纳包吗？'
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomerQueryInput(preset);
                  // auto generate
                  const result = AIEngineService.generateReply({
                    customerQuery: preset,
                    order: activeOrder,
                    product: activeProduct,
                    policies,
                    settings,
                  });
                  setAiResult(result);
                  setEditedReply(result.replyText);
                  onShowToast(`已载入场景：“${preset}” 并生成建议`, 'success');
                }}
                className="px-2 py-0.8 text-[11px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Customer Query Input with Generate Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="输入客户问题，如“什么时候发货？”或直接选用快捷场景..."
                value={customerQueryInput}
                onChange={(e) => setCustomerQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateReply();
                }}
                className="w-full text-xs px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <button
              onClick={handleGenerateReply}
              disabled={isGenerating}
              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGenerating ? '正在研判订单与规则...' : 'AI 生成回复'}</span>
            </button>
          </div>

          {/* AI Suggestion Box (Editable + Actionable) */}
          {aiResult && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-sky-50/40 via-white to-white border border-sky-200/80 shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-sky-600 text-white flex items-center justify-center">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900">
                      AI 建议回复（可直接编辑）
                    </span>
                    <span className="text-[10px] text-sky-700 ml-2">
                      严格遵循真实订单与采购单事实
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyReply}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-2 py-1 rounded-md transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>复制</span>
                  </button>

                  <button
                    onClick={handleConfirmAndSend}
                    className="inline-flex items-center gap-1 text-[11px] text-white bg-zinc-900 hover:bg-zinc-800 px-3 py-1 rounded-md font-semibold transition-colors shadow-2xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>确认并发送</span>
                  </button>
                </div>
              </div>

              {/* Reasoning steps breadcrumbs */}
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-800 flex items-center gap-1">
                  <Info className="w-3 h-3 text-sky-500" />
                  <span>AI 决策依据（不捏造虚假物流）：</span>
                </div>
                <div className="space-y-0.5 text-zinc-500 pl-4 list-disc">
                  {aiResult.reasoningSteps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-1">
                      <span className="text-zinc-400">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Textarea for editing */}
              <div className="relative">
                <textarea
                  rows={4}
                  value={editedReply}
                  onChange={(e) => setEditedReply(e.target.value)}
                  className="w-full text-xs p-3 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 font-sans leading-relaxed text-zinc-800"
                  placeholder="在此直接编辑修改回复内容..."
                />
              </div>
            </div>
          )}

          {/* Fallback Direct Input */}
          {!aiResult && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="或直接输入人工回复内容..."
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendDirect();
                }}
                className="w-full text-xs px-3.5 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none"
              />
              <button
                onClick={handleSendDirect}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>发送</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Panel: Order & Context Drawer */}
      {showRightContext && (
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-200/80 bg-zinc-50/50 shrink-0">
          <OrderContextSidebar
            order={activeOrder}
            product={activeProduct}
            policies={policies}
            onOpenOrderModal={onOpenOrderModal}
          />
        </div>
      )}
    </div>
  );
};
