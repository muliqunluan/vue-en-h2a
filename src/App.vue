<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { checkServerHealth } from '@/api'

const serverOnline = ref(false)
const hasApiKey = ref(false)
const checking = ref(true)

onMounted(async () => {
  const status = await checkServerHealth()
  serverOnline.value = status.online
  hasApiKey.value = status.hasApiKey
  checking.value = false
})
</script>

<template>
  <div class="app">
    <!-- 服务器状态栏 -->
    <div class="server-status-bar" :class="{
      online: serverOnline,
      offline: !serverOnline && !checking,
      'no-key': serverOnline && !hasApiKey,
    }">
      <span class="status-dot" :class="{ 'dot-online': serverOnline, 'dot-offline': !serverOnline }"></span>
      <span class="status-text">
        <template v-if="checking">检测中...</template>
        <template v-else-if="!serverOnline">后端服务未连接 (请启动 server/index.js)</template>
        <template v-else-if="!hasApiKey">
          后端已连接，但未配置 API Key — 请复制
          <code>server/.env.example</code> 为 <code>server/.env</code> 并填入你的 DeepSeek API Key
        </template>
        <template v-else>后端服务运行中 ✅ API Key 已配置</template>
      </span>
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

.server-status-bar.no-key {
  background: #fff8e1;
  color: #f57f17;
  border-bottom-color: #ffe082;
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
</style>
