import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { Modal } from '../common/Modal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveProduct: (prod: Product) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSaveProduct,
}) => {
  const [formData, setFormData] = useState<Product>({
    id: `prod-${Date.now()}`,
    sku: '',
    name: '',
    category: '家居饰品',
    price: 99.0,
    cost: 30.0,
    stock: 50,
    description: '',
    specs: '',
    faqList: [],
  });

  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');

  useEffect(() => {
    if (product) {
      setFormData(JSON.parse(JSON.stringify(product)));
    } else {
      setFormData({
        id: `prod-${Date.now()}`,
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        category: '家居饰品',
        price: 99.0,
        cost: 30.0,
        stock: 50,
        description: '',
        specs: '',
        faqList: [],
      });
    }
  }, [product, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSaveProduct(formData);
    onClose();
  };

  const handleAddFaq = () => {
    if (!faqQ.trim() || !faqA.trim()) return;
    setFormData({
      ...formData,
      faqList: [...formData.faqList, { question: faqQ.trim(), answer: faqA.trim() }],
    });
    setFaqQ('');
    setFaqA('');
  };

  const handleRemoveFaq = (index: number) => {
    setFormData({
      ...formData,
      faqList: formData.faqList.filter((_, i) => i !== index),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? '编辑商品知识库信息' : '添加新商品至知识库'}
      subtitle="商品规格参数与问答对将直接喂入 AI 客服引擎作为解答事实依据"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-700 font-medium mb-1">商品名称</label>
            <input
              type="text"
              required
              placeholder="例如：复古装饰画"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">SKU 编码</label>
            <input
              type="text"
              required
              placeholder="例如：ART-DECOR-01"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">商品分类</label>
            <input
              type="text"
              placeholder="例如：家居饰品 / 数码生活"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">售价 (¥)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-700 font-medium mb-1">采购成本 (¥)</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-700 font-medium mb-1">库存</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full px-2.5 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-zinc-700 font-medium mb-1">
            规格与属性描述 (AI 优先引用)
          </label>
          <input
            type="text"
            placeholder="例如：尺寸: 40x60cm; 画框: 原木色纯实木; 包含专用金属无痕挂钩"
            value={formData.specs}
            onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
            className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-zinc-700 font-medium mb-1">商品完整介绍</label>
          <textarea
            rows={2}
            placeholder="描述商品的特点、材质及工艺..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-white text-zinc-800 border border-zinc-200 rounded-lg focus:outline-none"
          />
        </div>

        {/* Product FAQs */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
          <span className="font-semibold text-zinc-800 block">
            专属商品常见问题 (FAQ 知识点)
          </span>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {formData.faqList.map((faq, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-zinc-200/80 text-[11px]"
              >
                <div>
                  <span className="font-medium text-zinc-900 block">问: {faq.question}</span>
                  <span className="text-zinc-600 block mt-0.5">答: {faq.answer}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFaq(idx)}
                  className="text-rose-500 hover:text-rose-700 font-medium"
                >
                  删除
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-200/80">
            <input
              type="text"
              placeholder="问题 (如: 画框是什么材质？)"
              value={faqQ}
              onChange={(e) => setFaqQ(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded text-xs"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="解答 (如: 精选新西兰进口松木实木...)"
                value={faqA}
                onChange={(e) => setFaqA(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded text-xs"
              />
              <button
                type="button"
                onClick={handleAddFaq}
                className="px-3 py-1.5 bg-zinc-800 text-white rounded text-xs font-medium hover:bg-zinc-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
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
            保存商品知识
          </button>
        </div>
      </form>
    </Modal>
  );
};
