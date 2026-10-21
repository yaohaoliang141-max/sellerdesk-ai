import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Cpu
} from 'lucide-react';
import {
  Conversation,
  Order,
  Product,
  StorePolicies,
  StoreSettings,
  Message,
  GeneratedReplyResult,
  AIMode
} from '../../types';
import { Badge } from '../common/Badge';
import { AIEngineService } from '../../services/aiEngine';
import { OrderContextSidebar } from './OrderContextSidebar';

interface InboxViewProps {
  conversations: Conversation[];
  orders: Order[];
  products: Product[];
  policies: StorePolicies;
  settings: StoreSettings;
  activeConvId?: string;
  onSelectConversation?: (convId: string) => void;
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
  activeConvId,
  onSelectConversation,
  onUpdateConversations,
  onOpenOrderModal,
  onShowToast,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(
    activeConvId || conversations[0]?.id || ''
  );
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync when activeConvId is passed or changed from parent
  useEffect(() => {
    if (activeConvId && activeConvId !== selectedConvId) {
      setSelectedConvId(activeConvId);
      // Clean up previous temporary generation results on conversation switch
      setAiResult(null);
      setEditedReply('');
      setIsReviewedByUser(false);
    }
  }, [activeConvId]);

  // Current active conversation
  const activeConversation =
    conversations.find((c) => c.id === selectedConvId) || conversations[0];

