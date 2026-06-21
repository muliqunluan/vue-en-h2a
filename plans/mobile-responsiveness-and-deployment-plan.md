# 移动端适配 & 服务器部署计划

## 一、项目现状分析

该项目是一个 Vue 3 + Vite + Express 的英语学习工具，包含两个主要页面：

1. **WordInput.vue** — 英语单词录入流程：输入单词 → 猜测含义 → AI 检查结果 → 保存
2. **DocManager.vue** — 文档管理：按天分组的单词记录列表、AI 翻译/还原、错题本

当前设计主要面向桌面端，未做专门的移动端适配。

---

## 二、移动端适配问题清单

### 1. 全局问题

| 问题 | 位置 | 说明 |
|------|------|------|
| API 地址硬编码 | [`src/api/index.ts:1`](../../src/api/index.ts:1) | `const API_BASE = 'http://localhost:3001/api'` 在手机访问服务器时需要改为可配置的地址 |
| 无 CSS 响应式断点 | 全局 | 两个页面均使用固定 `max-width` + `padding`，无 `@media` 查询 |
| 触摸目标尺寸偏小 | WordInput [`.btn-sm`](../../src/views/WordInput.vue:469) / DocManager [`btn-sm`](../../src/views/DocManager.vue:469) | `.btn-sm` 的 `padding: 4px 10px` 远低于 44px 触控标准 |

### 2. WordInput.vue 具体问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 1 | **步骤指示器溢出** | 🔴 高 | 三步骤文字（"输入英文单词→输入含义猜测→AI检查结果"）在 375px 宽度下必然换行/重叠；`gap: 12px` 间距浪费空间 |
| 2 | **单词列表项过挤** | 🔴 高 | 单词项的 `#序号 + 英文词 + → + 猜测 + 匹配标记 + 释义` 6个元素在同一行，手机宽度下严重溢出 |
| 3 | **Header 标题+导航拥挤** | 🟡 中 | `h1` 字号 24px 偏大，与导航链接在 375px 宽度下间距不足 |
| 4 | **AI结果卡片内边距过大** | 🟡 中 | `.check-card` 的 `padding: 32px 24px` 在 375px 屏幕上剩 271px 可用宽度 |
| 5 | **check-row 同行展示** | 🟡 中 | 标签和值用 `justify-content: space-between` 同行显示，长文本会溢出或换行错乱 |
| 6 | **完成区按钮同行** | 🟡 中 | "保存"和"重新开始"两个大按钮同行，手机宽度下太挤 |
| 7 | **Modal 弹窗遮挡** | 🟢 低 | `min-width: 300px` 在小屏手机上宽度占比达 80%+，体验差 |
| 8 | **配置栏信息同行** | 🟢 低 | 目标单词数和当前进度同行显示，在窄屏上可能不够 |

### 3. DocManager.vue 具体问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 1 | **文档项布局拥挤** | 🔴 高 | 文件名（monospace）+ 标签 + 3个按钮在同一行，手机宽度下按钮叠在一起 |
| 2 | **错题本区域布局** | 🟡 中 | 错题本标题/计数 + 生成按钮同行，在 375px 宽度下按钮被挤到下一行或重叠 |
| 3 | **分组标题+批量按钮** | 🟡 中 | `group-day` 字号 18px + 计数 + 批量按钮同行，窄屏下可能不够 |
| 4 | **长文件名溢出** | 🟡 中 | 文件名使用 `font-family: monospace`，没有 `text-overflow: ellipsis` 截断 |
| 5 | **预览区域 Markdown 内容** | 🟢 低 | `<pre>` 内容的 `white-space: pre-wrap` 和 `word-break: break-all` 在小屏阅读体验差 |

---

## 三、部署问题清单

| # | 问题 | 说明 |
|---|------|------|
| 1 | **API 地址不可配置** | [`src/api/index.ts:1`](../../src/api/index.ts:1) 中 `API_BASE` 写死 `localhost`，部署到服务器后手机访问会请求手机本地的 3001 端口而非服务器 |
| 2 | **需要构建+启动脚本** | Vite 构建生成 `dist/`，Express 在生产模式下 serve 静态文件 |
| 3 | **服务器端口/地址配置** | [`server/index.js:38`](../../server/index.js:38) 端口 3001 写死，可能需要环境变量配置 |
| 4 | **无部署文档** | 缺少部署步骤说明 |

---

## 四、改进方案

### 4.1 部署前置修复

#### 4.1.1 让 API 地址可配置
- 在 [`public/`](../../public/) 下新建 `config.js`，动态读取 `window.__API_BASE__`
- 或者在 Vite 构建时通过环境变量 `VITE_API_BASE` 注入
- 推荐方案：Vite 环境变量，构建时指定

修改 [`src/api/index.ts`](../../src/api/index.ts:1)：
```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'
```

部署时构建命令：
```bash
VITE_API_BASE=http://your-server-ip:3001/api npm run build
```

#### 4.1.2 服务端端口支持环境变量
修改 [`server/index.js:38`](../../server/index.js:38)：
```javascript
const PORT = process.env.PORT || 3001
```

### 4.2 全局 CSS 改进

在 [`src/App.vue`](../../src/App.vue:42) 的全局样式中添加：

```css
/* 移动端触控友好 */
@media (max-width: 768px) {
  body {
    font-size: 15px;  /* 稍微缩小基础字号 */
  }
}

/* 通用触摸目标最小尺寸 */
.btn, .nav-link, button, input, select, textarea {
  min-height: 44px;  /* iOS 推荐触控目标 */
}
```

### 4.3 WordInput.vue 改进

#### 4.3.1 步骤指示器（高优先级）
当前：水平 flex 布局，文字可能溢出。

