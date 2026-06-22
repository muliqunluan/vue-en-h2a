import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'vue-en-h2a-api-key'

/**
 * API Key 管理 Store
 * 管理用户的 API Key 存取（localStorage）
 */
export const useApiKeyStore = defineStore('apiKey', () => {
  // 从 localStorage 恢复
  const saved = loadFromStorage()

  const apiKey = ref(saved || '')
  const configured = ref(!!saved)

  function loadFromStorage(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch {
      return ''
    }
  }

  function saveToStorage(key: string) {
    try {
      if (key) {
        localStorage.setItem(STORAGE_KEY, key)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 设置 API Key
   */
  function setApiKey(key: string) {
    apiKey.value = key
    configured.value = !!key
    saveToStorage(key)
  }

  /**
   * 清除 API Key
   */
  function clearApiKey() {
    apiKey.value = ''
    configured.value = false
    saveToStorage('')
  }

  return {
    apiKey,
    configured,
    setApiKey,
    clearApiKey,
  }
})
