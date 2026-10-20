import React from 'react';
import {
  LayoutDashboard,
  MessageSquareText,
  Package,
  BookOpen,
  Settings as SettingsIcon,
  Sparkles,
  Bot,
  Layers
} from 'lucide-react';

export type TabType = 'overview' | 'inbox' | 'orders' | 'knowledge' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingInboxCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  pendingInboxCount,
  isOpenMobile,
  onCloseMobile
}) => {
  const menuItems = [
    {
      id: 'overview' as TabType,
      label: 'Overview',
      labelZh: '总览',
      icon: LayoutDashboard,
    },
    {
      id: 'inbox' as TabType,
      label: 'AI Inbox',
      labelZh: 'AI 客服',
      icon: MessageSquareText,
      badge: pendingInboxCount > 0 ? pendingInboxCount : undefined,
    },
    {
      id: 'orders' as TabType,
      label: 'Orders',
      labelZh: '订单管理',
      icon: Package,
    },
    {
      id: 'knowledge' as TabType,
      label: 'Knowledge Base',
      labelZh: '商品知识库',
      icon: BookOpen,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      labelZh: '系统设置',
      icon: SettingsIcon,
    },
  ];

  const handleSelect = (id: TabType) => {
    onTabChange(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-zinc-200/80 flex flex-col justify-between z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand header */}
          <div className="h-16 px-5 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm ring-1 ring-zinc-800">
                <Sparkles className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight text-zinc-900">SellerDesk</span>
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.2 bg-sky-100 text-sky-700 rounded uppercase">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">智能客服与协同中台</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="px-3 py-4 flex-1 overflow-y-auto space-y-1">
            <div className="px-3 pb-2 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              主要模块
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-sky-400' : 'text-zinc-400 group-hover:text-zinc-600'
                      }`}
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium">{item.label}</span>
                      <span className={`text-[11px] ${isActive ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        {item.labelZh}
                      </span>
                    </div>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        isActive
                          ? 'bg-sky-500 text-white'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-6 px-3 pb-2 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              系统架构模式
            </div>

            <div className="px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                <Bot className="w-3.5 h-3.5 text-sky-600" />
                <span>Siena 级知识对齐</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                当前运行在本地离线规则引擎。未来可在设置中无缝开启 DeepSeek 智能大模型与 Supabase 云同步。
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-zinc-400">
                <Layers className="w-3 h-3 text-emerald-500" />
                <span>采购单 & 销售单智能关联中</span>
              </div>
            </div>
          </div>

          {/* User profile / Store quick indicator */}
          <div className="p-3 border-t border-zinc-100">
            <div className="p-2.5 rounded-lg bg-zinc-50 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                SD
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-800 truncate">Demo Store</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>AI 规则就绪</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
