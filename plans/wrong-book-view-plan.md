# 错题本查看功能修复计划

## 问题描述

在文档管理页面（`/docs`）中，错题本区域只显示了状态数量和生成按钮，但用户**无法查看错题本的具体内容**。虽然文件 `docs/c300bca5df6d372d/错题本.md` 中已有 7 条错题数据，但网页上没有提供查看入口。

## 改动方案

### 1. 后端：新增获取错题本内容 API

**文件**: [`server/index.js`](server/index.js)

在 `GET /api/wrong-book/status` 路由附近新增 `GET /api/wrong-book/content` 接口：

```
GET /api/wrong-book/content
Headers: X-Api-Key (可选)
Response: { content: string, exists: boolean, count: number }
```

- 读取用户目录下的 `错题本.md` 文件内容
- 如果文件不存在，返回 `{ content: '', exists: false, count: 0 }`
- 如果文件存在，返回完整 Markdown 内容及统计数据

### 2. 前端 API：新增函数

**文件**: [`src/api/index.ts`](src/api/index.ts)

新增 `WrongBookContent` 接口和 `getWrongBookContent()` 函数：

```typescript
export interface WrongBookContent {
  content: string
  exists: boolean
  count: number
}

export async function getWrongBookContent(): Promise<WrongBookContent> {
  const res = await fetch(`${API_BASE}/wrong-book/content`, {
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '获取错题本内容失败')
  }
  return res.json()
}
```

### 3. 前端 UI：增加查看和预览功能

**文件**: [`src/views/DocManager.vue`](src/views/DocManager.vue)

#### 3a. 新增响应式变量

```typescript
// 错题本预览
const wrongBookPreview = ref(false)
const wrongBookContent = ref('')
const wrongBookLoading = ref(false)
```

#### 3b. 新增 `handleViewWrongBook` 函数

```typescript
async function handleViewWrongBook() {
  if (wrongBookPreview.value) {
    // 切换关闭
    wrongBookPreview.value = false
    wrongBookContent.value = ''
    return
  }
  
  wrongBookLoading.value = true
  wrongBookPreview.value = true
  try {
    const data = await getWrongBookContent()
    wrongBookContent.value = data.content
  } catch (err: any) {
    wrongBookContent.value = `加载失败: ${err.message}`
  } finally {
    wrongBookLoading.value = false
  }
}
```

#### 3c. 修改模板

在 "生成/更新错题本" 按钮旁边增加 "查看错题本" 按钮（仅在错题本存在时显示）：

```html
<button 
  v-if="wrongBookStatus.exists" 
  class="btn btn-view-wrong-book" 
  @click="handleViewWrongBook"
>
  {{ wrongBookPreview ? '收起' : '📖 查看错题本' }}
</button>
```

在错题本区域下方增加预览面板：

```html
<div v-if="wrongBookPreview" class="wrong-book-preview">
  <div v-if="wrongBookLoading" class="preview-loading">加载中...</div>
  <div v-else class="preview-content markdown-body" v-html="renderedWrongBookContent"></div>
</div>
```

#### 3d. 新增计算属性

```typescript
const renderedWrongBookContent = computed(() => {
  if (!wrongBookContent.value) return ''
  try {
    return marked.parse(wrongBookContent.value) as string
  } catch {
    return wrongBookContent.value
  }
})
```

#### 3e. 新增 CSS 样式

为查看按钮和预览区域添加样式，与现有的 `btn-wrong-book` 和 `preview-area` 风格保持一致。

### 无需改动

- 路由配置：无需修改，功能附加在现有 DocManager 页面
- Store：无需修改
- 其他 View：无需修改

## 数据流

```
用户点击 "📖 查看错题本"
  → 调用 getWrongBookContent()
    → GET /api/wrong-book/content
      → 读取 docs/{userHash}/错题本.md
      → 返回 Markdown 内容
    → marked.parse() 渲染为 HTML
  → 在预览区域展示
```

## 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `server/index.js` | 新增路由 | `GET /api/wrong-book/content` |
| `src/api/index.ts` | 新增函数 | `getWrongBookContent()` |
| `src/views/DocManager.vue` | 修改模板/脚本/样式 | 新增查看按钮和预览面板 |
