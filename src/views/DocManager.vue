<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { getDocs, translateDoc, revertDoc, batchTranslate, getDocContent, updateWrongBook, getWrongBookStatus, getWrongBookContent } from '@/api'
import type { DocGroup, DocInfo } from '@/api'

const groups = ref<DocGroup[]>([])
const loading = ref(false)
const error = ref('')

// 处理中的文件
const processingFiles = ref<Set<string>>(new Set())
// 还原中的文件
const revertingFiles = ref<Set<string>>(new Set())
// 批量处理中的日期
const batchProcessingDays = ref<Set<string>>(new Set())
// 预览
const previewFile = ref<string | null>(null)
const previewContent = ref('')
const previewLoading = ref(false)

// Markdown 渲染后的 HTML 内容
const renderedContent = computed(() => {
    if (!previewContent.value) return ''
    try {
        return marked.parse(previewContent.value) as string
    } catch {
        return previewContent.value
    }
})

// 错题本
const wrongBookUpdating = ref(false)
const wrongBookStatus = ref<{ exists: boolean; count: number }>({ exists: false, count: 0 })
const wrongBookMessage = ref('')
const wrongBookIsError = ref(false)

// 错题本预览
const wrongBookPreview = ref(false)
const wrongBookContent = ref('')
const wrongBookLoading = ref(false)

// 错题本渲染后的 HTML
const renderedWrongBookContent = computed(() => {
  if (!wrongBookContent.value) return ''
  try {
    return marked.parse(wrongBookContent.value) as string
  } catch {
    return wrongBookContent.value
  }
})

// 加载文档列表
async function loadDocs() {
    loading.value = true
    error.value = ''
    try {
        const data = await getDocs()
        groups.value = data.groups
    } catch (err: any) {
        error.value = err.message
    } finally {
        loading.value = false
    }
}

// 加载错题本状态
async function loadWrongBookStatus() {
    try {
        wrongBookStatus.value = await getWrongBookStatus()
    } catch {
        // 忽略
    }
}

// 处理单个文档
async function handleTranslate(doc: DocInfo) {
    if (processingFiles.value.has(doc.fileName)) return

    processingFiles.value.add(doc.fileName)
    try {
        await translateDoc(doc.fileName)
        await loadDocs()
    } catch (err: any) {
        alert(`处理失败: ${err.message}`)
    } finally {
        processingFiles.value.delete(doc.fileName)
    }
}

// 还原 AI 文档
async function handleRevert(doc: DocInfo) {
    if (revertingFiles.value.has(doc.fileName)) return
    if (!confirm(`确定要还原 "${doc.fileName}" 吗？将删除原意和匹配度列。`)) return

    revertingFiles.value.add(doc.fileName)
    try {
        await revertDoc(doc.fileName)
        await loadDocs()
    } catch (err: any) {
        alert(`还原失败: ${err.message}`)
    } finally {
        revertingFiles.value.delete(doc.fileName)
    }
}

// 批量处理某一天的所有文档
async function handleBatchTranslate(dayKey: string) {
    if (batchProcessingDays.value.has(dayKey)) return

    batchProcessingDays.value.add(dayKey)
    try {
        const result = await batchTranslate(dayKey)
        if (result.processed === 0) {
            alert(result.message || '该日期没有需要处理的文档')
        } else {
            const successCount = result.results?.filter((r) => r.success).length || 0
            const failCount = (result.results?.length || 0) - successCount
            alert(`处理完成！成功: ${successCount} 个, 失败: ${failCount} 个`)
            await loadDocs()
        }
    } catch (err: any) {
        alert(`批量处理失败: ${err.message}`)
    } finally {
        batchProcessingDays.value.delete(dayKey)
    }
}

// 预览文档
async function handlePreview(fileName: string) {
    if (previewFile.value === fileName) {
        previewFile.value = null
        previewContent.value = ''
        return
    }

    previewLoading.value = true
    previewFile.value = fileName
    try {
        const data = await getDocContent(fileName)
        previewContent.value = data.content
    } catch (err: any) {
        previewContent.value = `加载失败: ${err.message}`
    } finally {
        previewLoading.value = false
    }
}

