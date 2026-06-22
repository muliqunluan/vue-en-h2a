// API 基础地址：优先使用 Vite 构建时注入的环境变量，否则默认本地开发地址
// 部署时: VITE_API_BASE=http://your-server-ip:3001/api npm run build
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

// localStorage 中 API Key 的存储键名（与 stores/apiKey.ts 保持一致）
const API_KEY_STORAGE_KEY = 'vue-en-h2a-api-key'

/**
 * 从 localStorage 获取当前用户的 API Key
 * 用于在 API 请求中自动添加 X-Api-Key 请求头
 */
function getApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/**
 * 创建包含 API Key 的请求头
 */
function createHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const apiKey = getApiKey()
  if (apiKey) {
    headers['X-Api-Key'] = apiKey
  }
  return headers
}

export interface HealthStatus {
  online: boolean
}

/**
 * 健康检查 - 检测后端服务器是否在线
 */
export async function checkServerHealth(): Promise<HealthStatus> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${API_BASE}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      return { online: !!data.status && data.status === 'ok' }
    }
    return { online: false }
  } catch {
    return { online: false }
  }
}

export interface ValidateKeyResponse {
  valid: boolean
  error?: string
}

/**
 * 验证用户提供的 API Key 是否有效
 */
export async function validateKey(apiKey: string): Promise<ValidateKeyResponse> {
  try {
    const res = await fetch(`${API_BASE}/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    return res.json()
  } catch {
    return { valid: false, error: '无法连接到服务器' }
  }
}

export interface WordItem {
  word: string
  guess: string
  meaning?: string
  match?: string
  pos?: string
}

export interface CheckWordResult {
  word: string
  pos: string
  meaning: string
  match: '基本吻合' | '差距过大'
}

export interface DocInfo {
  fileName: string
  filePath: string
  dayKey: string
  createdAt: string
  hasAi: boolean
}

export interface DocGroup {
  day: string
  items: DocInfo[]
}

export interface SaveWordsResponse {
  success: boolean
  fileName: string
  filePath: string
}

export interface TranslateResponse {
  success: boolean
  originalFile: string
  newFile: string
  wordsCount: number
}

export interface BatchTranslateResponse {
  success: boolean
  processed: number
  message?: string
  results?: Array<{ file: string; success: boolean; error?: string }>
}

/**
 * 保存单词记录到 MD 文件
 */
export async function saveWords(words: WordItem[], count: number): Promise<SaveWordsResponse> {
  const res = await fetch(`${API_BASE}/save-words`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ words, count }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '保存失败')
  }
  return res.json()
}

/**
 * 获取所有 MD 文档列表（按天分组）
 */
export async function getDocs(): Promise<{ groups: DocGroup[] }> {
  const res = await fetch(`${API_BASE}/docs`, {
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '获取文档列表失败')
  }
  return res.json()
}

/**
 * 读取单个 MD 文件内容
 */
export async function getDocContent(fileName: string): Promise<{ fileName: string; content: string }> {
  const res = await fetch(`${API_BASE}/docs/${encodeURIComponent(fileName)}`, {
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '读取文件失败')
  }
  return res.json()
}

/**
 * 调用 DS API 为文档添加原意列
 */
export async function translateDoc(fileName: string): Promise<TranslateResponse> {
  const res = await fetch(`${API_BASE}/docs/${encodeURIComponent(fileName)}/translate`, {
    method: 'POST',
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '翻译失败')
  }
  return res.json()
}

/**
 * 批量处理某一天的所有文档
 */
export interface RevertResponse {
  success: boolean
  originalFile: string
  newFile: string
}

/**
 * 还原 AI 文档（去掉原意和匹配度列）
 */
export async function revertDoc(fileName: string): Promise<RevertResponse> {
  const res = await fetch(`${API_BASE}/docs/${encodeURIComponent(fileName)}/revert`, {
    method: 'POST',
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '还原失败')
  }
  return res.json()
}

export async function batchTranslate(dayKey: string): Promise<BatchTranslateResponse> {
  const res = await fetch(`${API_BASE}/docs/batch-translate/${dayKey}`, {
    method: 'POST',
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '批量处理失败')
  }
  return res.json()
}

export interface WrongBookContent {
  content: string
  exists: boolean
  count: number
}

export interface WrongBookStatus {
  exists: boolean
  count: number
}

/**
 * 获取错题本内容
 */
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

export interface WrongBookUpdateResponse {
  success: boolean
  added: number
  total: number
  message: string
}

/**
 * 更新错题本（从所有 AI 文档中提取差距过大的单词）
 */
export async function updateWrongBook(): Promise<WrongBookUpdateResponse> {
  const res = await fetch(`${API_BASE}/wrong-book/update`, {
    method: 'POST',
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '更新错题本失败')
  }
  return res.json()
}

/**
 * 获取错题本状态
 */
export async function getWrongBookStatus(): Promise<WrongBookStatus> {
  const res = await fetch(`${API_BASE}/wrong-book/status`, {
    headers: createHeaders(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '获取错题本状态失败')
  }
  return res.json()
}

/**
 * 即时检查单个单词（调用 DS API）
 * POST /api/check-word
 */
export async function checkWord(word: string, guess: string): Promise<CheckWordResult> {
  const res = await fetch(`${API_BASE}/check-word`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ word, guess }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '检查单词失败')
  }
  return res.json()
}
