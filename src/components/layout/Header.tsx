import React from 'react';
import { Menu, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { TabType } from './Sidebar';

interface HeaderProps {
  currentTab: TabType;
  onOpenMobileSidebar: () => void;
  storeName: string;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  storeName,
  onResetData,
}) => {
  const titles: Record<TabType, { en: string; zh: string; desc: string }> = {
    overview: {
      en: 'Overview',
      zh: '业务总览',
      desc: '实时监控店铺订单履约动态、AI 回复效率与待办事项'
    },
    inbox: {
      en: 'AI Inbox',
      zh: '智能客服工单',
      desc: '基于真实订单与采购协同状态，由 AI 规则引擎生成高确定性建议回复'
    },
    orders: {
      en: 'Orders',
      zh: '订单与采购协同',
      desc: '管理终端销售订单及对应的源头供应商采购单状态'
    },
    knowledge: {
      en: 'Knowledge Base',
      zh: '商品与履约知识库',
      desc: '维护商品规格、发货时效标准及退换货政策，为 AI 提供精准事实支撑'
    },
    settings: {
      en: 'Settings',
      zh: '系统设置',
      desc: '自定义店铺名称、AI 回复人设语气、落款与未来服务接入配置'
    }
  };

  const current = titles[currentTab];

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-1.5 -ml-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-zinc-900 tracking-tight">
              {current.zh}
            </h1>
            <span className="text-xs text-zinc-400 font-normal">/ {current.en}</span>
          </div>
          <p className="hidden sm:block text-xs text-zinc-500 mt-0.5">
            {current.desc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="font-medium truncate max-w-[180px]">{storeName}</span>
        </div>

        <button
          onClick={onResetData}
          title="重置测试数据"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">重置演示数据</span>
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <span>文档</span>
          <ExternalLink className="w-3 h-3 text-zinc-400" />
        </a>
      </div>
    </header>
  );
};
