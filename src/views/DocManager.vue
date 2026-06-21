<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDocs, translateDoc, revertDoc, batchTranslate, getDocContent, updateWrongBook, getWrongBookStatus } from '@/api'
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

// 错题本
const wrongBookUpdating = ref(false)
const wrongBookStatus = ref<{ exists: boolean; count: number }>({ exists: false, count: 0 })
const wrongBookMessage = ref('')

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
    try {
        const result = await updateWrongBook()
        wrongBookMessage.value = result.message
        await loadWrongBookStatus()
    } catch (err: any) {
        wrongBookMessage.value = `❌ ${err.message}`
    } finally {
        wrongBookUpdating.value = false
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
            <h1>📂 单词记录文档</h1>
            <nav class="nav">
                <router-link to="/input" class="nav-link">✏️ 录入单词</router-link>
                <button class="btn btn-refresh" :disabled="loading" @click="loadDocs">
                    {{ loading ? '⏳ 加载中...' : '🔄 刷新' }}
                </button>
            </nav>
        </header>

        <!-- 错题本区域 -->
        <div class="wrong-book-section">
            <div class="wrong-book-info">
                <span class="wrong-book-title">📖 错题本</span>
                <span v-if="wrongBookStatus.exists" class="wrong-book-count">
                    共 {{ wrongBookStatus.count }} 道错题
                </span>
                <span v-else class="wrong-book-count">暂无错题</span>
            </div>
            <button class="btn btn-wrong-book" :disabled="wrongBookUpdating" @click="handleUpdateWrongBook">
                {{ wrongBookUpdating ? '⏳ 生成中...' : '📝 生成/更新错题本' }}
            </button>
        </div>
        <div v-if="wrongBookMessage" class="wrong-book-message" :class="{ error: wrongBookMessage.includes('❌') }">
            {{ wrongBookMessage }}
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
            <p>📭 暂无文档记录</p>
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
                        {{ batchProcessingDays.has(group.day) ? '⏳ 处理中...' : '🤖 批量处理' }}
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
                                {{ processingFiles.has(doc.fileName) ? '⏳' : '🤖 AI 翻译' }}
                            </button>
                            <button v-else class="btn btn-sm btn-revert" :disabled="revertingFiles.has(doc.fileName)"
                                @click="handleRevert(doc)">
                                {{ revertingFiles.has(doc.fileName) ? '⏳' : '↩️ 还原' }}
                            </button>
                        </div>
                    </div>

                    <!-- 预览区域 -->
                    <div v-if="previewFile" class="preview-area">
                        <div v-if="previewLoading" class="preview-loading">加载中...</div>
                        <pre v-else class="preview-content">{{ previewContent }}</pre>
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
    font-size: 24px;
}

.nav {
    display: flex;
    gap: 8px;
    align-items: center;
}

.nav-link {
    color: #4a90d9;
    text-decoration: none;
    font-size: 16px;
    padding: 8px 16px;
    border-radius: 6px;
    transition: background 0.2s;
}

.nav-link:hover {
    background: #f0f4ff;
}

/* 错题本 */
.wrong-book-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #fff3e0;
    border: 1px solid #ffe0b2;
    border-radius: 8px;
    margin-bottom: 8px;
}

.wrong-book-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.wrong-book-title {
    font-size: 15px;
    font-weight: bold;
    color: #e65100;
}

.wrong-book-count {
    font-size: 13px;
    color: #bf360c;
}

.wrong-book-message {
    padding: 8px 16px;
    font-size: 13px;
    color: #2e7d32;
    background: #e8f5e9;
    border-radius: 6px;
    margin-bottom: 12px;
}

.wrong-book-message.error {
    color: #c62828;
    background: #fbe9e7;
}

.btn-wrong-book {
    background: #ffcc02;
    color: #333;
    border-color: #ffb300;
    font-weight: bold;
}

.btn-wrong-book:hover:not(:disabled) {
    background: #ffb300;
}

