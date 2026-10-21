export type OrderStatus =
  | 'pending_payment'
  | 'paid_pending_shipment'
  | 'shipped'
  | 'delivered'
  | 'refund_requested'
  | 'refunded';

export type PurchaseOrderStatus =
  | 'supplier_processing'
  | 'procured_pending_shipment'
  | 'supplier_shipped'
  | 'warehouse_received';

export interface PurchaseOrder {
  id: string; // e.g. "CG-8001"
  supplierName: string;
  status: PurchaseOrderStatus;
  costAmount: number;
  trackingNumber?: string;
  notes?: string;
  updatedAt: string;
}

export interface Order {
  id: string; // e.g. "XY-1001"
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  productId: string;
  productName: string;
  quantity: number;
  amount: number;
  currency: string;
  orderStatus: OrderStatus;
  createdAt: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  notes?: string;
  purchaseOrder?: PurchaseOrder;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  description: string;
  specs: string;
  faqList: { question: string; answer: string }[];
}

export interface Message {
  id: string;
  sender: 'customer' | 'agent' | 'ai';
  content: string;
  timestamp: string;
  suggestedByAI?: boolean;
}

export interface Conversation {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  status: 'pending' | 'in_progress' | 'resolved';
  lastMessage: string;
  updatedAt: string;
  messages: Message[];
}

export interface StorePolicies {
  shippingRules: string;
  returnPolicy: string;
  faqList: { id: string; category: string; question: string; answer: string }[];
}

export interface StoreSettings {
  storeName: string;
  brandTone: 'professional' | 'warm' | 'concise';
  signature: string;
  autoQuoteOrder: boolean;
  notifyEmail: string;
  currencySymbol: string;
}

export type AIMode = 'rule' | 'deepseek';

export interface GeneratedReplyResult {
  replyText: string;
  reasoningSteps: string[];
  intent: 'logistics' | 'return_refund' | 'product_inquiry' | 'urgent_shipping' | 'general';
  confidence: number;
  requiresHumanReview: boolean;
  reviewReasons: string[];
  source?: 'rule' | 'deepseek';
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}
