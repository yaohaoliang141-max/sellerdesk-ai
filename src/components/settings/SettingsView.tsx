import React, { useState } from 'react';
import {
  Settings,
  Bot,
  Store,
  Database,
  Cpu,
  Save,
  RotateCcw,
  Download,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { StoreSettings } from '../../types';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
  onResetData: () => void;
  onExportData: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
  onExportData,
  onShowToast,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });

  // Optional placeholder for future DeepSeek and Supabase keys
  const [deepseekKey, setDeepseekKey] = useState(
    localStorage.getItem('sellerdesk_deepseek_key') || ''
  );
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('sellerdesk_supabase_url') || ''
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    localStorage.setItem('sellerdesk_deepseek_key', deepseekKey);
    localStorage.setItem('sellerdesk_supabase_url', supabaseUrl);
    onShowToast('系统设置与客服风格偏好已成功保存！', 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Description */}
      <div className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">
            店铺与 AI 人设偏好配置
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            配置店铺品牌形象、AI 客服回复语气，以及预留的 DeepSeek & Supabase 云端接入通道。
          </p>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存配置</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Store profile */}
        <div className="p-6 rounded-xl bg-white border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Store className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-zinc-900">店铺基本资料</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">店铺对外展示名称</label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">客服及通知邮箱</label>
              <input
                type="email"
                value={formData.notifyEmail}
                onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">默认币种符号</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 2: AI Tone & Persona */}
        <div className="p-6 rounded-xl bg-white border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Bot className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-zinc-900">AI 客服人设与回复基调</h3>
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-2">回复基调风格 (Tone)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'professional' as const,
                  title: '专业严谨 (默认推荐)',
                  desc: '措辞规范有礼，重点清晰，条理分明，适合品牌自营与高客单产品',
                },
                {
                  id: 'warm' as const,
                  title: '亲切温馨',
                  desc: '使用“亲亲您好”温馨称呼与轻量 Emoji，语气热情活泼',
                },
                {
                  id: 'concise' as const,
                  title: '极简高效',
                  desc: '直奔要点，解答直率，无过多客套修辞，适合快消与技术支持',
                },
              ].map((style) => (
                <div
                  key={style.id}
                  onClick={() => setFormData({ ...formData, brandTone: style.id })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    formData.brandTone === style.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 text-zinc-800'
                  }`}
                >
                  <div className="font-semibold text-xs mb-1">{style.title}</div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      formData.brandTone === style.id ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {style.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-zinc-700 font-medium mb-1">
              客服消息结尾落款签名
            </label>
            <input
              type="text"
              value={formData.signature}
              onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none text-xs"
              placeholder="例如：—— SellerDesk AI 客服小助手"
            />
          </div>
        </div>

        {/* Section 3: Future Integration Roadmap */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-zinc-900">
                未来云端与大模型无缝扩展架构
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
              架构已预留
            </span>
          </div>

          <p className="text-zinc-500 leading-relaxed text-xs">
            系统采用清晰的服务分层（<code>StorageService</code>、<code>AIEngineService</code>）。未来接入真实云端服务时无需重写界面组件。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* DeepSeek API Card */}
            <div className="p-4 rounded-xl bg-white border border-zinc-200/80 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-zinc-900">
                <Cpu className="w-4 h-4 text-sky-600" />
                <span>DeepSeek AI 大模型 API</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                可接入 <code>deepseek-chat</code> 或 <code>deepseek-reasoner</code>。只需在 <code>aiEngine.ts</code> 中把本地规则引擎切换为向 DeepSeek 发起 HTTP 请求。
              </p>
              <input
                type="password"
                placeholder="sk-deepseek-api-key (预留密钥输入)"
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
              />
            </div>

            {/* Supabase Database Card */}
            <div className="p-4 rounded-xl bg-white border border-zinc-200/80 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-zinc-900">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Supabase PostgreSQL 数据库</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                只需使用 <code>@supabase/supabase-js</code>，把 <code>storage.ts</code> 内的 <code>localStorage</code> 替换为对应的数据表查询。
              </p>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co (预留URL)"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Data Management & Backup */}
        <div className="p-6 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-zinc-900">演示数据维护与重置</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              可随时导出当前浏览器 localStorage 中的全部订单、商品与聊天记录备份，或恢复到纯净初始演示数据。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 JSON</span>
            </button>

            <button
              type="button"
              onClick={onResetData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复演示数据</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
