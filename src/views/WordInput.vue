<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useWordStore } from '@/stores/word'

const store = useWordStore()

// 输入框
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const countInputRef = ref<HTMLInputElement | null>(null)
const showCountConfig = ref(false)
const tempCount = ref(String(store.totalCount))

// 自动聚焦输入框
watch(() => store.step, () => {
    nextTick(() => {
        inputRef.value?.focus()
    })
})

// 处理回车
function handleEnter() {
    const value = inputValue.value.trim()
    if (!value) return

    if (store.step === 0) {
        // 提交单词
        store.submitWord(value)
        inputValue.value = ''
    } else {
        // 提交猜测
        store.submitGuess(value)
        inputValue.value = ''
    }
}

// 保存到文件
async function handleSave() {
    try {
        await store.saveToFile()
    } catch {
        // 错误已在 store 中处理
    }
}

// 设置数量
function confirmCount() {
    const num = parseInt(tempCount.value)
    if (num > 0 && num <= 1000) {
        store.setTotalCount(num)
        showCountConfig.value = false
    }
}

// 重置
function handleReset() {
    store.reset()
    inputValue.value = ''
}
</script>

<template>
    <div class="word-input">
        <header class="header">
            <h1>📝 英语单词记录</h1>
            <nav class="nav">
                <router-link to="/docs" class="nav-link">📂 查看文档</router-link>
            </nav>
        </header>

        <div class="config-bar">
            <span class="count-info">
                目标单词数：
                <a class="count-link" href="#" @click.prevent="showCountConfig = !showCountConfig">
                    {{ store.totalCount }}
                </a>
            </span>
            <span class="progress">当前进度：{{ store.progress }} / {{ store.totalCount }}</span>
        </div>

        <!-- 数量配置弹窗 -->
        <div v-if="showCountConfig" class="modal-overlay" @click.self="showCountConfig = false">
            <div class="modal">
                <h3>设置单词数量</h3>
                <input ref="countInputRef" v-model="tempCount" type="number" min="1" max="1000"
                    class="input count-input" @keyup.enter="confirmCount" />
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmCount">确定</button>
                    <button class="btn" @click="showCountConfig = false">取消</button>
                </div>
            </div>
        </div>

        <!-- 主输入区域（步骤 0 或 1 且未完成时显示） -->
        <div class="input-area" v-if="store.step <= 1 && !store.isComplete">
            <div class="step-indicator">
                <div class="step" :class="{ active: store.step === 0 }"
                    :style="store.step === 1 ? { cursor: 'pointer' } : {}"
                    @click="store.step === 1 && store.goBackToWord()">
                    <span class="step-num">1</span>
                    <span class="step-text">输入英文单词</span>
                </div>
                <div class="step-arrow">→</div>
                <div class="step" :class="{ active: store.step === 1 }">
                    <span class="step-num">2</span>
                    <span class="step-text">输入含义猜测</span>
                </div>
            </div>

            <div class="input-group">
                <label class="input-label">
                    {{ store.step === 0 ? '✏️ 请输入英文单词：' : '💭 请输入你对这个词的含义猜测：' }}
                </label>
                <input ref="inputRef" v-model="inputValue" type="text" class="input main-input"
                    :placeholder="store.step === 0 ? '例如：apple' : '例如：一种水果'" @keyup.enter="handleEnter" autofocus />
                <p class="hint">按 Enter 键提交</p>
            </div>

            <!-- 当前已输入的单词预览 -->
            <div v-if="store.words.length > 0" class="preview">
                <h3>已记录 ({{ store.words.length }})</h3>
                <div class="word-list">
                    <div v-for="(item, index) in store.words" :key="index" class="word-item"
                        :class="{ 'item-match': item.match === '基本吻合', 'item-mismatch': item.match === '差距过大' }">
                        <span class="word-index">#{{ index + 1 }}</span>
                        <span class="word-en">{{ item.word }}</span>
                        <span class="word-sep">→</span>
                        <span class="word-guess">{{ item.guess }}</span>
                        <span v-if="item.match" class="word-match-badge"
                            :class="item.match === '基本吻合' ? 'badge-ok' : 'badge-fail'">
                            {{ item.match === '基本吻合' ? '✅' : '❌' }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- AI 检查结果 -->
        <div v-else-if="store.step === 2" class="check-result-area">
            <div class="step-indicator">
                <div class="step completed">
                    <span class="step-num">1</span>
                    <span class="step-text">输入英文单词</span>
                </div>
                <div class="step-arrow">→</div>
                <div class="step completed">
                    <span class="step-num">2</span>
                    <span class="step-text">输入含义猜测</span>
                </div>
                <div class="step-arrow">→</div>
                <div class="step active">
                    <span class="step-num">3</span>
                    <span class="step-text">AI 检查结果</span>
                </div>
            </div>

            <div class="check-card">
                <!-- 加载中 -->
                <div v-if="store.checking" class="check-loading">
                    <div class="spinner"></div>
                    <p class="check-loading-text">AI 正在分析你的答案...</p>
                </div>

                <!-- 错误 -->
                <div v-else-if="store.checkError" class="check-error">
                    <span class="check-error-icon">⚠️</span>
                    <p class="check-error-text">{{ store.checkError }}</p>
                    <button class="btn btn-primary" @click="store.proceedToNext()">跳过，继续下一个</button>
                </div>

                <!-- 结果 -->
                <div v-else-if="store.checkResult" class="check-result">
                    <div class="check-result-icon"
                        :class="store.checkResult.match === '基本吻合' ? 'icon-ok' : 'icon-fail'">
                        {{ store.checkResult.match === '基本吻合' ? '🎉' : '💪' }}
                    </div>
                    <div class="check-match-label"
                        :class="store.checkResult.match === '基本吻合' ? 'label-ok' : 'label-fail'">
                        {{ store.checkResult.match === '基本吻合' ? '基本吻合 ✓' : '差距过大 ✗' }}
                    </div>

                    <div class="check-details">
                        <div class="check-row">
                            <span class="check-label">你的单词</span>
                            <span class="check-value check-word">{{ store.checkResult.word }}</span>
                        </div>
                        <div class="check-row">
                            <span class="check-label">你的猜测</span>
                            <span class="check-value check-guess">{{ store.words[store.words.length - 1]?.guess
                                }}</span>
                        </div>
                        <div class="check-divider"></div>
                        <div class="check-row">
                            <span class="check-label">词性</span>
                            <span class="check-value check-pos">{{ store.checkResult.pos }}</span>
                        </div>
                        <div class="check-row">
                            <span class="check-label">真实含义</span>
                            <span class="check-value check-meaning">{{ store.checkResult.meaning }}</span>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-large" @click="store.proceedToNext()">
                        {{ store.isComplete ? '🎉 查看总结' : '➡️ 继续下一个' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 完成区域 -->
        <div v-else class="complete-area">
            <div class="complete-icon">🎉</div>
            <h2>已完成 {{ store.totalCount }} 个单词的记录！</h2>
            <div class="word-list final-list">
                <div v-for="(item, index) in store.words" :key="index" class="word-item"
                    :class="{ 'item-match': item.match === '基本吻合', 'item-mismatch': item.match === '差距过大' }">
                    <span class="word-index">#{{ index + 1 }}</span>
                    <span class="word-en">{{ item.word }}</span>
                    <span class="word-sep">→</span>
                    <span class="word-guess">{{ item.guess }}</span>
                    <span v-if="item.match" class="word-match-badge"
                        :class="item.match === '基本吻合' ? 'badge-ok' : 'badge-fail'">
                        {{ item.match === '基本吻合' ? '✅' : '❌' }}
                    </span>
                    <span v-if="item.meaning" class="word-meaning">{{ item.meaning }}</span>
                </div>
            </div>

            <div class="complete-actions">
                <button class="btn btn-primary btn-large" :disabled="store.saving" @click="handleSave">
                    {{ store.saving ? '⏳ 保存中...' : '💾 保存到 Markdown 文件' }}
                </button>
                <button class="btn btn-secondary" @click="handleReset">🔄 重新开始</button>
            </div>

            <div v-if="store.saveResult" class="save-result" :class="{ error: store.saveResult.includes('❌') }">
                {{ store.saveResult }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.word-input {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.header h1 {
    margin: 0;
    font-size: 24px;
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

.config-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 14px;
    color: #666;
}

.count-link {
    color: #4a90d9;
    font-weight: bold;
    text-decoration: none;
    cursor: pointer;
}

.count-link:hover {
    text-decoration: underline;
}

/* 弹窗 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal {
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    min-width: 300px;
}

.modal h3 {
    margin: 0 0 16px;
}

.count-input {
    width: 100%;
    box-sizing: border-box;
}

.modal-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
}

/* 步骤指示器 */
.step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 32px;
}

.step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 20px;
    background: #f0f0f0;
    color: #999;
    transition: all 0.3s;
}

.step.active {
    background: #4a90d9;
    color: white;
}

.step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.3);
}

.step.active .step-num {
    background: rgba(255, 255, 255, 0.3);
}

.step-text {
    font-size: 14px;
}

.step-arrow {
    color: #ccc;
    font-size: 18px;
}

/* 输入区域 */
.input-area {
    text-align: center;
}

.input-group {
    margin-bottom: 24px;
}

.input-label {
    display: block;
    font-size: 16px;
    margin-bottom: 12px;
    color: #333;
}

.main-input {
    width: 100%;
    max-width: 500px;
    box-sizing: border-box;
}

.input {
    padding: 12px 16px;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s;
}

.input:focus {
    border-color: #4a90d9;
}

.hint {
    margin-top: 8px;
    font-size: 13px;
    color: #999;
}

/* 预览列表 */
.preview {
    text-align: left;
    margin-top: 32px;
}

.preview h3 {
    font-size: 16px;
    color: #666;
    margin-bottom: 12px;
}

.word-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.word-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    font-size: 14px;
}

