<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { checkServerHealth, validateKey } from '@/api'
import { useApiKeyStore } from '@/stores/apiKey'

const apiKeyStore = useApiKeyStore()

const serverOnline = ref(false)
const checking = ref(true)

const keyInputValue = ref(apiKeyStore.apiKey)
const keyValidating = ref(false)
const keyValidationMsg = ref('')
const keyValidationError = ref(false)
const showKeyInput = ref(!apiKeyStore.configured)

// 设置 API Key
async function handleSetKey() {
  const key = keyInputValue.value.trim()
  if (!key) {
    keyValidationMsg.value = '请输入 API Key'
    keyValidationError.value = true
    return
  }

  keyValidating.value = true
  keyValidationMsg.value = ''
  keyValidationError.value = false
  try {
    const result = await validateKey(key)
    if (result.valid) {
      apiKeyStore.setApiKey(key)
      keyValidationMsg.value = 'API Key 验证通过'
      keyValidationError.value = false
      showKeyInput.value = false
    } else {
      keyValidationMsg.value = result.error || 'API Key 无效'
      keyValidationError.value = true
    }
  } catch {
    keyValidationMsg.value = '验证失败，无法连接到服务器'
    keyValidationError.value = true
  } finally {
    keyValidating.value = false
  }
}

// 清除 API Key
function handleClearKey() {
  apiKeyStore.clearApiKey()
  keyInputValue.value = ''
  keyValidationMsg.value = ''
  keyValidationError.value = false
  showKeyInput.value = true
}

// 切换 Key 输入框显示
function toggleKeyInput() {
  showKeyInput.value = !showKeyInput.value
  if (showKeyInput.value) {
    keyInputValue.value = apiKeyStore.apiKey
    keyValidationMsg.value = ''
    keyValidationError.value = false
  }
}

onMounted(async () => {
  const status = await checkServerHealth()
  serverOnline.value = status.online
  checking.value = false
})
</script>

<template>
  <div class="app">
    <!-- 服务器状态栏 + API Key 配置 -->
    <div class="server-bar" :class="{
      'server-online': serverOnline && !checking,
      'server-offline': !serverOnline && !checking,
    }">
      <div class="server-bar-indicator">
        <span class="server-dot" :class="{ 'dot-online': serverOnline, 'dot-offline': !serverOnline && !checking }"></span>
        <span class="server-text">
          <template v-if="checking">检测中...</template>
          <template v-else-if="!serverOnline">后端服务未连接</template>
          <template v-else-if="!apiKeyStore.configured">
            后端已连接 —
            <a href="#" class="key-link" @click.prevent="toggleKeyInput">配置 API Key</a>
          </template>
          <template v-else>
            已连接 · API Key 已配置
            <a href="#" class="key-link" @click.prevent="toggleKeyInput">[更换]</a>
          </template>
        </span>
      </div>
    </div>

    <!-- API Key 配置区域 -->
    <div v-if="showKeyInput" class="key-section" :class="{ 'key-has': apiKeyStore.configured }">
      <div class="key-section-inner">
        <label class="key-label">
          {{ apiKeyStore.configured ? '更换 API Key' : '配置 DeepSeek API Key' }}
        </label>
        <div class="key-input-row">
          <input
            v-model="keyInputValue"
            type="password"
            class="key-input"
            placeholder="输入你的 DeepSeek API Key (sk-...)"
            @keyup.enter="handleSetKey"
          />
          <button class="apple-btn apple-btn-primary" :disabled="keyValidating" @click="handleSetKey">
            {{ keyValidating ? '验证中...' : (apiKeyStore.configured ? '更新' : '配置') }}
          </button>
          <button v-if="apiKeyStore.configured" class="apple-btn apple-btn-secondary" @click="handleClearKey">
            清除
          </button>
        </div>
        <p v-if="keyValidationMsg" class="key-msg" :class="{ 'key-msg-error': keyValidationError }">
          {{ keyValidationMsg }}
        </p>
        <p v-else class="key-hint">
          输入你的 DeepSeek API Key，它将作为你的用户身份标识，数据将与其他用户隔离。
          <a href="https://platform.deepseek.com/api_keys" target="_blank" class="key-link">获取 API Key</a>
        </p>
      </div>
    </div>

    <RouterView />
  </div>