改进方案：
```css
/* 桌面端：水平排列（保持现状） */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* 移动端：垂直排列或压缩文字 */
@media (max-width: 600px) {
  .step-indicator {
    flex-direction: column;
    gap: 8px;
  }
  .step-arrow {
    transform: rotate(90deg);
  }
  .step-text {
    font-size: 12px;
    white-space: nowrap;
  }
  .step {
    padding: 6px 12px;
  }
}
```

或者更好的方案：步骤指示器收缩为圆形数字+短文字，去掉箭头在每个步骤之间。

#### 4.3.2 单词列表项（高优先级）
当前：6个元素同行 flex。

改进方案：
```css
@media (max-width: 600px) {
  .word-item {
    flex-wrap: wrap;        /* 允许换行 */
    gap: 4px 8px;           /* 紧凑间距 */
    padding: 8px;
  }
  .word-index {
    min-width: 24px;
  }
  .word-meaning {
    width: 100%;            /* 释义单独一行 */
    margin-left: 0;
    padding-left: 32px;     /* 对齐到单词位置 */
    font-size: 12px;
  }
  .word-match-badge {
    margin-left: auto;
  }
}
```

#### 4.3.3 Header（中优先级）
```css
@media (max-width: 480px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .header h1 {
    font-size: 20px;
  }
}
```

#### 4.3.4 AI 结果卡片（中优先级）
```css
@media (max-width: 480px) {
  .check-card {
    padding: 20px 16px;
  }
  .check-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .check-label {
    min-width: auto;
  }
  .check-value {
    text-align: left;
    margin-left: 0;
  }
}
```

#### 4.3.5 完成区按钮（中优先级）
```css
@media (max-width: 480px) {
  .complete-actions {
    flex-direction: column;
    gap: 8px;
  }
  .btn-large {
    width: 100%;
    padding: 16px 28px;
  }
}
```

#### 4.3.6 Modal 弹窗
```css
@media (max-width: 480px) {
  .modal {
    min-width: auto;
    width: calc(100% - 40px);
    margin: 0 20px;
    padding: 20px;
  }
}
```

#### 4.3.7 配置栏
```css
@media (max-width: 480px) {
  .config-bar {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    font-size: 13px;
    padding: 10px 14px;
  }
}
```

### 4.4 DocManager.vue 改进

#### 4.4.1 文档项布局（高优先级）
当前：文件名 + 标签 + 3按钮同行。

改进方案：
```css
@media (max-width: 600px) {
  .doc-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .doc-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .doc-name {
    font-size: 13px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

#### 4.4.2 Header + 导航（中优先级）
```css
@media (max-width: 480px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .header h1 {
    font-size: 20px;
  }
  .nav {
    flex-wrap: wrap;
  }
}
```

#### 4.4.3 错题本区域（中优先级）
```css
@media (max-width: 480px) {
  .wrong-book-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .btn-wrong-book {
    width: 100%;
    text-align: center;
  }
}
```

#### 4.4.4 分组标题（中优先级）
```css
@media (max-width: 480px) {
  .group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .btn-batch {
    width: 100%;
    text-align: center;
  }
}
```

#### 4.4.5 预览区域
```css
@media (max-width: 600px) {
  .preview-content {
    font-size: 12px;
    max-height: 300px;
  }
}
```

---

## 五、任务清单（执行顺序）

```
┌──────────────────────────────────────────────────────────────────┐
│                   实施顺序（按优先级）                              │
├──────────────────────────────────────────────────────────────────┤
│  1. API 地址可配置化（部署前置，必须最先做）                        │
│     ├── 修改 src/api/index.ts 支持 VITE_API_BASE 环境变量          │
│     └── 修改 server/index.js 支持 PORT 环境变量                    │
├──────────────────────────────────────────────────────────────────┤
│  2. 全局 CSS 改进                                                │
│     ├── App.vue 全局样式添加 @media 断点基础                       │
│     └── 触摸目标 min-height: 44px                                 │
├──────────────────────────────────────────────────────────────────┤
│  3. WordInput.vue 移动端适配                                      │
│     ├── 步骤指示器响应式（垂直排列 + 旋转箭头）                     │
│     ├── 单词列表项响应式（flex-wrap + 释义独占一行）                │
│     ├── Header 响应式（列方向排列）                                │
│     ├── AI 结果卡片响应式（check-row 改为上下排列）                 │
│     ├── 完成区按钮响应式（纵向堆叠）                               │
│     ├── Modal 弹窗响应式（去掉 min-width）                         │
│     └── 配置栏响应式（列方向排列）                                 │
├──────────────────────────────────────────────────────────────────┤
│  4. DocManager.vue 移动端适配                                    │
│     ├── 文档项响应式（flex-direction: column + 溢出省略）          │
│     ├── Header + 导航响应式                                       │
│     ├── 错题本区域响应式（纵向排列）                               │
│     ├── 分组标题响应式（纵向排列）                                 │
│     └── 预览区域响应式                                            │
├──────────────────────────────────────────────────────────────────┤
│  5. 部署配置与文档                                                │
│     ├── 添加部署脚本到 package.json                               │
│     └── 更新 README.md 添加部署说明                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 六、测试建议

部署到服务器后，使用手机浏览器测试以下场景：

1. **单词录入流程**：输入单词 → 猜测 → 查看 AI 结果 → 继续下一个 → 完成 → 保存
2. **文档管理页面**：刷新列表 → 预览文档 → AI 翻译 → 还原 → 批量处理
3. **错题本功能**：生成错题本 → 查看错题本状态
4. **横竖屏切换**：确保横屏下布局正常
5. **不同手机尺寸**：375px (iPhone) 和 414px (大屏手机)
