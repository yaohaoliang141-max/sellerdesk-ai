import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Package,
  Truck,
  RotateCcw,
  HelpCircle,
  Edit2,
  Trash2,
  Save,
  CheckCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { Product, StorePolicies } from '../../types';
import { ProductModal } from './ProductModal';

interface KnowledgeViewProps {
  products: Product[];
  policies: StorePolicies;
  onUpdateProducts: (products: Product[]) => void;
  onUpdatePolicies: (policies: StorePolicies) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  products,
  policies,
  onUpdateProducts,
  onUpdatePolicies,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'shipping' | 'returns' | 'faq'>('products');

  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Policy text local state
  const [shippingText, setShippingText] = useState(policies.shippingRules);
  const [returnText, setReturnText] = useState(policies.returnPolicy);

  // FAQ state
  const [faqList, setFaqList] = useState(policies.faqList);
  const [newFaqCategory, setNewFaqCategory] = useState('综合售后');
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  // Handle Save Products
  const handleSaveProduct = (prod: Product) => {
    const exists = products.find((p) => p.id === prod.id);
    let next: Product[];
    if (exists) {
      next = products.map((p) => (p.id === prod.id ? prod : p));
      onShowToast(`商品 ${prod.name} 知识已更新`, 'success');
    } else {
      next = [prod, ...products];
      onShowToast(`商品 ${prod.name} 已成功录入知识库`, 'success');
    }
    onUpdateProducts(next);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`确定要删除商品【${name}】吗？`)) {
      const next = products.filter((p) => p.id !== id);
      onUpdateProducts(next);
      onShowToast(`商品 ${name} 已从知识库移除`, 'info');
    }
  };

  // Handle Save Policies
  const handleSaveShippingRules = () => {
    const updated = { ...policies, shippingRules: shippingText };
    onUpdatePolicies(updated);
    onShowToast('发货与物流履约规则已成功保存！AI 客服将实时同步此规则', 'success');
  };

  const handleSaveReturnPolicy = () => {
    const updated = { ...policies, returnPolicy: returnText };
    onUpdatePolicies(updated);
    onShowToast('退换货售后政策已成功保存！AI 客服已更新知识依据', 'success');
  };

  // Handle FAQ CRUD
  const handleAddFaq = () => {
    if (!newFaqQ.trim() || !newFaqA.trim()) {
      onShowToast('请完整输入问题和答案', 'error');
      return;
    }
    const newFaq = {
      id: `faq-${Date.now()}`,
      category: newFaqCategory,
      question: newFaqQ.trim(),
      answer: newFaqA.trim(),
    };
    const nextFaq = [...faqList, newFaq];
    setFaqList(nextFaq);
    onUpdatePolicies({ ...policies, faqList: nextFaq });
    setNewFaqQ('');
    setNewFaqA('');
    onShowToast('新 FAQ 问答已保存至知识库', 'success');
  };

  const handleDeleteFaq = (id: string) => {
    const nextFaq = faqList.filter((f) => f.id !== id);
    setFaqList(nextFaq);
    onUpdatePolicies({ ...policies, faqList: nextFaq });
    onShowToast('FAQ 问答已删除', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">
              商品与商家履约知识库
            </h2>
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[11px] font-semibold flex items-center gap-1 border border-sky-100">
              <Sparkles className="w-3 h-3" />
              SellerDesk 事实对齐引擎
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            此处维护的所有商品规格、发货标准和退货政策，均为 AI 客服生成建议时的底层事实源。
          </p>
        </div>

        {activeTab === 'products' && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加新商品</span>
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex rounded-xl bg-zinc-100 p-1 text-xs font-medium text-zinc-600 max-w-xl">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
            activeTab === 'products'
              ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
              : 'hover:text-zinc-900'
          }`}
        >
          <Package className="w-3.5 h-3.5 text-sky-600" />
          <span>商品库 ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
            activeTab === 'shipping'
              ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
              : 'hover:text-zinc-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-amber-600" />
          <span>发货与时效规则</span>
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
            activeTab === 'returns'
              ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
              : 'hover:text-zinc-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          <span>退换货政策</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
            activeTab === 'faq'
              ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
              : 'hover:text-zinc-900'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>常见问答 ({faqList.length})</span>
        </button>
      </div>

      {/* Tab 1: Products List */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-100">
                  <div>
                    <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {product.sku}
                    </span>
                    <h3 className="font-semibold text-sm text-zinc-900 mt-1">
                      {product.name}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-zinc-900">
                    ¥{product.price.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400 font-medium">规格参数:</span>
                    <p className="text-zinc-600 mt-0.5 leading-relaxed bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      {product.specs || '暂无规格说明'}
                    </p>
                  </div>

                  <div className="flex justify-between text-zinc-500 pt-1">
                    <span>采购成本: ¥{product.cost.toFixed(2)}</span>
                    <span>库存余量: {product.stock} 件</span>
                  </div>

                  {product.faqList && product.faqList.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100">
                      <span className="text-[11px] font-medium text-sky-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        包含 {product.faqList.length} 条专属问答对
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingProduct(product);
                    setIsProductModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>编辑</span>
                </button>
                <button
                  onClick={() => handleDeleteProduct(product.id, product.name)}
                  className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50/60 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>删除</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Shipping Rules */}
      {activeTab === 'shipping' && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-xs space-y-4 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">发货与物流履约准则</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                当客户询问“什么时候发货”、“到江浙沪几天”时，AI 引擎将严格参考此处的条目生成答复
              </p>
            </div>
            <button
              onClick={handleSaveShippingRules}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存发货规则</span>
            </button>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">核心业务协同：</span>
              已采购但未发货订单（如 XY-1001 / CG-8001），系统会结合此处规则告知客户正在质检打包装，严禁编造虚假快递单号。
            </div>
          </div>

          <textarea
            rows={10}
            value={shippingText}
            onChange={(e) => setShippingText(e.target.value)}
            className="w-full text-xs p-4 bg-zinc-50/60 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono leading-relaxed text-zinc-800"
          />
        </div>
      )}

      {/* Tab 3: Return Policy */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-xs space-y-4 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">退换货与售后规则</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                客户申请退款、换货或咨询破损补发时，AI 将提取此处的退货仓库地址与时效保障
              </p>
            </div>
            <button
              onClick={handleSaveReturnPolicy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存退货政策</span>
            </button>
          </div>

          <textarea
            rows={10}
            value={returnText}
            onChange={(e) => setReturnText(e.target.value)}
            className="w-full text-xs p-4 bg-zinc-50/60 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono leading-relaxed text-zinc-800"
          />
        </div>
      )}

      {/* Tab 4: FAQ Knowledge Base */}
      {activeTab === 'faq' && (
        <div className="space-y-4 max-w-4xl">
          {/* Add New FAQ Card */}
          <div className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-zinc-900">新增通用问答条目</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">分类</label>
                <input
                  type="text"
                  value={newFaqCategory}
                  onChange={(e) => setNewFaqCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-zinc-500 mb-1">客户常见问题</label>
                <input
                  type="text"
                  placeholder="例如：支持开增值税专用发票吗？"
                  value={newFaqQ}
                  onChange={(e) => setNewFaqQ(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">标准应答方案</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="例如：支持开具电子发票与专票，下单后联系客服备注抬头及税号即可。"
                  value={newFaqA}
                  onChange={(e) => setNewFaqA(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddFaq}
                  className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800"
                >
                  添加
                </button>
              </div>
            </div>
          </div>

          {/* Existing FAQ items */}
          <div className="space-y-3">
            {faqList.map((faq) => (
              <div
                key={faq.id}
                className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[11px] border border-sky-100">
                      {faq.category}
                    </span>
                    <span className="font-bold text-zinc-900">问：{faq.question}</span>
                  </div>
                  <p className="text-zinc-600 leading-relaxed pl-1">答：{faq.answer}</p>
                </div>

                <button
                  onClick={() => handleDeleteFaq(faq.id)}
                  className="text-zinc-400 hover:text-rose-600 p-1 rounded transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Edit / Add Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={editingProduct}
        onSaveProduct={handleSaveProduct}
      />
    </div>
  );
};
