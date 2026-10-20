import React, { useState } from 'react';
import { Sidebar, TabType } from './Sidebar';
import { Header } from './Header';
import { ToastContainer, ToastMessage } from '../common/Toast';

interface LayoutProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingInboxCount: number;
  storeName: string;
  onResetData: () => void;
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onTabChange,
  pendingInboxCount,
  storeName,
  onResetData,
  toasts,
  onDismissToast,
  children
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] flex font-sans antialiased text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={onTabChange}
        pendingInboxCount={pendingInboxCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          storeName={storeName}
          onResetData={onResetData}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Toasts */}
      <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
    </div>
  );
};