</template>

<style>
/* ===== CSS 变量 (Apple 设计 Token) ===== */
:root {
  --color-bg: #ffffff;
  --color-bg-secondary: #f2f2f7;
  --color-bg-tertiary: #e5e5ea;
  --color-text-primary: #1c1c1e;
  --color-text-secondary: #8e8e93;
  --color-text-tertiary: #aeaeb2;
  --color-accent-blue: #007aff;
  --color-accent-green: #34c759;
  --color-accent-red: #ff3b30;
  --color-accent-orange: #ff9500;
  --color-border: #e5e5ea;
  --color-separator: #c6c6c8;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 999px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 24px rgba(0, 0, 0, 0.08);
  --font-stack: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
    'Helvetica Neue', Arial, sans-serif;
}

/* ===== 全局样式重置 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-stack);
  background: var(--color-bg);
  color: var(--color-text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

.app {
  min-height: 100vh;
  min-height: 100dvh;
}

/* 触摸目标最小尺寸 */
.apple-btn,
.key-link,
input,
select,
textarea {
  min-height: 44px;
}

/* ===== 服务器状态栏 (Apple 风格) ===== */
.server-bar {
  display: flex;
  align-items: center;
  padding: 4px 16px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  user-select: none;
  transition: background 0.3s, color 0.3s;
}

.server-bar.server-online {
  background: #f7fcf7;
  color: #2c6e2c;
  border-bottom-color: #c8e6c9;
}

.server-bar.server-offline {
  background: #fcf7f7;
  color: #c62828;
  border-bottom-color: #ffcdd2;
}

.server-bar-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.server-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}

.dot-online {
  background: var(--color-accent-green);
  box-shadow: 0 0 4px rgba(52, 199, 89, 0.5);
}

.dot-offline {
  background: var(--color-accent-red);
  box-shadow: 0 0 4px rgba(255, 59, 48, 0.5);
}

.server-text {
  flex: 1;
}

.key-link {
  color: var(--color-accent-blue);
  text-decoration: none;
  cursor: pointer;
  min-height: auto;
}

.key-link:hover {
  text-decoration: underline;
}

/* ===== API Key 配置区域 (Apple 风格) ===== */
.key-section {
  padding: 12px 16px;
  background: #fff9e6;
  border-bottom: 1px solid #ffe0a0;
  font-size: 13px;
}

.key-section.key-has {
  background: #f2faf2;
  border-bottom-color: #c8e6c9;
}

.key-section-inner {
  max-width: 700px;
  margin: 0 auto;
}

.key-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.key-input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.key-input {
  flex: 1;
  min-width: 0;
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 14px;
  padding: 10px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.key-input:focus {
  border-color: var(--color-accent-blue);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

.key-input::placeholder {
  color: var(--color-text-tertiary);
}

/* ===== Apple 风格按钮 ===== */
.apple-btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: var(--color-bg);
  color: var(--color-accent-blue);
  transition: all 0.2s;
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-stack);
}

.apple-btn:hover {
  background: #f0f0f5;
}

.apple-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apple-btn-primary {
  background: var(--color-accent-blue);
  color: white;
}

.apple-btn-primary:hover:not(:disabled) {
  background: #0066d6;
}

.apple-btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.apple-btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
}

.key-msg {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-accent-green);
  font-weight: 500;
}

.key-msg.key-msg-error {
  color: var(--color-accent-red);
}

.key-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .server-bar {
    padding: 4px 12px;
    font-size: 11px;
  }

  .key-section {
    padding: 10px 12px;
  }

  .key-input-row {
    flex-direction: column;
    gap: 6px;
  }

  .key-input {
    width: 100%;
  }

  .apple-btn {
    width: 100%;
    text-align: center;
    padding: 10px 16px;
    font-size: 13px;
  }

  .key-label {
    font-size: 12px;
  }

  .key-hint {
    font-size: 11px;
  }

  .key-msg {
    font-size: 12px;
  }
}
</style>
