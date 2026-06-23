<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useWordStore } from '@/stores/word'

const store = useWordStore()

// 输入框
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const countInputRef = ref<HTMLInputElement | null>(null)
const showCountConfig = ref(false)
const tempCount = ref(String(store.totalCount))

// 动画状态
const animateIn = ref(false)
const showSourceCard = ref(false)
const showTargetCard = ref(false)
const showResult = ref(false)

// 自动聚焦输入框
watch(() => store.step, () => {
  animateIn.value = false
  showSourceCard.value = false
  showTargetCard.value = false
  showResult.value = false
  nextTick(() => {
    inputRef.value?.focus()
    // 触发入场动画
    requestAnimationFrame(() => {
      animateIn.value = true
    })
  })
})

// 当前记录的最后一个单词
const lastWord = computed(() => {
  return store.words.length > 0 ? store.words[store.words.length - 1] : null
})

// 处理回车
function handleEnter() {
  const value = inputValue.value.trim()
  if (!value) return

  if (store.step === 0) {
    store.submitWord(value)
    inputValue.value = ''
  } else if (store.step === 1) {
    store.submitGuess(value)
    inputValue.value = ''
  }
}

// 键盘事件：在 AI 结果页按 Enter 进入下一步
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && store.step === 2 && !store.checking && !store.checkError && store.checkResult) {
    e.preventDefault()
    store.proceedToNext()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  // 初始入场动画
  requestAnimationFrame(() => {
    animateIn.value = true
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

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

// 判断 saveResult 是否为错误
const isSaveError = computed(() => {
  return store.saveResult.startsWith('保存失败')
})
</script>

<template>
  <div class="word-input">
    <!-- 顶部标题栏 -->
    <header class="wi-header">
      <div class="wi-header-left">
        <h1 class="wi-title">英语单词</h1>
        <span class="wi-progress-badge">{{ store.progress }}/{{ store.totalCount }}</span>
      </div>
      <div class="wi-header-right">
        <button class="wi-icon-btn" @click="showCountConfig = true" title="设置目标数量">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M9 5.5v7M5.5 9h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <router-link to="/docs" class="wi-link">文档</router-link>
      </div>
    </header>

    <!-- 数量配置弹窗 -->
    <div v-if="showCountConfig" class="modal-overlay" @click.self="showCountConfig = false">
      <div class="modal-card">
        <h3 class="modal-title">设置单词数量</h3>
        <p class="modal-hint">每次练习的目标单词数 (1-1000)</p>
        <input ref="countInputRef" v-model="tempCount" type="number" min="1" max="1000"
          class="modal-input" @keyup.enter="confirmCount" />
        <div class="modal-actions">
          <button class="apple-btn" @click="confirmCount">确定</button>
          <button class="apple-btn apple-btn-ghost" @click="showCountConfig = false">取消</button>
        </div>
      </div>
    </div>

    <!-- ===== 步骤 0 & 1: 输入区域 ===== -->
    <div class="wi-main" v-if="store.step <= 1 && !store.isComplete">
      <!-- 语言指示器 (Apple 翻译 App 风格) -->
      <div class="lang-indicator" :class="{ 'lang-shifted': store.step === 1 }">
        <div class="lang-pill" :class="{ 'lang-active': store.step === 0, 'lang-done': store.step === 1 }">
          <span class="lang-code">EN</span>
          <span class="lang-name">英语</span>
        </div>
        <div class="lang-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="lang-pill" :class="{ 'lang-active': store.step === 1 }">
          <span class="lang-code">CN</span>
          <span class="lang-name">中文</span>
        </div>
      </div>

      <!-- 步骤 0: 输入英文单词 -->
      <div v-if="store.step === 0" class="input-stage" :class="{ 'animate-in': animateIn }">
        <div class="input-card">
          <label class="input-card-label">英文单词</label>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="apple-input apple-input-large"
            placeholder="输入英文单词..."
            @keyup.enter="handleEnter"
            autofocus
          />
          <p class="input-hint">按 Enter 提交</p>
        </div>
      </div>

      <!-- 步骤 1: 输入含义猜测 -->
      <div v-else class="input-stage" :class="{ 'animate-in': animateIn }">
        <div class="input-card">
          <label class="input-card-label">中文含义猜测</label>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="apple-input apple-input-large"
            placeholder="猜测这个单词的含义..."
            @keyup.enter="handleEnter"
            autofocus
          />
          <p class="input-hint">按 Enter 提交猜测</p>
        </div>
      </div>

      <!-- 已记录单词列表 (预览) -->
      <div v-if="store.words.length > 0" class="preview-section">
        <div class="preview-header">
          <span class="preview-title">已记录 ({{ store.words.length }})</span>
        </div>
        <div class="preview-list">
          <div
            v-for="(item, index) in store.words"
            :key="index"
            class="preview-item"
            :class="{
              'preview-match': item.match === '基本吻合',
              'preview-mismatch': item.match === '差距过大'
            }"
          >
            <span class="preview-index">#{{ index + 1 }}</span>
            <span class="preview-en">{{ item.word }}</span>
            <span class="preview-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="preview-guess" :class="{ 'preview-guess-wrong': item.match === '差距过大' }">
              {{ item.guess }}
            </span>
            <template v-if="item.match === '差距过大' && item.meaning">
              <span class="preview-arrow preview-arrow-sm">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5h6M5.5 2.5l3 2.5-3 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="preview-correct">{{ item.meaning }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 步骤 2: AI 检查结果 (Apple 翻译 App 风格) ===== -->
    <div v-else-if="store.step === 2" class="wi-main result-page">
      <!-- 语言指示器 (完成版本) -->
      <div class="lang-indicator lang-result">
        <div class="lang-pill lang-done">
          <span class="lang-code">EN</span>
          <span class="lang-name">英语</span>
        </div>
        <div class="lang-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="lang-pill lang-done">
          <span class="lang-code">CN</span>
          <span class="lang-name">中文</span>
        </div>
        <div class="lang-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="lang-pill lang-active">
          <span class="lang-code">AI</span>
          <span class="lang-name">验证</span>
        </div>
      </div>

      <div class="result-card">
        <!-- 加载中 -->
        <div v-if="store.checking" class="result-loading">
          <div class="result-spinner"></div>
          <p class="result-loading-text">AI 正在分析...</p>
        </div>

        <!-- 错误 -->
        <div v-else-if="store.checkError" class="result-error">
          <div class="result-error-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#ff3b30" stroke-width="2" fill="#fff5f5"/>
              <path d="M20 12v10M20 26v2" stroke="#ff3b30" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="result-error-text">{{ store.checkError }}</p>
          <button class="apple-btn apple-btn-primary" @click="store.proceedToNext()">跳过，继续下一个</button>
        </div>

        <!-- 结果 (Apple 翻译 App 核心界面) -->
        <div v-else-if="store.checkResult" class="result-content">
          <!-- 源语言单词 -->
          <div class="trans-source">
            <div class="trans-label">英语</div>
            <div class="trans-word">{{ store.checkResult.word }}</div>
          </div>

          <!-- 分隔箭头 -->
          <div class="trans-divider">
            <div class="trans-divider-line"></div>
            <div class="trans-divider-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="var(--color-text-tertiary, #aeaeb2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="trans-divider-line"></div>
          </div>

          <!-- 用户猜测 -->
          <div class="trans-target">
            <div class="trans-label">你的猜测</div>
            <div class="trans-word trans-guess" :class="{ 'trans-guess-wrong': store.checkResult.match === '差距过大' }">
              {{ lastWord?.guess || '' }}
            </div>
          </div>

          <!-- 匹配度标签 -->
          <div class="match-badge" :class="store.checkResult.match === '基本吻合' ? 'match-ok' : 'match-fail'">
            <div class="match-icon">
              <svg v-if="store.checkResult.match === '基本吻合'" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7.5l3.5 3.5L12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <span>{{ store.checkResult.match }}</span>
          </div>

          <!-- 真实含义部分 (Apple 翻译 App 的详细信息) -->
          <div class="trans-details">
            <div class="trans-details-header">
              <span class="trans-details-label">真实含义</span>
            </div>
            <div class="trans-details-row">
              <span class="trans-details-key">词性</span>
              <span class="trans-details-value trans-pos">{{ store.checkResult.pos }}</span>
            </div>
            <div class="trans-details-row">
              <span class="trans-details-key">释义</span>
              <span class="trans-details-value trans-meaning">{{ store.checkResult.meaning }}</span>
            </div>
          </div>

          <!-- 继续按钮 -->
          <button class="apple-btn apple-btn-primary apple-btn-block" @click="store.proceedToNext()">
            {{ store.isComplete ? '查看总结' : '继续下一个' }}
          </button>
          <p class="enter-hint">按 Enter 继续</p>
        </div>
      </div>
    </div>

    <!-- ===== 完成区域 ===== -->
    <div v-else class="wi-main complete-page">
      <div class="complete-card">
        <div class="complete-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="26" fill="#f0faf0" stroke="#34c759" stroke-width="2"/>
            <path d="M18 28l7 7 13-13" stroke="#34c759" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="complete-title">已完成 {{ store.totalCount }} 个单词</h2>

        <div class="complete-stats">
          <div class="stat-item">
            <span class="stat-value stat-ok">{{ store.words.filter(w => w.match === '基本吻合').length }}</span>
            <span class="stat-label">基本吻合</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value stat-fail">{{ store.words.filter(w => w.match === '差距过大').length }}</span>
            <span class="stat-label">差距过大</span>
          </div>
        </div>

        <div class="complete-list">
          <div
            v-for="(item, index) in store.words"
            :key="index"
            class="complete-item"
            :class="{ 'item-match': item.match === '基本吻合', 'item-mismatch': item.match === '差距过大' }"
          >
            <span class="complete-index">#{{ index + 1 }}</span>
            <span class="complete-en">{{ item.word }}</span>
            <span class="complete-arrow">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5h6M5.5 2.5l3 2.5-3 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="complete-guess" :class="{ 'guess-wrong': item.match === '差距过大' }">{{ item.guess }}</span>
            <span v-if="item.match === '差距过大' && item.meaning" class="complete-correct">{{ item.meaning }}</span>
            <span class="complete-badge" :class="item.match === '基本吻合' ? 'badge-ok' : 'badge-fail'">
              {{ item.match === '基本吻合' ? 'OK' : '×' }}
            </span>
          </div>
        </div>

        <div class="complete-actions">
          <button class="apple-btn apple-btn-primary apple-btn-block" :disabled="store.saving" @click="handleSave">
            {{ store.saving ? '保存中...' : '保存到文件' }}
          </button>
          <button class="apple-btn apple-btn-secondary apple-btn-block" @click="handleReset">重新开始</button>
        </div>

        <div v-if="store.saveResult" class="save-result" :class="{ 'save-error': isSaveError }">
          {{ store.saveResult }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== WordInput — Apple 翻译 App 风格 ===== */

.word-input {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 20px 32px;
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

/* ===== 顶部标题栏 ===== */
.wi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.wi-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wi-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--color-text-primary, #1c1c1e);
  margin: 0;
}

.wi-progress-badge {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #8e8e93);
  background: var(--color-bg-secondary, #f2f2f7);
  padding: 4px 12px;
  border-radius: var(--radius-pill, 999px);
}

.wi-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wi-icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-accent-blue, #007aff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.wi-icon-btn:hover {
  background: var(--color-bg-tertiary, #e5e5ea);
}

.wi-link {
  color: var(--color-accent-blue, #007aff);
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-pill, 999px);
  transition: background 0.2s;
}

.wi-link:hover {
  background: var(--color-bg-secondary, #f2f2f7);
}

/* ===== 弹窗 (Apple 风格) ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal-card {
  background: var(--color-bg, #ffffff);
  padding: 28px;
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--shadow-lg, 0 4px 24px rgba(0,0,0,0.08));
  min-width: 320px;
  max-width: 90vw;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text-primary, #1c1c1e);
}

.modal-hint {
  font-size: 13px;
  color: var(--color-text-secondary, #8e8e93);
  margin-bottom: 16px;
}

.modal-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 17px;
  border: 1.5px solid var(--color-border, #e5e5ea);
  border-radius: var(--radius-md, 12px);
  outline: none;
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-text-primary, #1c1c1e);
  font-family: var(--font-stack, -apple-system, sans-serif);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.modal-input:focus {
  border-color: var(--color-accent-blue, #007aff);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  background: var(--color-bg, #ffffff);
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

.modal-actions .apple-btn {
  min-width: 80px;
}

/* ===== 主内容区域 ===== */
.wi-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ===== 语言指示器 (Apple 翻译 App 风格) ===== */
.lang-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
  transition: all 0.3s;
}

.lang-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-text-secondary, #8e8e93);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
  user-select: none;
}

.lang-pill.lang-active {
  background: var(--color-accent-blue, #007aff);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
}

.lang-pill.lang-done {
  background: #e8f5e9;
  color: #2e7d32;
}

.lang-code {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.lang-name {
  font-size: 13px;
}

.lang-arrow {
  color: var(--color-text-tertiary, #aeaeb2);
  display: flex;
  align-items: center;
}

.lang-shifted {
  /* 步骤变化时的轻微动画 */
}

/* ===== 输入阶段 ===== */
.input-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.input-stage.animate-in {
  opacity: 1;
  transform: translateY(0);
}

/* 输入卡片 */
.input-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.input-card-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #8e8e93);
  margin-bottom: 10px;
}

/* ===== Apple 风格输入框 ===== */
.apple-input {
  width: 100%;
  padding: 14px 18px;
  font-size: 17px;
  border: 1.5px solid var(--color-border, #e5e5ea);
  border-radius: var(--radius-md, 12px);
  outline: none;
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-text-primary, #1c1c1e);
  font-family: var(--font-stack, -apple-system, sans-serif);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  box-sizing: border-box;
}

.apple-input:focus {
  border-color: var(--color-accent-blue, #007aff);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  background: var(--color-bg, #ffffff);
}

.apple-input::placeholder {
  color: var(--color-text-tertiary, #aeaeb2);
}

.apple-input-large {
  font-size: 20px;
  padding: 16px 20px;
  text-align: center;
}

.input-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary, #aeaeb2);
}

/* ===== 预览列表 (Apple 风格) ===== */
.preview-section {
  margin-top: 32px;
  border-top: 1px solid var(--color-border, #e5e5ea);
  padding-top: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #8e8e93);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--color-bg, #ffffff);
  border-radius: var(--radius-md, 12px);
  font-size: 14px;
  transition: all 0.2s;
  border: 1px solid var(--color-border, #e5e5ea);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04));
}

.preview-index {
  color: var(--color-text-tertiary, #aeaeb2);
  font-size: 12px;
  min-width: 24px;
  font-weight: 500;
}

.preview-en {
  font-weight: 600;
  color: var(--color-text-primary, #1c1c1e);
}

.preview-arrow {
  color: var(--color-text-tertiary, #aeaeb2);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.preview-arrow-sm {
  display: flex;
  align-items: center;
  color: var(--color-text-tertiary, #aeaeb2);
  flex-shrink: 0;
}

.preview-guess {
  color: var(--color-text-primary, #1c1c1e);
}

.preview-guess-wrong {
  color: var(--color-text-tertiary, #aeaeb2);
  text-decoration: line-through;
}

.preview-correct {
  font-size: 12px;
  color: var(--color-accent-blue, #007aff);
  font-weight: 500;
  flex-shrink: 0;
}

/* ===== 结果页 (Apple 翻译 App 核心) ===== */
.result-page {
  align-items: center;
}

.lang-indicator.lang-result {
  margin-bottom: 24px;
}

.result-card {
  width: 100%;
  max-width: 480px;
  background: var(--color-bg, #ffffff);
  border-radius: var(--radius-xl, 20px);
  box-shadow: var(--shadow-md, 0 2px 12px rgba(0,0,0,0.06));
  padding: 28px 24px;
  border: 1px solid var(--color-border, #e5e5ea);
}

/* 加载 */
.result-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
}

.result-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border, #e5e5ea);
  border-top-color: var(--color-accent-blue, #007aff);
  border-radius: 50%;
  animation: result-spin 0.7s linear infinite;
  margin-bottom: 16px;
}

@keyframes result-spin {
  to { transform: rotate(360deg); }
}

.result-loading-text {
  color: var(--color-text-secondary, #8e8e93);
  font-size: 15px;
}

/* 错误 */
.result-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.result-error-icon {
  margin-bottom: 12px;
}

.result-error-text {
  color: var(--color-accent-red, #ff3b30);
  font-size: 14px;
  margin-bottom: 20px;
  text-align: center;
}

/* 结果内容 (Apple 翻译 App 风格) */
.result-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

/* 源语言部分 */
.trans-source {
  width: 100%;
  text-align: center;
  padding: 12px 0 8px;
}

.trans-target {
  width: 100%;
  text-align: center;
  padding: 8px 0 16px;
}

.trans-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary, #8e8e93);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.trans-word {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary, #1c1c1e);
  letter-spacing: -0.5px;
  line-height: 1.3;
  word-break: break-word;
}

.trans-guess {
  color: var(--color-text-secondary, #8e8e93);
  font-weight: 600;
}

.trans-guess-wrong {
  color: var(--color-text-tertiary, #aeaeb2);
  text-decoration: line-through;
}

/* 分隔线 */
.trans-divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.trans-divider-line {
  flex: 1;
  height: 1px;
  background: var(--color-border, #e5e5ea);
}

.trans-divider-icon {
  color: var(--color-text-tertiary, #aeaeb2);
  display: flex;
  align-items: center;
}

/* 匹配度标签 */
.match-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: var(--radius-pill, 999px);
  font-size: 14px;
  font-weight: 600;
  margin: 4px 0 20px;
  animation: match-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes match-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.match-ok {
  background: #e8f5e9;
  color: #2e7d32;
}

.match-fail {
  background: #fbe9e7;
  color: #c62828;
}

.match-icon {
  display: flex;
  align-items: center;
}

/* 真实含义详情 */
.trans-details {
  width: 100%;
  background: var(--color-bg-secondary, #f2f2f7);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 20px;
}

.trans-details-header {
  margin-bottom: 12px;
}

.trans-details-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #8e8e93);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.trans-details-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 0;
  gap: 12px;
}

.trans-details-key {
  font-size: 14px;
  color: var(--color-text-secondary, #8e8e93);
  min-width: 50px;
  flex-shrink: 0;
}

.trans-details-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-primary, #1c1c1e);
  text-align: right;
  flex: 1;
}

.trans-pos {
  color: #7b1fa2;
  font-weight: 600;
}

.trans-meaning {
  color: var(--color-accent-blue, #007aff);
  font-weight: 600;
  font-size: 16px;
}

/* ===== Apple 风格按钮 ===== */
.apple-btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-accent-blue, #007aff);
  transition: all 0.2s;
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-stack, -apple-system, sans-serif);
}

.apple-btn:hover {
  background: var(--color-bg-tertiary, #e5e5ea);
}

.apple-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apple-btn-primary {
  background: var(--color-accent-blue, #007aff);
  color: white;
}

.apple-btn-primary:hover:not(:disabled) {
  background: #0066d6;
}

.apple-btn-secondary {
  background: var(--color-bg-secondary, #f2f2f7);
  color: var(--color-text-primary, #1c1c1e);
}

.apple-btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e5ea);
}

.apple-btn-ghost {
  background: transparent;
  color: var(--color-text-secondary, #8e8e93);
}

.apple-btn-ghost:hover {
  background: var(--color-bg-secondary, #f2f2f7);
}

.apple-btn-block {
  width: 100%;
  max-width: 300px;
}

.enter-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary, #aeaeb2);
  text-align: center;
}

/* ===== 完成页面 ===== */
.complete-page {
  align-items: center;
}

.complete-card {
  width: 100%;
  max-width: 520px;
  text-align: center;
}

.complete-icon {
  margin-bottom: 16px;
}

.complete-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary, #1c1c1e);
  margin-bottom: 24px;
  letter-spacing: -0.3px;
}

.complete-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 28px;
  padding: 16px 24px;
  background: var(--color-bg-secondary, #f2f2f7);
  border-radius: var(--radius-lg, 14px);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-value.stat-ok { color: var(--color-accent-green, #34c759); }
.stat-value.stat-fail { color: var(--color-accent-red, #ff3b30); }

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary, #8e8e93);
  font-weight: 500;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border, #e5e5ea);
}

.complete-list {
  max-height: 320px;
  overflow-y: auto;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.complete-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-bg-secondary, #f2f2f7);
  border-radius: var(--radius-md, 12px);
  font-size: 14px;
  border-left: 3px solid transparent;
}

.complete-item.item-match {
  border-left-color: var(--color-accent-green, #34c759);
}

.complete-item.item-mismatch {
  border-left-color: var(--color-accent-red, #ff3b30);
}

.complete-index {
  color: var(--color-text-tertiary, #aeaeb2);
  font-size: 12px;
  min-width: 24px;
  font-weight: 500;
}

.complete-en {
  font-weight: 600;
  color: var(--color-text-primary, #1c1c1e);
}

.complete-arrow {
  color: var(--color-text-tertiary, #aeaeb2);
  display: flex;
  align-items: center;
}

.complete-guess {
  color: var(--color-text-secondary, #8e8e93);
}

.complete-guess.guess-wrong {
  color: var(--color-text-tertiary, #aeaeb2);
  text-decoration: line-through;
}

.complete-correct {
  font-size: 12px;
  color: var(--color-accent-green, #34c759);
  font-weight: 500;
  margin-left: auto;
}

.complete-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill, 999px);
  margin-left: auto;
  flex-shrink: 0;
}

.badge-ok {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-fail {
  background: #fbe9e7;
  color: #c62828;
}

.complete-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.save-result {
  padding: 12px 16px;
  border-radius: var(--radius-md, 12px);
  font-size: 14px;
  background: #f0faf0;
  color: var(--color-accent-green, #34c759);
}

.save-result.save-error {
  background: #fcf0f0;
  color: var(--color-accent-red, #ff3b30);
}

/* ========================================
   移动端适配
   ======================================== */

@media (max-width: 480px) {
  .word-input {
    padding: 12px 14px 24px;
  }

  .wi-header {
    margin-bottom: 16px;
  }

  .wi-title {
    font-size: 22px;
  }

  .wi-progress-badge {
    font-size: 12px;
    padding: 3px 10px;
  }

  .lang-indicator {
    margin-bottom: 20px;
    gap: 6px;
  }

  .lang-pill {
    padding: 6px 14px;
    font-size: 12px;
  }

  .lang-code {
    font-size: 11px;
  }

  .lang-name {
    font-size: 12px;
  }

  .lang-arrow svg {
    width: 14px;
    height: 14px;
  }

  .apple-input-large {
    font-size: 18px;
    padding: 14px 16px;
  }

  .input-card-label {
    font-size: 12px;
  }

  .preview-section {
    margin-top: 20px;
    padding-top: 12px;
  }

  .preview-item {
    padding: 10px 12px;
    font-size: 13px;
    flex-wrap: wrap;
    gap: 4px 8px;
    width: 100%;
  }

  .preview-correct {
    font-size: 11px;
  }

  .result-card {
    padding: 20px 16px;
    border-radius: var(--radius-lg, 14px);
  }

  .trans-word {
    font-size: 26px;
  }

  .trans-details {
    padding: 12px;
  }

  .trans-details-row {
    flex-direction: column;
    gap: 2px;
  }

  .trans-details-value {
    text-align: left;
  }

  .complete-title {
    font-size: 20px;
  }

  .complete-stats {
    gap: 16px;
    padding: 14px 18px;
  }

  .stat-value {
    font-size: 24px;
  }

  .complete-item {
    padding: 8px 12px;
    font-size: 13px;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .complete-correct {
    width: 100%;
    margin-left: 0;
    padding-left: 32px;
    font-size: 11px;
  }

  .apple-btn {
    padding: 10px 20px;
    font-size: 14px;
  }

  .apple-btn-block {
    max-width: 100%;
  }

  .modal-card {
    padding: 24px 20px;
    min-width: auto;
    width: calc(100% - 32px);
  }

  .modal-title {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .enter-hint {
    display: none;
  }
}

@media (min-width: 481px) and (max-width: 600px) {
  .word-input {
    padding: 14px 18px 28px;
  }

  .wi-title {
    font-size: 24px;
  }

  .trans-word {
    font-size: 28px;
  }

  .result-card {
    padding: 24px 20px;
  }
}
</style>