// 更新错题本
async function handleUpdateWrongBook() {
    if (wrongBookUpdating.value) return
    wrongBookUpdating.value = true
    wrongBookMessage.value = ''
    wrongBookIsError.value = false
    try {
        const result = await updateWrongBook()
        wrongBookMessage.value = result.message
        await loadWrongBookStatus()
    } catch (err: any) {
        wrongBookMessage.value = err.message
        wrongBookIsError.value = true
    } finally {
        wrongBookUpdating.value = false
    }
}

// 查看错题本
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

// 判断文档是否需要处理（不含 ai 字符）
function needsProcessing(doc: DocInfo): boolean {
    return !doc.hasAi
}

// 判断某天是否有需要处理的文档
function groupNeedsProcessing(items: DocInfo[]): boolean {
    return items.some((doc) => needsProcessing(doc))
}

onMounted(() => {
    loadDocs()
    loadWrongBookStatus()
})
</script>

<template>
    <div class="doc-manager">
        <header class="header">
            <h1>单词记录</h1>
            <nav class="nav">
                <router-link to="/input" class="nav-link">录入单词</router-link>
                <button class="btn btn-refresh" :disabled="loading" @click="loadDocs">
                    {{ loading ? '加载中...' : '刷新' }}
                </button>
            </nav>
        </header>

        <!-- 错题本区域 -->
        <div class="wrong-book-section">
            <div class="wrong-book-info">
                <span class="wrong-book-title">错题本</span>
                <span v-if="wrongBookStatus.exists" class="wrong-book-count">
                    共 {{ wrongBookStatus.count }} 道错题
                </span>
                <span v-else class="wrong-book-count">暂无错题</span>
            </div>
            <div class="wrong-book-actions">
                <button v-if="wrongBookStatus.exists" class="btn btn-view-wrong-book" @click="handleViewWrongBook">
                    {{ wrongBookPreview ? '收起' : '查看错题本' }}
                </button>
                <button class="btn btn-wrong-book" :disabled="wrongBookUpdating" @click="handleUpdateWrongBook">
                    {{ wrongBookUpdating ? '生成中...' : '生成错题本' }}
                </button>
            </div>
        </div>
        <div v-if="wrongBookMessage" class="wrong-book-message" :class="{ error: wrongBookIsError }">
            {{ wrongBookMessage }}
        </div>

        <!-- 错题本预览 -->
        <div v-if="wrongBookPreview" class="wrong-book-preview">
            <div v-if="wrongBookLoading" class="preview-loading">加载中...</div>
            <div v-else class="preview-content markdown-body" v-html="renderedWrongBookContent"></div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-banner">
            {{ error }}
        </div>

        <!-- 加载状态 -->
        <div v-if="loading && groups.length === 0" class="loading">
            <p>加载中...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="groups.length === 0" class="empty">
            <p>暂无文档记录</p>
            <router-link to="/input" class="btn btn-primary">去录入单词</router-link>
        </div>

        <!-- 文档列表 -->
        <div v-else class="groups">
            <div v-for="group in groups" :key="group.day" class="group">
                <div class="group-header">
                    <div class="group-title">
                        <span class="group-day">{{ group.day }}</span>
                        <span class="group-count">{{ group.items.length }} 个文档</span>
                    </div>
                    <button v-if="groupNeedsProcessing(group.items)" class="btn btn-batch"
                        :disabled="batchProcessingDays.has(group.day)" @click="handleBatchTranslate(group.day)">
                        {{ batchProcessingDays.has(group.day) ? '处理中...' : '批量处理' }}
                    </button>
                </div>

                <div class="doc-list">
                    <div v-for="doc in group.items" :key="doc.fileName" class="doc-item">
                        <div class="doc-info">
                            <span class="doc-name">{{ doc.fileName }}</span>
                            <span v-if="doc.hasAi" class="doc-badge badge-ai">AI</span>
                            <span v-else class="doc-badge badge-raw">原始</span>
                        </div>
                        <div class="doc-actions">
                            <button class="btn btn-sm" @click="handlePreview(doc.fileName)">
                                {{ previewFile === doc.fileName ? '收起' : '预览' }}
                            </button>
                            <button v-if="needsProcessing(doc)" class="btn btn-sm btn-ai"
                                :disabled="processingFiles.has(doc.fileName)" @click="handleTranslate(doc)">
                                {{ processingFiles.has(doc.fileName) ? '处理中' : 'AI 翻译' }}
                            </button>
                            <button v-else class="btn btn-sm btn-revert" :disabled="revertingFiles.has(doc.fileName)"
                                @click="handleRevert(doc)">
                                {{ revertingFiles.has(doc.fileName) ? '处理中' : '还原' }}
                            </button>
                        </div>
                    </div>

                    <!-- 预览区域 -->
                    <div v-if="previewFile" class="preview-area">
                        <div v-if="previewLoading" class="preview-loading">加载中...</div>
                        <div v-else class="preview-content markdown-body" v-html="renderedContent"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.doc-manager {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: var(--color-text-primary, #1c1c1e);
}

.nav {
    display: flex;
    gap: 8px;
    align-items: center;
}

.nav-link {
    color: var(--color-accent-blue, #007aff);
    text-decoration: none;
    font-size: 15px;
    padding: 8px 16px;
    border-radius: var(--radius-pill, 999px);
    transition: background 0.2s;
    font-weight: 500;
}

.nav-link:hover {
    background: var(--color-bg-secondary, #f2f2f7);
}

/* ===== 错题本 (Apple 风格) ===== */
.wrong-book-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: #fef7f0;
    border: 1px solid #f0dcc8;
    border-radius: var(--radius-lg, 14px);
    margin-bottom: 10px;
}

.wrong-book-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.wrong-book-title {
    font-size: 16px;
    font-weight: 600;
    color: #c0601a;
}

.wrong-book-count {
    font-size: 13px;
    color: #a0500a;
}

.wrong-book-message {
    padding: 10px 16px;
    font-size: 13px;
    color: var(--color-accent-green, #34c759);
    background: #f0faf0;
    border-radius: var(--radius-md, 12px);
    margin-bottom: 12px;
}

.wrong-book-message.error {
    color: var(--color-accent-red, #ff3b30);
    background: #fcf0f0;
}

.btn-wrong-book {
    background: #ffcc02;
    color: #333;
    border: none;
    font-weight: 600;
    border-radius: var(--radius-pill, 999px);
}

.btn-wrong-book:hover:not(:disabled) {
    background: #ffb300;
}

.wrong-book-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.btn-view-wrong-book {
    background: #e8f0fe;
    color: var(--color-accent-blue, #007aff);
    border: none;
    font-weight: 600;
    border-radius: var(--radius-pill, 999px);
}

.btn-view-wrong-book:hover:not(:disabled) {
    background: #d0e0fc;
}

.wrong-book-preview {
    margin-bottom: 12px;
    padding: 14px;
    background: var(--color-bg-secondary, #f2f2f7);
    border: 1px solid var(--color-border, #e5e5ea);
    border-radius: var(--radius-md, 12px);
}

.error-banner {
    padding: 12px 16px;
    background: #fcf0f0;
    color: var(--color-accent-red, #ff3b30);
    border-radius: var(--radius-md, 12px);
    margin-bottom: 16px;
    font-size: 14px;
}

.loading {
    text-align: center;
    padding: 48px;
    color: var(--color-text-secondary, #8e8e93);
}

.empty {
    text-align: center;
    padding: 48px;
    color: var(--color-text-secondary, #8e8e93);
}

.empty p {
    font-size: 18px;
    margin-bottom: 16px;
}

/* ===== 分组 (Apple 风格) ===== */
.group {
    margin-bottom: 20px;
    border: 1px solid var(--color-border, #e5e5ea);
    border-radius: var(--radius-lg, 14px);
    overflow: hidden;
    background: var(--color-bg, #ffffff);
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04));
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: var(--color-bg-secondary, #f2f2f7);
    border-bottom: 1px solid var(--color-border, #e5e5ea);
}

.group-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.group-day {
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary, #1c1c1e);
}

.group-count {
    font-size: 13px;
    color: var(--color-text-secondary, #8e8e93);
}

/* ===== 文档列表 ===== */
.doc-list {
    padding: 4px 0;
}

.doc-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    transition: background 0.15s;
    border-bottom: 1px solid var(--color-border, #e5e5ea);
}

.doc-item:last-child {
    border-bottom: none;
}

.doc-item:hover {
    background: var(--color-bg-secondary, #f2f2f7);
}

.doc-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.doc-name {
    font-size: 14px;
    color: var(--color-text-primary, #1c1c1e);
    font-family: 'SF Mono', 'Courier New', monospace;
}

.doc-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: var(--radius-pill, 999px);
    font-weight: 600;
    letter-spacing: 0.3px;
}

.badge-ai {
    background: #e8f5e9;
    color: #2e7d32;
}

.badge-raw {
    background: #fff3e0;
    color: #e65100;
}

.doc-actions {
    display: flex;
    gap: 6px;
}

/* ===== 按钮 (Apple 风格) ===== */
.btn {
    padding: 8px 18px;
    border: 1px solid var(--color-border, #e5e5ea);
    border-radius: var(--radius-pill, 999px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: var(--color-bg, #ffffff);
    transition: all 0.2s;
    font-family: var(--font-stack, -apple-system, sans-serif);
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.btn:hover {
    background: var(--color-bg-secondary, #f2f2f7);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-sm {
    padding: 4px 14px;
    font-size: 12px;
    min-height: 30px;
}

.btn-primary {
    background: var(--color-accent-blue, #007aff);
    color: white;
    border-color: var(--color-accent-blue, #007aff);
    text-decoration: none;
    border-radius: var(--radius-pill, 999px);
}

.btn-primary:hover {
    background: #0066d6;
}

.btn-ai {
    background: #e8f5e9;
    color: #2e7d32;
    border-color: #c8e6c9;
}

.btn-ai:hover:not(:disabled) {
    background: #c8e6c9;
}

.btn-revert {
    background: #fff3e0;
    color: #e65100;
    border-color: #ffe0b2;
}

.btn-revert:hover:not(:disabled) {
    background: #ffe0b2;
}

.btn-batch {
    background: #e8f0fe;
    color: var(--color-accent-blue, #007aff);
    border-color: #c8d8fc;
    font-weight: 500;
}

.btn-batch:hover:not(:disabled) {
    background: #d0e0fc;
}

.btn-refresh {
    background: var(--color-bg-secondary, #f2f2f7);
    border: none;
}

.btn-refresh:hover {
    background: var(--color-bg-tertiary, #e5e5ea);
}

/* ===== 预览 ===== */
.preview-area {
    margin: 8px 14px 14px;
    padding: 14px;
    background: var(--color-bg-secondary, #f2f2f7);
    border: 1px solid var(--color-border, #e5e5ea);
    border-radius: var(--radius-md, 12px);
}

.preview-loading {
    text-align: center;
    color: var(--color-text-secondary, #8e8e93);
    padding: 16px;
}

.preview-content {
    max-height: 400px;
    overflow-y: auto;
    margin: 0;
}

/* ===== Markdown 渲染样式 ===== */
.markdown-body {
    font-size: 14px;
    line-height: 1.7;
    color: var(--color-text-primary, #1c1c1e);
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
    margin: 16px 0 8px;
    color: var(--color-text-primary, #1c1c1e);
    font-weight: 600;
    letter-spacing: -0.2px;
}

.markdown-body h1 { font-size: 20px; }
.markdown-body h2 { font-size: 18px; }
.markdown-body h3 { font-size: 16px; }

.markdown-body p {
    margin: 8px 0;
}

.markdown-body strong {
    font-weight: 600;
}

.markdown-body table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 13px;
}

.markdown-body th,
.markdown-body td {
    border: 1px solid var(--color-border, #e5e5ea);
    padding: 6px 10px;
    text-align: left;
}

.markdown-body th {
    background: var(--color-bg-secondary, #f2f2f7);
    font-weight: 600;
}

.markdown-body tr:nth-child(even) {
    background: #fafafa;
}

.markdown-body code {
    background: var(--color-bg-secondary, #f2f2f7);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'SF Mono', 'Courier New', monospace;
}

.markdown-body pre {
    background: var(--color-bg-secondary, #f2f2f7);
    padding: 12px;
    border-radius: var(--radius-md, 12px);
    overflow-x: auto;
}

.markdown-body pre code {
    background: none;
    padding: 0;
}

.markdown-body ul,
.markdown-body ol {
    padding-left: 24px;
    margin: 8px 0;
}

.markdown-body li {
    margin: 4px 0;
}

.markdown-body a {
    color: var(--color-accent-blue, #007aff);
    text-decoration: none;
}

.markdown-body a:hover {
    text-decoration: underline;
}

/* ========================================
   移动端适配 - DocManager
   ======================================== */

@media (max-width: 480px) {
    .doc-manager {
        padding: 12px;
    }

    .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
    }

    .header h1 {
        font-size: 22px;
    }

    .nav {
        width: 100%;
        flex-wrap: wrap;
        gap: 6px;
    }

    .nav-link {
        font-size: 14px;
        padding: 6px 14px;
    }

    .btn-refresh {
        padding: 6px 14px;
        font-size: 13px;
    }

    .wrong-book-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
    }

    .wrong-book-info {
        flex-wrap: wrap;
        gap: 6px;
    }

    .wrong-book-title {
        font-size: 14px;
    }

    .wrong-book-count {
        font-size: 12px;
    }

    .wrong-book-actions {
        width: 100%;
        flex-direction: column;
        gap: 6px;
    }

    .btn-view-wrong-book,
    .btn-wrong-book {
        width: 100%;
        text-align: center;
        padding: 10px 16px;
        font-size: 14px;
    }

    .wrong-book-preview {
        padding: 10px;
        margin-bottom: 8px;
    }

    .wrong-book-message {
        font-size: 12px;
        padding: 8px 12px;
    }

    .group {
        margin-bottom: 16px;
        border-radius: var(--radius-md, 12px);
    }

    .group-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 14px;
    }

    .group-title {
        flex-wrap: wrap;
        gap: 8px;
    }

    .group-day {
        font-size: 16px;
    }

    .group-count {
        font-size: 12px;
    }

    .btn-batch {
        width: 100%;
        text-align: center;
        padding: 10px 16px;
        font-size: 13px;
    }

    .doc-list {
        padding: 0;
    }

    .doc-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 14px;
    }

    .doc-info {
        width: 100%;
        flex-wrap: wrap;
        gap: 6px;
    }

    .doc-name {
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
        width: 100%;
    }

    .doc-badge {
        font-size: 10px;
        padding: 1px 6px;
    }

    .doc-actions {
        width: 100%;
        justify-content: flex-start;
        gap: 6px;
    }

    .btn-sm {
        padding: 6px 14px;
        font-size: 12px;
        min-height: 36px;
        flex: 1;
        text-align: center;
    }

    .preview-area {
        margin: 6px 8px 10px;
        padding: 10px;
    }

    .preview-content {
        font-size: 12px;
        max-height: 250px;
        line-height: 1.5;
    }

    .empty {
        padding: 32px 16px;
    }

    .empty p {
        font-size: 16px;
    }

    .btn-primary {
        padding: 10px 20px;
        font-size: 14px;
    }

    .loading {
        padding: 32px;
        font-size: 14px;
    }

    .error-banner {
        padding: 10px 14px;
        font-size: 13px;
    }
}

@media (min-width: 481px) and (max-width: 600px) {
    .doc-manager {
        padding: 16px;
    }

    .header h1 {
        font-size: 24px;
    }

    .doc-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }

    .doc-name {
        max-width: 100%;
    }

    .doc-actions {
        width: 100%;
    }

    .btn-sm {
        flex: 1;
        text-align: center;
    }

    .group-header {
        padding: 12px 14px;
    }
}
</style>