.word-index {
    color: #999;
    font-size: 12px;
    min-width: 28px;
}

.word-en {
    font-weight: bold;
    color: #333;
}

.word-sep {
    color: #ccc;
}

.word-guess {
    color: #666;
}

/* 完成区域 */
.complete-area {
    text-align: center;
}

.complete-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.complete-area h2 {
    color: #333;
    margin-bottom: 24px;
}

.final-list {
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 24px;
    text-align: left;
}

.complete-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
}

.btn {
    padding: 10px 20px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
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

.btn-primary {
    background: #4a90d9;
    color: white;
    border-color: #4a90d9;
}

.btn-primary:hover {
    background: #357abd;
    border-color: #357abd;
}

.btn-secondary {
    background: #f0f0f0;
    border-color: #ddd;
}

.btn-secondary:hover {
    background: #e0e0e0;
}

.btn-large {
    padding: 14px 28px;
    font-size: 16px;
}

.save-result {
    padding: 12px;
    border-radius: 8px;
    background: #e8f5e9;
    color: #2e7d32;
    font-size: 14px;
}

.save-result.error {
    background: #fbe9e7;
    color: #c62828;
}

/* ====== AI 检查结果区域 ====== */
.check-result-area {
    text-align: center;
}

.check-card {
    max-width: 480px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    padding: 32px 24px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

/* 步骤指示器 - 扩展版本 */
.step.completed {
    background: #e8f5e9;
    color: #2e7d32;
}

/* 加载动画 */
.check-loading {
    padding: 24px 0;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e0e0e0;
    border-top-color: #4a90d9;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.check-loading-text {
    color: #666;
    font-size: 15px;
}

/* 错误提示 */
.check-error {
    padding: 16px 0;
}

.check-error-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
}

.check-error-text {
    color: #c62828;
    font-size: 14px;
    margin-bottom: 20px;
}

/* 结果卡片 */
.check-result {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.check-result-icon {
    font-size: 56px;
    margin-bottom: 12px;
    animation: pop-in 0.3s ease-out;
}

@keyframes pop-in {
    0% {
        transform: scale(0);
    }

    70% {
        transform: scale(1.2);
    }

    100% {
        transform: scale(1);
    }
}

.check-match-label {
    font-size: 18px;
    font-weight: bold;
    padding: 6px 20px;
    border-radius: 20px;
    margin-bottom: 24px;
}

.label-ok {
    background: #e8f5e9;
    color: #2e7d32;
}

.label-fail {
    background: #fbe9e7;
    color: #c62828;
}

.check-details {
    width: 100%;
    text-align: left;
    margin-bottom: 24px;
}

.check-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
}

.check-label {
    font-size: 13px;
    color: #999;
    min-width: 70px;
}

.check-value {
    font-size: 15px;
    color: #333;
    font-weight: 500;
    text-align: right;
    flex: 1;
    margin-left: 12px;
}

.check-word {
    font-weight: bold;
    font-size: 17px;
    color: #1a1a1a;
}

.check-guess {
    color: #666;
    font-style: italic;
}

.check-pos {
    color: #7b1fa2;
    font-weight: bold;
}

.check-meaning {
    color: #1565c0;
    font-weight: bold;
    font-size: 16px;
}

.check-divider {
    height: 1px;
    background: #eee;
    margin: 8px 0;
}

/* 单词列表中的匹配标记 */
.item-match {
    border-left: 3px solid #4caf50 !important;
}

.item-mismatch {
    border-left: 3px solid #f44336 !important;
}

.word-match-badge {
    font-size: 12px;
    margin-left: auto;
    flex-shrink: 0;
}

.word-meaning {
    font-size: 12px;
    color: #1565c0;
    margin-left: 4px;
    flex-shrink: 0;
}

/* ========================================
   移动端适配 - WordInput
   ======================================== */

/* 小屏手机 (<480px) */
@media (max-width: 480px) {
    .word-input {
        padding: 12px;
    }

    /* --- Header --- */
    .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        margin-bottom: 12px;
    }

    .header h1 {
        font-size: 20px;
    }

    .nav-link {
        font-size: 14px;
        padding: 6px 12px;
        margin-left: 0;
        display: inline-block;
    }

    /* --- 配置栏 --- */
    .config-bar {
        flex-direction: column;
        gap: 4px;
        align-items: flex-start;
        font-size: 13px;
        padding: 8px 12px;
        margin-bottom: 16px;
    }

    /* --- 步骤指示器 --- */
    .step-indicator {
        flex-direction: column;
        gap: 6px;
        margin-bottom: 20px;
    }

    .step-arrow {
        transform: rotate(90deg);
        font-size: 14px;
    }

    .step {
        padding: 6px 14px;
        gap: 6px;
    }

    .step-text {
        font-size: 12px;
        white-space: nowrap;
    }

    .step-num {
        width: 20px;
        height: 20px;
        font-size: 11px;
    }

    /* --- 输入区域 --- */
    .input-label {
        font-size: 14px;
    }

    .input {
        padding: 10px 14px;
        font-size: 15px;
    }

    .main-input {
        max-width: 100%;
    }

    /* --- 单词列表项 --- */
    .word-item {
        flex-wrap: wrap;
        gap: 4px 8px;
        padding: 8px 10px;
        font-size: 13px;
    }

    .word-index {
        min-width: 22px;
        font-size: 11px;
    }

    .word-en {
        font-size: 14px;
    }

    .word-meaning {
        width: 100%;
        margin-left: 0;
        padding-left: 30px;
        /* 对齐到单词位置 */
        font-size: 12px;
        color: #1565c0;
    }

    .word-match-badge {
        font-size: 11px;
    }

    /* --- AI 结果卡片 --- */
    .check-card {
        padding: 20px 16px;
        border-radius: 12px;
    }

    .check-result-icon {
        font-size: 40px;
    }

    .check-match-label {
        font-size: 15px;
        padding: 4px 16px;
    }

    .check-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 6px 0;
    }

    .check-label {
        font-size: 12px;
        min-width: auto;
    }

    .check-value {
        text-align: left;
        margin-left: 0;
        font-size: 14px;
    }

    .check-word {
        font-size: 16px;
    }

    .check-meaning {
        font-size: 15px;
    }

    .check-details {
        margin-bottom: 16px;
    }

    /* --- 按钮 --- */
    .btn {
        padding: 8px 16px;
        font-size: 13px;
    }

    .btn-large {
        width: 100%;
        padding: 14px 20px;
        font-size: 15px;
    }

    /* --- 完成区 --- */
    .complete-icon {
        font-size: 48px;
    }

    .complete-area h2 {
        font-size: 18px;
    }

    .complete-actions {
        flex-direction: column;
        gap: 8px;
    }

    .final-list {
        max-height: 300px;
    }

    /* --- 弹窗 --- */
    .modal {
        min-width: auto;
        width: calc(100% - 40px);
        margin: 0 20px;
        padding: 20px;
    }

    .modal h3 {
        font-size: 16px;
    }

    .count-input {
        font-size: 15px;
    }
}

/* 中屏手机 (480px-600px) */
@media (min-width: 481px) and (max-width: 600px) {
    .word-input {
        padding: 16px;
    }

    .header h1 {
        font-size: 22px;
    }

    .step-indicator {
        gap: 8px;
    }

    .step {
        padding: 6px 12px;
    }

    .step-text {
        font-size: 13px;
    }

    .check-card {
        padding: 24px 20px;
    }

    .word-item {
        flex-wrap: wrap;
        gap: 4px 8px;
    }

    .word-meaning {
        width: 100%;
        margin-left: 0;
        padding-left: 30px;
    }

    .btn-large {
        padding: 14px 24px;
    }
}
</style>
