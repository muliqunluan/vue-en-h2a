import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { WordItem, CheckWordResult } from '@/api'
import { saveWords, checkWord } from '@/api'

const STORAGE_KEY = 'vue-en-h2a-word-store'

interface PersistedData {
  words: WordItem[]
  step: number
  totalCount: number
}

function loadFromStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // 忽略解析错误
  }
  return null
}

function saveToStorage(data: PersistedData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 忽略存储错误
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略
  }
}

export const useWordStore = defineStore('word', () => {
  // 从 localStorage 恢复数据
  const saved = loadFromStorage()

  // 单词列表
  const words = ref<WordItem[]>(saved?.words || [])
  // 当前流程步骤 (0: 等待输入单词, 1: 等待输入猜测, 2: 显示 AI 检查结果)
  const step = ref(saved?.step || 0)
  // 当前输入的单词
  const currentWord = ref('')
  // 当前输入的猜测
  const currentGuess = ref('')
  // 总流程数
  const totalCount = ref(saved?.totalCount || 20)
  // 是否正在保存
  const saving = ref(false)
  // 保存结果信息
  const saveResult = ref('')

  // AI 即时检查结果
  const checkResult = ref<CheckWordResult | null>(null)
  const checking = ref(false)
  const checkError = ref('')

  // 当前进度
  const progress = computed(() => words.value.length)

  // 是否完成
  const isComplete = computed(() => words.value.length >= totalCount.value)

  // 自动持久化到 localStorage
  watch(
    [words, step, totalCount],
    () => {
      if (words.value.length > 0 || step.value !== 0) {
        saveToStorage({
          words: words.value,
          step: step.value,
          totalCount: totalCount.value,
        })
      }
    },
    { deep: true }
  )

  /**
   * 提交单词
   */
  function submitWord(word: string) {
    if (!word.trim()) return false
    currentWord.value = word.trim()
    step.value = 1
    return true
  }

  /**
   * 从猜测模式返回单词输入模式
   */
  function goBackToWord() {
    step.value = 0
    currentWord.value = ''
    currentGuess.value = ''
  }

  /**
   * 提交猜测并触发 AI 检查
   */
  function submitGuess(guess: string) {
    if (!guess.trim()) return false
    currentGuess.value = guess.trim()

    words.value.push({
      word: currentWord.value,
      guess: currentGuess.value,
    })

    // 切换到结果显示步骤并触发 AI 检查
    step.value = 2
    triggerCheck(currentWord.value, currentGuess.value)

    return true
  }

  /**
   * 调用 AI 检查当前单词
   */
  async function triggerCheck(word: string, guess: string) {
    checking.value = true
    checkError.value = ''
    checkResult.value = null
    try {
      const result = await checkWord(word, guess)
      checkResult.value = result
      // 将 AI 结果回填到已记录的单词中
      const lastWord = words.value[words.value.length - 1]
      if (lastWord) {
        lastWord.meaning = result.meaning
        lastWord.match = result.match
        lastWord.pos = result.pos
      }
    } catch (err: any) {
      checkError.value = err.message
    } finally {
      checking.value = false
    }
  }

  /**
   * 继续下一个单词（从结果页返回输入页）
   */
  function proceedToNext() {
    checkResult.value = null
    checkError.value = ''
    currentWord.value = ''
    currentGuess.value = ''
    step.value = 0
  }

  /**
   * 保存到文件
   */
  async function saveToFile() {
    if (words.value.length === 0) return

    saving.value = true
    saveResult.value = ''
    try {
      const result = await saveWords(words.value, totalCount.value)
      saveResult.value = `已保存到文件: ${result.fileName}`
      // 重置并清除 localStorage
      words.value = []
      step.value = 0
      clearStorage()
      return result
    } catch (err: any) {
      saveResult.value = `保存失败: ${err.message}`
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * 设置总流程数
   */
  function setTotalCount(count: number) {
    if (count > 0) {
      totalCount.value = count
    }
  }

  /**
   * 重置
   */
  function reset() {
    words.value = []
    step.value = 0
    currentWord.value = ''
    currentGuess.value = ''
    saveResult.value = ''
    checkResult.value = null
    checkError.value = ''
    clearStorage()
  }

  return {
    words,
    step,
    currentWord,
    currentGuess,
    totalCount,
    saving,
    saveResult,
    checkResult,
    checking,
    checkError,
    progress,
    isComplete,
    submitWord,
    submitGuess,
    goBackToWord,
    proceedToNext,
    saveToFile,
    setTotalCount,
    reset,
  }
})
