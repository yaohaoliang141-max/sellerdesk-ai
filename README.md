# SellerDesk AI ⚡

> 参考 Siena AI 核心业务模式、独立开发的轻量级跨境与独立站智能客服及协同订单管理系统。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

## 🌟 项目特色

1. **真实供应链协同，绝不捏造物流**
   - 销售订单（例如 `XY-1001`）与供应商采购订单（例如 `CG-8001`）双向打通。
   - 当采购状态为“已采购，待发货”时，客服 AI 严格依据真实生产检验进度回应客户，拒绝凭空编造假单号。
2. **知识库双向对齐（Siena 模式）**
   - 动态调取商品规格属性（如松木实木框、附赠无痕挂钩等）、发货时效规范（48小时质检发出）、7天无理由退换货政策与 FAQ 知识库。
3. **极简 SaaS 设计风格**
   - 借鉴 Linear 与 Notion 的专业极简视觉标准，支持深浅灰阶对比、清晰状态标签、等宽字体单号与全响应式布局（适配桌面端与移动端）。
4. **一键生成与人工把关**
   - 支持智能生成回复、决策依据透明追溯、直接在线二次编辑、一键复制到剪贴板与保存模拟回复。
5. **本地存储与离线零依赖**
   - 第一版所有数据保存在浏览器 `localStorage` 中，支持一键重置与导出 JSON 备份，无需配置任何后端即可即开即用。
6. **安全免密钥泄露架构**
   - 绝不在公开前端网页中保存或暴露私有大模型 API Key。未来接入大模型采用受保护的服务端代理。
7. **事实约束与完备测试**
   - 内置针对物流、退款与商品知识库的自动化校验测试（`npm test`），杜绝生成任何未经订单证实的发货承诺、虚构物流、虚构地址或退款时限。

---

## 🧭 功能模块

- **Overview（总览）**：实时监测订单量、待发货订单、待回复消息、已完成会话与 AI 采纳率指标。
- **AI Inbox（AI 客服）**：类似聊天软件的工作台，查看客户消息流、关联订单详情，一键生成依据供应链事实的建议答复。
- **Orders（订单协同）**：查看、搜索、筛选和编辑销售订单与采购订单，支持新增模拟测试订单。
- **Knowledge Base（商品知识库）**：商品基础资料增删改、发货时效规则配置、退换货规则配置与常见问答库。
- **Settings（系统设置）**：修改店铺名称、调整 AI 回复人设语气（专业严谨 / 亲切温馨 / 极简高效）及落款签名。

---

## 🚀 本地开发与运行

```bash
# 1. 克隆代码仓库
git clone https://github.com/yaohaoliang141-max/sellerdesk-ai.git
cd sellerdesk-ai

# 2. 安装依赖
npm install

# 3. 运行自动化真实性与安全测试
npm test

# 4. 启动开发服务器
npm run dev

# 5. 构建生产产物
npm run build

# 6. 一键部署发布至 GitHub Pages
npm run deploy
```

---

## 🔮 未来接入架构路线（DeepSeek AI & Supabase）

本项目代码架构严格分层，以便未来平滑升级：

1. **接入 DeepSeek AI API**：
   - 核心代码位于 `src/services/aiEngine.ts`。
   - 目前采用确定性规则引擎模拟推理过程，返回统一的 `GeneratedReplyResult` 接口。
   - 接入时只需在该服务内通过 `fetch('https://api.deepseek.com/chat/completions')` 调用 `deepseek-chat` 或 `deepseek-reasoner`，传入 `order`、`product`、`policies` 作为 System Prompt，无需重构任何前端界面。
2. **接入 Supabase 云数据库**：
   - 数据操作均汇集在 `src/services/storage.ts`。
   - 接入时引入 `@supabase/supabase-js`，将 `StorageService` 内的 `localStorage.getItem/setItem` 替换为 `supabase.from('orders').select()` 与 `.update()` 即可实现全端数据同步与多客服协作。
3. **真实电商平台对接**：
   - 数据结构已预留 Shopify / Amazon / 店匠 Order ID 与 Tracking Number 映射，可通过 Webhook 实时消费订单状态。

---

## 📄 开源许可

MIT License
