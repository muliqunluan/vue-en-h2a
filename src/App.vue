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
const showKeyInput = ref(!apiKeyStore.configured)

// 设置 API Key
async function handleSetKey() {
  const key = keyInputValue.value.trim()
  if (!key) {
    keyValidationMsg.value = '请输入 API Key'
    return
  }

  keyValidating.value = true
  keyValidationMsg.value = ''
  try {
    const result = await validateKey(key)
    if (result.valid) {
      apiKeyStore.setApiKey(key)
      keyValidationMsg.value = '✅ API Key 验证通过'
      showKeyInput.value = false
    } else {
      keyValidationMsg.value = `❌ ${result.error || 'API Key 无效'}`
    }
  } catch {
    keyValidationMsg.value = '❌ 验证失败，无法连接到服务器'
  } finally {
    keyValidating.value = false
  }
}

// 清除 API Key
function handleClearKey() {
  apiKeyStore.clearApiKey()
  keyInputValue.value = ''
  keyValidationMsg.value = ''
  showKeyInput.value = true
}

// 切换 Key 输入框显示
function toggleKeyInput() {
  showKeyInput.value = !showKeyInput.value
  if (showKeyInput.value) {
    keyInputValue.value = apiKeyStore.apiKey
    keyValidationMsg.value = ''
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
    <div class="server-status-bar" :class="{
      online: serverOnline,
      offline: !serverOnline && !checking,
    }">
      <span class="status-dot" :class="{ 'dot-online': serverOnline, 'dot-offline': !serverOnline }"></span>
      <span class="status-text">
        <template v-if="checking">检测中...</template>
        <template v-else-if="!serverOnline">❌ 后端服务未连接 (请启动 server/index.js)</template>
        <template v-else-if="!apiKeyStore.configured">
          ✅ 后端已连接 — <a href="#" class="key-action-link" @click.prevent="toggleKeyInput">点击配置你的 API Key</a>
        </template>
        <template v-else>
          ✅ 已连接 · API Key 已配置
          <a href="#" class="key-action-link" @click.prevent="toggleKeyInput">[更换]</a>
        </template>
      </span>
    </div>

    <!-- API Key 配置区域 -->
    <div v-if="showKeyInput" class="api-key-section" :class="{ 'has-key': apiKeyStore.configured }">
      <div class="api-key-row">
        <label class="api-key-label">
          {{ apiKeyStore.configured ? '🔄 更换 API Key' : '🔑 配置你的 DeepSeek API Key' }}
        </label>
        <div class="api-key-input-group">
          <input
            v-model="keyInputValue"
            type="password"
            class="input api-key-input"
            placeholder="输入你的 DeepSeek API Key (sk-...)"
            @keyup.enter="handleSetKey"
          />
          <button class="btn btn-primary" :disabled="keyValidating" @click="handleSetKey">
            {{ keyValidating ? '验证中...' : (apiKeyStore.configured ? '更新' : '配置') }}
          </button>
          <button v-if="apiKeyStore.configured" class="btn btn-secondary" @click="handleClearKey">
            清除
          </button>
        </div>
        <p v-if="keyValidationMsg" class="key-validation-msg" :class="{ error: keyValidationMsg.includes('❌') }">
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
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
  background: #f5f7fa;
  color: #333;
  line-height: 1.6;
  /* 防止 iOS 上输入框缩放 */
  -webkit-text-size-adjust: 100%;
}

.app {
  min-height: 100vh;
  min-height: 100dvh;
  /* 支持动态视口高度，移动端地址栏收起时填满 */
}

/* 触摸目标最小尺寸（iOS 推荐 44px） */
.btn,
.nav-link,
button,
input,
select,
textarea {
  min-height: 44px;
}

/* 小屏设备基础调整 */
@media (max-width: 600px) {
  body {
    font-size: 15px;
  }
}

/* 大屏手机/小平板 */
@media (min-width: 601px) and (max-width: 1024px) {
  body {
    font-size: 16px;
  }
}

/* 服务器状态栏 */
.server-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  font-size: 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  color: #999;
  user-select: none;
}

.server-status-bar.online {
  background: #f1f8e9;
  color: #558b2f;
  border-bottom-color: #c5e1a5;
}

.server-status-bar.offline {
  background: #fbe9e7;
  color: #c62828;
  border-bottom-color: #ffccbc;
}

.server-status-bar code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  flex-shrink: 0;
}

.dot-online {
  background: #4caf50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
}

.dot-offline {
  background: #f44336;
  box-shadow: 0 0 4px rgba(244, 67, 54, 0.5);
}

.status-text {
  flex: 1;
}

.key-action-link {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
}

/* API Key 配置区域 */
.api-key-section {
  padding: 12px 16px;
  background: #fff8e1;
  border-bottom: 1px solid #ffe082;
  font-size: 13px;
}

.api-key-section.has-key {
  background: #e8f5e9;
  border-bottom-color: #c5e1a5;
}

.api-key-row {
  max-width: 700px;
  margin: 0 auto;
}

.api-key-label {
  display: block;
  font-weight: bold;
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}

.api-key-input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.api-key-input {
  flex: 1;
  min-width: 0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.input {
  padding: 10px 14px;
  font-size: 14px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #4a90d9;
}

.btn {
  padding: 10px 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
  white-space: nowrap;
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
  background: #f5f5f5;
  border-color: #ddd;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.key-validation-msg {
  margin-top: 8px;
  font-size: 13px;
  color: #2e7d32;
  font-weight: 500;
}

.key-validation-msg.error {
  color: #c62828;
}

.key-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.key-link {
  color: #1976d2;
  text-decoration: underline;
}

/* ========================================
   移动端适配 - App.vue
   ======================================== */

@media (max-width: 480px) {
  .server-status-bar {
    padding: 6px 12px;
    font-size: 11px;
  }

  .api-key-section {
    padding: 10px 12px;
  }

  .api-key-input-group {
    flex-direction: column;
    gap: 6px;
  }

  .api-key-input {
    width: 100%;
  }

  .btn {
    width: 100%;
    text-align: center;
    padding: 10px 16px;
    font-size: 13px;
  }

  .api-key-label {
    font-size: 13px;
  }

  .key-hint {
    font-size: 11px;
  }

  .key-validation-msg {
    font-size: 12px;
  }
}

@media (min-width: 481px) and (max-width: 600px) {
  .server-status-bar {
    padding: 6px 14px;
  }

  .api-key-section {
    padding: 10px 14px;
  }
}
</style>