.error-banner {
    padding: 12px 16px;
    background: #fbe9e7;
    color: #c62828;
    border-radius: 8px;
    margin-bottom: 16px;
}

.loading {
    text-align: center;
    padding: 48px;
    color: #999;
}

.empty {
    text-align: center;
    padding: 48px;
    color: #999;
}

.empty p {
    font-size: 18px;
    margin-bottom: 16px;
}

/* 分组 */
.group {
    margin-bottom: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
}

.group-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.group-day {
    font-size: 18px;
    font-weight: bold;
    color: #333;
}

.group-count {
    font-size: 13px;
    color: #999;
}

/* 文档列表 */
.doc-list {
    padding: 8px;
}

.doc-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 6px;
    transition: background 0.2s;
}

.doc-item:hover {
    background: #f5f5f5;
}

.doc-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.doc-name {
    font-size: 14px;
    color: #333;
    font-family: 'Courier New', monospace;
}

.doc-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
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

/* 按钮 */
.btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    background: white;
    transition: all 0.2s;
}

.btn:hover {
    border-color: #bbb;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-sm {
    padding: 4px 10px;
    font-size: 12px;
}

.btn-primary {
    background: #4a90d9;
    color: white;
    border-color: #4a90d9;
    text-decoration: none;
}

.btn-primary:hover {
    background: #357abd;
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
    background: #e3f2fd;
    color: #1565c0;
    border-color: #bbdefb;
}

.btn-batch:hover:not(:disabled) {
    background: #bbdefb;
}

.btn-refresh {
    background: #f5f5f5;
}

/* 预览 */
.preview-area {
    margin: 8px 12px 12px;
    padding: 12px;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
}

.preview-loading {
    text-align: center;
    color: #999;
    padding: 16px;
}

.preview-content {
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
}

/* ========================================
   移动端适配 - DocManager
   ======================================== */

/* 小屏手机 (<480px) */
@media (max-width: 480px) {
    .doc-manager {
        padding: 12px;
    }

    /* --- Header --- */
    .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
    }

    .header h1 {
        font-size: 20px;
    }

    .nav {
        width: 100%;
        flex-wrap: wrap;
        gap: 6px;
    }

    .nav-link {
        font-size: 14px;
        padding: 6px 12px;
    }

    .btn-refresh {
        padding: 6px 12px;
        font-size: 13px;
    }

    /* --- 错题本区域 --- */
    .wrong-book-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 14px;
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

    .btn-wrong-book {
        width: 100%;
        text-align: center;
        padding: 10px 16px;
        font-size: 14px;
    }

    .wrong-book-message {
        font-size: 12px;
        padding: 6px 12px;
    }

    /* --- 分组 --- */
    .group {
        margin-bottom: 16px;
        border-radius: 8px;
    }

    .group-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 14px;
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

    /* --- 文档项 --- */
    .doc-list {
        padding: 6px;
    }

    .doc-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
    }

    .doc-info {
        width: 100%;
        flex-wrap: wrap;
        gap: 6px;
    }

    .doc-name {
        font-size: 13px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
        width: 100%;
    }

    .doc-badge {
        font-size: 10px;
        padding: 1px 5px;
    }

    .doc-actions {
        width: 100%;
        justify-content: flex-start;
        gap: 6px;
    }

    .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
        min-height: 36px;
        flex: 1;
        text-align: center;
    }

    /* --- 预览 --- */
    .preview-area {
        margin: 6px 6px 10px;
        padding: 10px;
    }

    .preview-content {
        font-size: 12px;
        max-height: 250px;
        line-height: 1.5;
    }

    /* --- 空状态 --- */
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

    /* --- 加载 --- */
    .loading {
        padding: 32px;
        font-size: 14px;
    }

    .error-banner {
        padding: 10px 14px;
        font-size: 13px;
    }
}

/* 中屏手机 (480px-600px) */
@media (min-width: 481px) and (max-width: 600px) {
    .doc-manager {
        padding: 16px;
    }

    .header h1 {
        font-size: 22px;
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
        padding: 10px 14px;
    }
}
</style>