  // Active linked order
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    activeConversation?.orderId || ''
  );

  // 串单与竞态防护：跟踪当前处于活动状态的会话与订单 ID，丢弃过期的异步回复请求
  const activeConvIdRef = useRef<string | undefined>(activeConversation?.id);
  const selectedOrderIdRef = useRef<string>(selectedOrderId);
  const currentRequestIdRef = useRef<number>(0);

  useEffect(() => {
    activeConvIdRef.current = activeConversation?.id;
  }, [activeConversation?.id]);

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
  }, [selectedOrderId]);

  useEffect(() => {
    if (activeConversation) {
      setSelectedOrderId(activeConversation.orderId);
      // Clean up previous temporary generation results on conversation switch
      setAiResult(null);
      setEditedReply('');
      setIsReviewedByUser(false);
      setIsGenerating(false);

      const customerMsgs = activeConversation.messages.filter(
        (m) => m.sender === 'customer'
      );
      const lastCust = customerMsgs[customerMsgs.length - 1];
      setCustomerQueryInput(lastCust ? lastCust.content : '');
    }
  }, [activeConversation?.id]);

  const activeOrder = orders.find((o) => o.id === selectedOrderId);
  const activeProduct = activeOrder
    ? products.find((p) => p.id === activeOrder.productId || p.name === activeOrder.productName)
    : undefined;

  // AI Prompt Workspace State
  const [customerQueryInput, setCustomerQueryInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<GeneratedReplyResult | null>(null);
  const [editedReply, setEditedReply] = useState<string>('');
  const [isReviewedByUser, setIsReviewedByUser] = useState<boolean>(false);
  const [isEditedByUser, setIsEditedByUser] = useState<boolean>(false);
  const [showRawBlockedReply, setShowRawBlockedReply] = useState<boolean>(false);
  const [showRightContext, setShowRightContext] = useState(true);
  const [mobileTab, setMobileTab] = useState<'list' | 'chat' | 'detail'>('chat');

  // AI Mode & Local Proxy Server Status
  const [aiMode, setAiMode] = useState<AIMode>('rule');
  const [serverStatus, setServerStatus] = useState<{
    online: boolean;
    configured: boolean;
    model: string;
  }>({
    online: false,
    configured: false,
    model: 'deepseek-flash',
  });

  useEffect(() => {
    AIEngineService.checkServerStatus().then((status) => {
      setServerStatus(status);
    });
  }, []);

  // Switch conversation helper
  const handleSwitchConversation = (convId: string) => {
    // 使当前正在进行的异步请求失效，防止前一个会话的回复串入新选中的会话
    currentRequestIdRef.current += 1;
    setIsGenerating(false);
    setSelectedConvId(convId);
    setMobileTab('chat');
    if (onSelectConversation) {
      onSelectConversation(convId);
    }
    setAiResult(null);
    setEditedReply('');
    setIsReviewedByUser(false);
    setIsEditedByUser(false);
    setShowRawBlockedReply(false);
  };

  // Switch order selector in header
  const handleSwitchOrder = (orderId: string) => {
    // 使当前正在进行的异步请求失效，防止前一个订单的回复串入新选中的订单
    currentRequestIdRef.current += 1;
    setIsGenerating(false);
    setSelectedOrderId(orderId);
    setAiResult(null);
    setEditedReply('');
    setIsReviewedByUser(false);
    setIsEditedByUser(false);
    setShowRawBlockedReply(false);
  };

  // Trigger AI Suggestion
  const handleGenerateReply = async (customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : customerQueryInput).trim();
    if (!q) {
      onShowToast('请输入或选择客户的问题', 'error');
      return;
    }

    const targetConvId = activeConversation?.id;
    const targetOrderId = selectedOrderId;
    const reqId = ++currentRequestIdRef.current;

    setIsGenerating(true);

    if (aiMode === 'deepseek') {
      onShowToast('正在调用本地 DeepSeek 模型研判生成...', 'info');
      try {
        const result = await AIEngineService.generateDeepSeekReply({
          customerQuery: q,
          order: activeOrder,
          product: activeProduct,
          policies,
          settings,
          conversationHistory: activeConversation?.messages,
        });

        // 串单防护：如果用户在请求返回前切换了会话或关联订单，丢弃过期的回复结果
        if (
          reqId !== currentRequestIdRef.current ||
          activeConvIdRef.current !== targetConvId ||
          selectedOrderIdRef.current !== targetOrderId
        ) {
          console.info('[AI Inbox] 检测到用户已切换会话或订单，安全丢弃过期的异步回复结果，防止串单。');
          return;
        }

        setAiResult(result);
        setEditedReply(result.replyText);
        setIsReviewedByUser(false);
        setIsEditedByUser(false);
        setShowRawBlockedReply(false);
        setIsGenerating(false);

        if (result.source === 'deepseek') {
          onShowToast('DeepSeek 已生成建议，业务试用阶段需人工核验把关', 'info');
        } else {
          onShowToast('本地 AI 服务未启动或未配置 API Key，已自动平滑降级至规则引擎', 'info');
        }
      } catch (err: any) {
        if (
          reqId !== currentRequestIdRef.current ||
          activeConvIdRef.current !== targetConvId ||
          selectedOrderIdRef.current !== targetOrderId
        ) {
          return;
        }
        setIsGenerating(false);
        onShowToast(`大模型调用异常: ${err.message}`, 'error');
      }
    } else {
      setTimeout(() => {
        // 串单防护
        if (
          reqId !== currentRequestIdRef.current ||
          activeConvIdRef.current !== targetConvId ||
          selectedOrderIdRef.current !== targetOrderId
        ) {
          return;
        }

        const result = AIEngineService.generateReply({
          customerQuery: q,
          order: activeOrder,
          product: activeProduct,
          policies,
          settings,
          conversationHistory: activeConversation?.messages,
        });

        setAiResult(result);
        setEditedReply(result.replyText);
        setIsReviewedByUser(false);
        setIsEditedByUser(false);
        setShowRawBlockedReply(false);
        setIsGenerating(false);

        if (result.requiresHumanReview) {
          onShowToast('回复已生成，检测到未核实事项，需人工审核确认', 'info');
        } else {
          onShowToast('规则引擎回复生成完毕，已结合订单真实状态与知识库', 'success');
        }
      }, 250);
    }
  };

  // Copy reply to clipboard (with manual edit & factual risk distinction)
  const handleCopyReply = () => {
    if (!editedReply) return;
    navigator.clipboard.writeText(editedReply);
    if (isEditedByUser) {
      onShowToast('已复制人工修改后的回复（该内容由人工编辑，尚未重新安全检查）', 'info');
    } else if (aiResult?.isBlocked) {
      onShowToast('已复制保守核对替代回复（原始未核实回复已被安全阻断）', 'info');
    } else {
      onShowToast('已复制 AI 建议回复（业务试用中，请核对后使用）', 'success');
    }
  };

  // Confirm and Save reply with review enforcement
  const handleConfirmAndSave = () => {
    if (!editedReply.trim() || !activeConversation) return;

    // Determine resolved status
    const isBlocked = Boolean(aiResult?.isBlocked);
    const needsReview = aiResult ? aiResult.requiresHumanReview : false;
    // 阻断回复或需要审核的回复，若未人工勾选审核，严禁直接标记为已解决；用户修改过的文本也必须显式确认审核
    const canResolve = (!needsReview && !isBlocked && !isEditedByUser) || isReviewedByUser;
    const nextStatus: 'in_progress' | 'resolved' = canResolve ? 'resolved' : 'in_progress';

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      content: editedReply.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedByAI: !isEditedByUser,
    };

    const updatedConvs = conversations.map((conv) => {
      if (conv.id === activeConversation.id) {
        return {
          ...conv,
          status: nextStatus,
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
    setIsReviewedByUser(false);
    setIsEditedByUser(false);
    setShowRawBlockedReply(false);

    if (isEditedByUser) {
      if (canResolve) {
        onShowToast('人工修改后的回复已确认审核并保存，工单已标记为已解决', 'success');
      } else {
        onShowToast('人工修改后的回复已保存为“处理中”（尚未勾选确认审核）', 'info');
      }
    } else {
      if (canResolve) {
        onShowToast('模拟回复已审核并保存，工单已标记为已解决', 'success');
      } else if (isBlocked) {
        onShowToast('保守替代回复已保存为“处理中”（原始高危回复已阻断，需人工复核）', 'info');
      } else {
        onShowToast('模拟回复已保存为“处理中”（未确认审核，仍保留在待跟进）', 'info');
      }
    }
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
    onShowToast('模拟回复已添加至本地聊天记录', 'success');
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterStatus === 'pending' && c.status !== 'pending' && c.status !== 'in_progress') return false;
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
      <div className={`w-full lg:w-72 border-r border-zinc-200/80 shrink-0 bg-zinc-50/40 ${mobileTab === 'list' ? 'flex flex-col' : 'hidden lg:flex flex-col'}`}>
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
              待处理
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
                  onClick={() => handleSwitchConversation(conv.id)}
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
                          : 'amber'
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
      <div className={`flex-1 flex-col min-w-0 bg-white ${mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Mobile Navigation Header */}
        <div className="flex lg:hidden items-center justify-between px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 text-xs">
          <button
            onClick={() => setMobileTab('list')}
            className="flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900"
          >
            <span>← 会话列表</span>
          </button>
          <span className="font-semibold text-zinc-800 truncate max-w-[150px]">
            {activeConversation?.customerName}
          </span>
          <button
            onClick={() => setMobileTab('detail')}
            className="flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900"
          >
            <span>订单详情 →</span>
          </button>
        </div>

        {/* Chat Header */}
        {activeConversation ? (
          <div className="px-4 lg:px-5 py-3 border-b border-zinc-100 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 truncate">
                    {activeConversation.customerName}
                  </h3>
                  <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                    ({activeConversation.customerEmail})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-zinc-400 shrink-0">关联订单:</span>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => handleSwitchOrder(e.target.value)}
                    className="text-xs font-mono font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 focus:outline-none max-w-[170px] sm:max-w-[220px] truncate"
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.productName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
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
                  onShowToast('工单状态已切换', 'info');
                }}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 whitespace-nowrap shrink-0"
              >
                {activeConversation.status === 'resolved' ? '设为待处理' : '标记已解决'}
              </button>

              <button
                onClick={() => setShowRightContext(!showRightContext)}
                className="hidden xl:inline-flex text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 whitespace-nowrap shrink-0"
              >
                {showRightContext ? '收起详情' : '展开详情'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/30">
          {activeConversation?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <MessageSquare className="w-8 h-8 stroke-1 text-zinc-300 mb-2" />
              <p className="text-xs font-medium text-zinc-600">模拟客服新工单</p>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-sm">
                当前工单已关联订单 <span className="font-mono text-zinc-700 font-semibold">{activeConversation.orderId}</span>。
                买家暂无历史留言，您可在下方输入客户咨询或选择场景测试生成回复。
              </p>
            </div>
          ) : (
            activeConversation?.messages.map((msg) => {
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
            })
          )}
        </div>

        {/* AI Reply Copilot Zone */}
        <div className="p-4 border-t border-zinc-200/80 bg-white space-y-3 shrink-0">
          {/* Engine Mode Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-zinc-600" />
                回复引擎:
              </span>
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium border border-zinc-200/60">
                <button
                  type="button"
                  onClick={() => setAiMode('rule')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    aiMode === 'rule'
                      ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>模拟规则引擎</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiMode('deepseek');
                    AIEngineService.checkServerStatus().then(setServerStatus);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    aiMode === 'deepseek'
                      ? 'bg-white text-sky-700 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-sky-600" />
                  <span>真实 DeepSeek 模型</span>
                </button>
              </div>
            </div>

            {/* Status pill */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {aiMode === 'deepseek' ? (
                serverStatus.online ? (
                  serverStatus.configured ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      本地服务在线 · 模型: {serverStatus.model}
                    </span>
                  ) : (
                    <span
                      className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium shadow-2xs"
                      title="请在根目录 .env 文件中设置 DEEPSEEK_API_KEY"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      服务在线 · 需在 .env 填入 API Key
                    </span>
                  )
                ) : (
                  <span
                    className="text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                    title="运行 npm run dev:ai 启动本地服务与前端"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                    本地代理未启动 (运行 npm run dev:ai 即可连接)
                  </span>
                )
              ) : (
                <span className="text-zinc-400">确定性领域规则 · 离线零依赖</span>
              )}
            </div>
          </div>

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
              '有配套收纳包吗？',
              '支持开具发票吗？'
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomerQueryInput(preset);
                  handleGenerateReply(preset);
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
              onClick={() => handleGenerateReply()}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 shrink-0 text-white ${
                aiMode === 'deepseek'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500'
                  : 'bg-zinc-900 hover:bg-zinc-800'
              }`}
            >
              {aiMode === 'deepseek' ? (
                <Cpu className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {isGenerating
                  ? aiMode === 'deepseek'
                    ? 'DeepSeek 模型研判中...'
                    : '正在研判订单与规则...'
                  : aiMode === 'deepseek'
                  ? 'DeepSeek 生成回复'
                  : '规则引擎生成'}
              </span>
            </button>
          </div>

          {/* AI Suggestion Box (Editable + Actionable) */}
          {aiResult && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-sky-50/40 via-white to-white border border-sky-200/80 shadow-xs space-y-3 animate-in fade-in">
              {/* Header */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pb-2.5 border-b border-sky-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md text-white flex items-center justify-center shrink-0 ${
                      aiResult.source === 'deepseek' ? 'bg-indigo-600' : 'bg-sky-600'
                    }`}
                  >
                    {aiResult.source === 'deepseek' ? (
                      <Cpu className="w-3 h-3" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 whitespace-nowrap">
                      {aiResult.source === 'deepseek'
                        ? 'DeepSeek 大模型建议回复'
                        : 'AI 建议回复 (规则引擎)'}
                    </span>
                    <span className="text-[10px] text-sky-700 bg-sky-100/60 px-1.5 py-0.5 rounded border border-sky-200/50 whitespace-nowrap">
                      {aiResult.source === 'deepseek'
                        ? `${aiResult.model || 'deepseek-chat'} · 独立安全审查`
                        : '事实对齐 · 商业隐私已脱敏'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    onClick={handleCopyReply}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    <span>复制回复</span>
                  </button>

                  <button
                    onClick={handleConfirmAndSave}
                    className={`inline-flex items-center gap-1.5 text-[11px] text-white px-3 py-1.5 rounded-md font-semibold transition-colors shadow-2xs whitespace-nowrap shrink-0 ${
                      aiResult.requiresHumanReview && !isReviewedByUser
                        ? 'bg-amber-700 hover:bg-amber-800'
                        : 'bg-zinc-900 hover:bg-zinc-800'
                    }`}
                    title={
                      aiResult.requiresHumanReview && !isReviewedByUser
                        ? '保存为待人工复核的工单记录'
                        : '确认保存回复并将工单标记为已解决'
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {aiResult.requiresHumanReview && !isReviewedByUser
                        ? '保存模拟回复 (待复核)'
                        : '保存模拟回复 (已审核)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Factual Safety Risk Banner (🚨 Critical Block Banner) */}
              {aiResult.isBlocked ? (
                <div className="p-3 rounded-lg bg-rose-50/90 border border-rose-200 text-rose-900 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>🚨 原始回复包含未核实事实风险，已被系统安全阻断并替换为保守回复</span>
                    </div>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-rose-300 text-[11px] font-semibold text-rose-900 hover:bg-rose-100/50 shadow-2xs transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={isReviewedByUser}
                        onChange={(e) => setIsReviewedByUser(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>我已人工核验并确认此回复 (确认审核)</span>
                    </label>
                  </div>

                  <div className="space-y-0.5 text-[11px] text-rose-800/90 pl-5">
                    <div className="font-semibold text-rose-950">事实风险拦截原因：</div>
                    {(aiResult.factualRiskReasons && aiResult.factualRiskReasons.length > 0
                      ? aiResult.factualRiskReasons
                      : aiResult.reviewReasons
                    ).map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : aiResult.hasConflict ? (
                /* Historical Conflict Banner (⚠️ Warning without Block) */
                <div className="p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ 检测到历史客服承诺与知识库存在差异（需人工复核，未作强制阻断）</span>
                    </div>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-amber-300 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/50 shadow-2xs transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={isReviewedByUser}
                        onChange={(e) => setIsReviewedByUser(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>我已人工核验无误 (确认审核)</span>
                    </label>
                  </div>

                  <div className="space-y-0.5 text-[11px] text-amber-800/90 pl-5">
                    <div className="font-semibold text-amber-900">需要核实的历史差异说明：</div>
                    {aiResult.reviewReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : aiResult.requiresHumanReview ? (
                /* Human Review Required Alert Banner (Trial Phase Banner) */
                <div className="p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ 该回复需人工审核（业务试用阶段，未完成审核前不可直接标记为已解决）</span>
                    </div>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-amber-300 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/50 shadow-2xs transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={isReviewedByUser}
                        onChange={(e) => setIsReviewedByUser(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>我已人工核验无误 (确认审核)</span>
                    </label>
                  </div>

                  <div className="space-y-0.5 text-[11px] text-amber-800/90 pl-5">
                    <div className="font-semibold text-amber-900">审核把关提示：</div>
                    {aiResult.reviewReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Ordinary Style Advisories Box (Separated from Factual Risks) */}
              {aiResult.styleAdvisories && aiResult.styleAdvisories.length > 0 && (
                <div className="p-2.5 rounded-lg bg-sky-50/60 border border-sky-100 text-[11px] text-sky-900 space-y-1">
                  <div className="font-semibold text-sky-950 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-sky-600" />
                    <span>💡 表达风格优化建议（非事实安全阻断）：</span>
                  </div>
                  <div className="space-y-0.5 text-sky-800 pl-4">
                    {aiResult.styleAdvisories.map((adv, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{adv}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning steps breadcrumbs */}
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-800 flex items-center gap-1">
                  <Info className="w-3 h-3 text-sky-500" />
                  <span>商家后台研判依据（买家端已自动隐去供货商与成本隐私）：</span>
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

              {/* Distinct view for Safe Usable Reply vs Raw Blocked Reply vs Edited */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                  {isEditedByUser ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-amber-800 font-bold">
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        ✍️ 商家自定义编辑内容（尚未重新进行安全检查）
                      </span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-normal">
                        未经验证
                      </span>
                    </div>
                  ) : aiResult.isBlocked ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-sky-800 font-bold">
                        <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
                        🛡️ 保守核对替代回复（原回复已阻断，需人工确认）
                      </span>
                      <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded font-normal">
                        保守替代
                      </span>
                    </div>
                  ) : aiResult.hasConflict ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-indigo-800 font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        💬 AI 冲突澄清建议（待人工核实确认）
                      </span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-normal">
                        待核验
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-zinc-800 font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
                        💬 AI 建议回复（待人工核对）
                      </span>
                      <span className="text-[10px] text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-normal">
                        待核验
                      </span>
                    </div>
                  )}

                  {aiResult.isBlocked && aiResult.rawReply && (
                    <button
                      type="button"
                      onClick={() => setShowRawBlockedReply(!showRawBlockedReply)}
                      className="text-[11px] text-zinc-500 hover:text-rose-700 underline flex items-center gap-1 font-normal ml-auto"
                    >
                      {showRawBlockedReply ? '隐藏原始未核实回复' : '查看原始未核实回复 (高危已阻断)'}
                    </button>
                  )}
                </div>

                {showRawBlockedReply && aiResult.rawReply && (
                  <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-rose-800">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>原始未核实回复（包含高风险内容，已阻断，严禁直接对外发送）：</span>
                    </div>
                    <div className="p-2 bg-white/90 rounded border border-rose-100 font-mono text-[11px] text-rose-800 whitespace-pre-wrap">
                      {aiResult.rawReply}
                    </div>
                  </div>
                )}

                {/* Textarea for editing the safe verified reply */}
                <div className="relative">
                  <textarea
                    rows={4}
                    value={editedReply}
                    onChange={(e) => {
                      setEditedReply(e.target.value);
                      setIsEditedByUser(true);
                      setIsReviewedByUser(false);
                    }}
                    className="w-full text-xs p-3 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 font-sans leading-relaxed text-zinc-800"
                    placeholder="在此直接编辑修改回复内容..."
                  />
                </div>
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
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
                title="保存模拟回复记录"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>保存回复</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Panel: Order & Context Drawer */}
      {showRightContext && (
        <div className={`w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-200/80 bg-zinc-50/50 shrink-0 ${mobileTab === 'detail' ? 'flex flex-col' : 'hidden lg:flex flex-col'}`}>
          {/* Mobile Back Button */}
          <div className="flex lg:hidden items-center justify-between p-3.5 bg-zinc-50 border-b border-zinc-200 text-xs font-medium">
            <button
              onClick={() => setMobileTab('chat')}
              className="flex items-center gap-1 text-zinc-700 hover:text-zinc-900"
            >
              <span>← 返回客服会话</span>
            </button>
            <span className="font-mono text-zinc-500">{activeOrder?.id}</span>
          </div>

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
