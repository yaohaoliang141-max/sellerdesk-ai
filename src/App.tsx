import React, { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { TabType } from './components/layout/Sidebar';
import { OverviewView } from './components/overview/OverviewView';
import { InboxView } from './components/inbox/InboxView';
import { OrdersView } from './components/orders/OrdersView';
import { KnowledgeView } from './components/knowledge/KnowledgeView';
import { SettingsView } from './components/settings/SettingsView';
import { OrderModal } from './components/orders/OrderModal';
import { ToastMessage } from './components/common/Toast';
import { StorageService } from './services/storage';
import { Order, Product, Conversation, StorePolicies, StoreSettings } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('overview');

  // Domain states synchronized with localStorage
  const [orders, setOrders] = useState<Order[]>(() => StorageService.getOrders());
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    StorageService.getConversations()
  );
  const [policies, setPolicies] = useState<StorePolicies>(() => StorageService.getPolicies());
  const [settings, setSettings] = useState<StoreSettings>(() => StorageService.getSettings());

  // Global Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global Order Modal State
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);

  // Sync state mutations to storage
  const handleUpdateOrders = (newOrders: Order[]) => {
    setOrders(newOrders);
    StorageService.saveOrders(newOrders);
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    StorageService.saveProducts(newProducts);
  };

  const handleUpdateConversations = (newConvs: Conversation[]) => {
    setConversations(newConvs);
    StorageService.saveConversations(newConvs);
  };

  const handleUpdatePolicies = (newPolicies: StorePolicies) => {
    setPolicies(newPolicies);
    StorageService.savePolicies(newPolicies);
  };

  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
  };

  const handleResetData = () => {
    if (confirm('确定要重置所有演示数据吗？已保存的修改将恢复为默认测试数据。')) {
      StorageService.resetAll();
      setOrders(StorageService.getOrders());
      setProducts(StorageService.getProducts());
      setConversations(StorageService.getConversations());
      setPolicies(StorageService.getPolicies());
      setSettings(StorageService.getSettings());
      showToast('演示数据已重置至初始状态', 'info');
    }
  };

  const handleExportData = () => {
    const exportBundle = {
      orders,
      products,
      conversations,
      policies,
      settings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sellerdesk-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出为 JSON 备份文件', 'success');
  };

  const pendingInboxCount = conversations.filter((c) => c.status === 'pending').length;

  return (
    <Layout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      pendingInboxCount={pendingInboxCount}
      storeName={settings.storeName}
      onResetData={handleResetData}
      toasts={toasts}
      onDismissToast={handleDismissToast}
    >
      {currentTab === 'overview' && (
        <OverviewView
          orders={orders}
          conversations={conversations}
          onNavigate={setCurrentTab}
        />
      )}

      {currentTab === 'inbox' && (
        <InboxView
          conversations={conversations}
          orders={orders}
          products={products}
          policies={policies}
          settings={settings}
          onUpdateConversations={handleUpdateConversations}
          onOpenOrderModal={(order) => setActiveModalOrder(order)}
          onShowToast={showToast}
        />
      )}

      {currentTab === 'orders' && (
        <OrdersView
          orders={orders}
          onUpdateOrders={handleUpdateOrders}
          onNavigate={setCurrentTab}
          onShowToast={showToast}
        />
      )}

      {currentTab === 'knowledge' && (
        <KnowledgeView
          products={products}
          policies={policies}
          onUpdateProducts={handleUpdateProducts}
          onUpdatePolicies={handleUpdatePolicies}
          onShowToast={showToast}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetData={handleResetData}
          onExportData={handleExportData}
          onShowToast={showToast}
        />
      )}

      {/* Global Order Edit Modal */}
      <OrderModal
        isOpen={!!activeModalOrder}
        onClose={() => setActiveModalOrder(null)}
        order={activeModalOrder}
        onSaveOrder={(updated) => {
          handleUpdateOrders(orders.map((o) => (o.id === updated.id ? updated : o)));
          showToast(`订单 ${updated.id} 已更新`, 'success');
        }}
      />
    </Layout>
  );
};

export default App;
