import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dayjs from 'dayjs'
import OpenAI from 'openai'
import http from 'node:http'

// 判断是否为生产环境
const IS_PROD = process.env.NODE_ENV === 'production'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载 .env 文件
try {
  const envPath = path.resolve(__dirname, '.env')
  const envContent = await fs.readFile(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim()
        const value = trimmed.substring(eqIndex + 1).trim()
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  })
} catch {
  // .env 文件不存在，使用环境变量
}

const app = express()
// 端口：优先使用环境变量（部署时可通过 PORT=8080 node server/index.js 指定）
const PORT = process.env.PORT || 3001

// MD 文档存放目录
const DOCS_DIR = path.resolve(__dirname, '../docs')
// 错题本文件
const WRONG_BOOK_FILE = path.join(DOCS_DIR, '错题本.md')

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// 生产环境下 serve 前端静态文件
if (IS_PROD) {
  const distPath = path.resolve(__dirname, '../dist')
  app.use(express.static(distPath))
  // SPA 支持：所有非 API 路由返回 index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ============ 工具函数 ============

/** 解析 MD 表格行，返回单元格数组 */
function parseTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null
  return trimmed.split('|').map((c) => c.trim()).filter(Boolean)
}

/** 从 MD 内容中解析表格数据 */
function parseTable(content) {
  const lines = content.split('\n')
  const tableStart = lines.findIndex((l) => l.startsWith('| 序号 |'))
  if (tableStart === -1) return null

  const header = parseTableRow(lines[tableStart])
  const rows = []
  for (let i = tableStart + 2; i < lines.length; i++) {
    const cells = parseTableRow(lines[i])
    if (!cells) break
    rows.push(cells)
  }
  return { header, rows, tableStart, lines }
}

/** 调用 DS API 获取单词的原意和匹配度 */
async function callDsForMeanings(words, guesses) {
  const apiKey = process.env.DS_API_KEY
  if (!apiKey) throw new Error('未配置 DS_API_KEY')

  const openai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })

  const wordList = words.map((w, i) => `${i + 1}. ${w}`).join('\n')
  const guessList = guesses.map((g, i) => `${i + 1}. ${g}`).join('\n')

  const prompt = `你是一个英语教学助手。请为以下每个英文单词提供其真实的中文释义及词性信息。

请严格按照以下 JSON 数组格式返回，每个元素需包含四个字段：
- "word": 英文单词（与列表一致）
- "pos": 词性标注（使用标准缩写：n. 名词、v. 动词、adj. 形容词、adv. 副词、prep. 介词、pron. 代词、conj. 连词、int. 感叹词、art. 冠词、num. 数词）
- "meaning": 该英文单词在词典中的标准中文释义
- "match": 判断用户的猜测与真实原意的吻合程度，仅返回"基本吻合"或"差距过大"
  - "基本吻合"：猜测与真实原意核心含义一致或非常接近
  - "差距过大"：猜测与真实原意完全不同或偏差很大

要求：
1. "meaning" 必须是词典中的标准中文翻译，与用户的猜测完全无关
2. "pos" 需使用标准缩写标注词性
3. 请务必为每个单词返回真实的词典释义，不要使用用户的猜测内容

英文单词列表：
${wordList}

用户对每个单词的猜测（与单词一一对应）：
${guessList}

请只返回 JSON 数组，不要包含其他内容。`

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const resultText = completion.choices[0]?.message?.content || ''
  const jsonMatch = resultText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('API 返回数据解析失败')
  return JSON.parse(jsonMatch[0])
}

/** 调用 DS API 检查单个单词 */
async function callDsForSingleWord(word, guess) {
  const apiKey = process.env.DS_API_KEY
  if (!apiKey) throw new Error('未配置 DS_API_KEY')

  const openai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })

  const prompt = `你是一个英语教学助手。请为英文单词提供其真实的中文释义及词性信息。

请严格按照 JSON 格式返回，包含以下字段：
- "word": 英文单词
- "pos": 词性标注（使用标准缩写：n. 名词、v. 动词、adj. 形容词、adv. 副词等）
- "meaning": 该单词在词典中的标准中文释义
- "match": 判断用户的猜测与真实原意的吻合程度，仅返回"基本吻合"或"差距过大"
  - "基本吻合"：猜测与真实原意核心含义一致或非常接近
  - "差距过大"：猜测与真实原意完全不同或偏差很大

英文单词：${word}
用户猜测：${guess}

请只返回 JSON 对象，不要包含其他内容。`

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const resultText = completion.choices[0]?.message?.content || ''
  const jsonMatch = resultText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('API 返回数据解析失败')
  return JSON.parse(jsonMatch[0])
}

// ============ API 路由 ============

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasApiKey: !!process.env.DS_API_KEY,
  })
})

/**
 * 即时检查单个单词
 * POST /api/check-word
 * Body: { word: string, guess: string }
 * Response: { word, pos, meaning, match }
 */
app.post('/api/check-word', async (req, res) => {
  try {
    const { word, guess } = req.body
    if (!word || !guess) {
      return res.status(400).json({ error: '请提供 word 和 guess 参数' })
    }

    const result = await callDsForSingleWord(word, guess)
    res.json(result)
  } catch (error) {
    console.error('检查单词失败:', error)
    res.status(500).json({ error: '检查单词失败: ' + error.message })
  }
})

/**
 * 保存单词记录到 MD 文件
 * POST /api/save-words
 * Body: { words: Array<{ word: string, guess: string }>, count: number }
 */
app.post('/api/save-words', async (req, res) => {
  try {
    const { words, count } = req.body
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: '无效的单词数据' })
    }

    const now = dayjs()
    const fileName = `${now.format('MM-DD-HHmm')}.md`
    const filePath = path.join(DOCS_DIR, fileName)

    let mdContent = `# 单词记录\n\n`
    mdContent += `**记录时间**: ${now.format('YYYY-MM-DD HH:mm:ss')}\n\n`
    mdContent += `**单词数量**: ${count}\n\n`
    mdContent += `| 序号 | 英文单词 | 我的猜测 |\n`
    mdContent += `| --- | --- | --- |\n`

    words.forEach((item, index) => {
      mdContent += `| ${index + 1} | ${item.word} | ${item.guess} |\n`
    })

    await fs.writeFile(filePath, mdContent, 'utf-8')

    res.json({ success: true, fileName, filePath })
  } catch (error) {
    console.error('保存文件失败:', error)
    res.status(500).json({ error: '保存文件失败: ' + error.message })
  }
})

/**
 * 获取所有 MD 文档列表，按天分组
 * GET /api/docs
 */
app.get('/api/docs', async (req, res) => {
  try {
    const files = await fs.readdir(DOCS_DIR)
    const mdFiles = files.filter((f) => f.endsWith('.md') && f !== '错题本.md')

    const docs = await Promise.all(
      mdFiles.map(async (fileName) => {
        const filePath = path.join(DOCS_DIR, fileName)
        const stat = await fs.stat(filePath)
        const nameWithoutExt = fileName.replace('.md', '')
        const dayKey = nameWithoutExt.substring(0, 5)
        return {
          fileName,
          filePath,
          dayKey,
          createdAt: stat.birthtime || stat.mtime,
          hasAi: fileName.toLowerCase().includes('ai'),
        }
      })
    )

    const grouped = {}
    docs.forEach((doc) => {
      if (!grouped[doc.dayKey]) {
        grouped[doc.dayKey] = []
      }
      grouped[doc.dayKey].push(doc)
    })

    const sortedGroups = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => b.fileName.localeCompare(a.fileName)),
      }))

    res.json({ groups: sortedGroups })
  } catch (error) {
    console.error('获取文档列表失败:', error)
    res.status(500).json({ error: '获取文档列表失败: ' + error.message })
  }
})

/**
 * 读取单个 MD 文件内容
 * GET /api/docs/:fileName
 */
app.get('/api/docs/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params
    const safeName = path.basename(fileName)
    const filePath = path.join(DOCS_DIR, safeName)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ fileName: safeName, content })
  } catch (error) {
    res.status(500).json({ error: '读取文件失败: ' + error.message })
  }
})

/**
 * 调用 DS API 为文档添加原意列 + 匹配度列
 * POST /api/docs/:fileName/translate
 */
app.post('/api/docs/:fileName/translate', async (req, res) => {
  try {
    const { fileName } = req.params
    const safeName = path.basename(fileName)
    const filePath = path.join(DOCS_DIR, safeName)

    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = parseTable(content)
    if (!parsed) {
      return res.status(400).json({ error: '未找到表格数据' })
    }

    // 提取单词和猜测
    const words = parsed.rows.map((r) => r[1])  // 英文单词在第2列
    const guesses = parsed.rows.map((r) => r[2]) // 猜测在第3列

    if (words.length === 0) {
      return res.status(400).json({ error: '未找到英文单词' })
    }

    // 调用 DS API
    const results = await callDsForMeanings(words, guesses)

    const meaningMap = new Map(results.map((r) => [r.word, r]))
    const newLines = [...parsed.lines]
    // 修改表头：增加"原意"、"匹配度"和"词性"列
    newLines[parsed.tableStart] = '| 序号 | 英文单词 | 我的猜测 | 原意 | 匹配度 | 词性 |'
    newLines[parsed.tableStart + 1] = '| --- | --- | --- | --- | --- | --- |'

    for (let i = parsed.tableStart + 2; i < parsed.lines.length; i++) {
      const line = parsed.lines[i].trim()
      if (!line.startsWith('|')) break
      const cells = line.split('|').map((c) => c.trim())
      if (cells.length >= 3) {
        const word = cells[2]
        const info = meaningMap.get(word)
        const meaning = info?.meaning || ''
        const match = info?.match || ''
        const pos = info?.pos || ''
        newLines[i] = line.trimEnd() + ` ${meaning} | ${match} | ${pos} |`
      }
    }

    const newContent = newLines.join('\n')
    const newFileName = safeName.replace('.md', '-ai.md')
    const newFilePath = path.join(DOCS_DIR, newFileName)
    await fs.writeFile(newFilePath, newContent, 'utf-8')
    await fs.unlink(filePath)

    res.json({
      success: true,
      originalFile: safeName,
      newFile: newFileName,
      wordsCount: words.length,
    })
  } catch (error) {
    console.error('翻译失败:', error)
    res.status(500).json({ error: '翻译失败: ' + error.message })
  }
})

/**
 * 还原 AI 文档（去掉原意和匹配度列，恢复为原始格式）
 * POST /api/docs/:fileName/revert
 */
app.post('/api/docs/:fileName/revert', async (req, res) => {
  try {
    const { fileName } = req.params
    const safeName = path.basename(fileName)
    const filePath = path.join(DOCS_DIR, safeName)

    // 检查文件名是否包含 ai
    if (!safeName.toLowerCase().includes('ai')) {
      return res.status(400).json({ error: '该文档不是 AI 处理过的文档' })
    }

    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = parseTable(content)
    if (!parsed) {
      return res.status(400).json({ error: '未找到表格数据' })
    }

    const newLines = [...parsed.lines]
    // 还原表头：只保留序号、英文单词、我的猜测
    newLines[parsed.tableStart] = '| 序号 | 英文单词 | 我的猜测 |'
    newLines[parsed.tableStart + 1] = '| --- | --- | --- |'

    for (let i = parsed.tableStart + 2; i < parsed.lines.length; i++) {
      const line = parsed.lines[i].trim()
      if (!line.startsWith('|')) break
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      if (cells.length >= 3) {
        // 只保留前三列：序号、单词、猜测
        newLines[i] = `| ${cells[0]} | ${cells[1]} | ${cells[2]} |`
      }
    }

    const newContent = newLines.join('\n')
    // 新文件名去掉 -ai 后缀
    const newFileName = safeName.replace(/-ai\.md$/i, '.md')
    const newFilePath = path.join(DOCS_DIR, newFileName)
    await fs.writeFile(newFilePath, newContent, 'utf-8')
    await fs.unlink(filePath)

    res.json({
      success: true,
      originalFile: safeName,
      newFile: newFileName,
    })
  } catch (error) {
    console.error('还原失败:', error)
    res.status(500).json({ error: '还原失败: ' + error.message })
  }
})

/**
 * 批量处理某一天的所有文档
 * POST /api/docs/batch-translate/:dayKey
 */
app.post('/api/docs/batch-translate/:dayKey', async (req, res) => {
  try {
    const { dayKey } = req.params
    const files = await fs.readdir(DOCS_DIR)
    const dayFiles = files.filter((f) => {
      return f.endsWith('.md') && f.startsWith(dayKey) && !f.toLowerCase().includes('ai') && f !== '错题本.md'
    })

    if (dayFiles.length === 0) {
      return res.json({ success: true, processed: 0, message: '该日期没有需要处理的文档' })
    }

    const results = []

    for (const file of dayFiles) {
      try {
        const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8')
        const parsed = parseTable(content)
        if (!parsed) {
          results.push({ file, success: false, error: '未找到表格' })
          continue
        }

        const words = parsed.rows.map((r) => r[1])
        const guesses = parsed.rows.map((r) => r[2])

        if (words.length === 0) {
          results.push({ file, success: false, error: '未找到单词' })
          continue
        }

        const dsResults = await callDsForMeanings(words, guesses)
        const meaningMap = new Map(dsResults.map((r) => [r.word, r]))
        const newLines = [...parsed.lines]
        newLines[parsed.tableStart] = '| 序号 | 英文单词 | 我的猜测 | 原意 | 匹配度 | 词性 |'
        newLines[parsed.tableStart + 1] = '| --- | --- | --- | --- | --- | --- |'

        for (let i = parsed.tableStart + 2; i < parsed.lines.length; i++) {
          const line = parsed.lines[i].trim()
          if (!line.startsWith('|')) break
          const cells = line.split('|').map((c) => c.trim())
          if (cells.length >= 3) {
            const word = cells[2]
            const info = meaningMap.get(word)
            const meaning = info?.meaning || ''
            const match = info?.match || ''
            const pos = info?.pos || ''
            newLines[i] = line.trimEnd() + ` ${meaning} | ${match} | ${pos} |`
          }
        }

        const newFileName = file.replace('.md', '-ai.md')
        await fs.writeFile(path.join(DOCS_DIR, newFileName), newLines.join('\n'), 'utf-8')
        await fs.unlink(path.join(DOCS_DIR, file))

        results.push({ file, success: true })
      } catch (err) {
        results.push({ file, success: false, error: err.message })
      }
    }

    res.json({ success: true, processed: results.length, results })
  } catch (error) {
    res.status(500).json({ error: '批量处理失败: ' + error.message })
  }
})

/**
 * 从所有 AI 文档中提取"差距过大"的单词，生成/更新错题本
 * POST /api/wrong-book/update
 */
app.post('/api/wrong-book/update', async (req, res) => {
  try {
    const files = await fs.readdir(DOCS_DIR)
    const aiFiles = files.filter((f) => f.endsWith('.md') && f.toLowerCase().includes('ai') && f !== '错题本.md')

    // 从所有 AI 文档中收集错题
    const newWrongItems = [] // { word, guess, meaning, pos, source }

    for (const file of aiFiles) {
      const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8')
      const parsed = parseTable(content)
      if (!parsed) continue

      // 检查是否有"匹配度"列（表头包含"匹配度"）
      const hasMatchCol = parsed.header && parsed.header.includes('匹配度')
      if (!hasMatchCol) continue

      for (const row of parsed.rows) {
        // 行格式: [序号, 单词, 猜测, 原意, 匹配度, 词性]
        if (row.length >= 5 && row[4] === '差距过大') {
          newWrongItems.push({
            word: row[1],
            guess: row[2],
            meaning: row[3],
            pos: row[5] || '',
            source: file,
          })
        }
      }
    }

    if (newWrongItems.length === 0) {
      return res.json({ success: true, added: 0, message: '没有找到差距过大的单词' })
    }

    // ---- Diff 更新逻辑 ----
    // 1. 读取现有错题本
    let existingItems = []
    let existingContent = ''
    try {
      existingContent = await fs.readFile(WRONG_BOOK_FILE, 'utf-8')
      const existingParsed = parseTable(existingContent)
      if (existingParsed) {
      for (const row of existingParsed.rows) {
        if (row.length >= 4) {
          existingItems.push({
            word: row[1],
            guess: row[2],
            meaning: row[3],
            pos: row.length >= 6 ? row[4] : '',
            source: row.length >= 6 ? row[5] : (row[4] || ''),
          })
        }
      }
      }
    } catch {
      // 错题本不存在，从头创建
    }

    // 2. 用 Map 做 diff：以 word + source 为唯一键去重
    const existingMap = new Map()
    existingItems.forEach((item) => {
      existingMap.set(`${item.word}::${item.source}`, item)
    })

    // 3. 合并新数据
    let addedCount = 0
    for (const item of newWrongItems) {
      const key = `${item.word}::${item.source}`
      if (!existingMap.has(key)) {
        existingMap.set(key, item)
        addedCount++
      }
    }

    // 4. 写回文件
    const allItems = Array.from(existingMap.values())
    // 按来源文件分组排序
    allItems.sort((a, b) => a.source.localeCompare(b.source))

    let mdContent = `# 错题本\n\n`
    mdContent += `**最后更新**: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`
    mdContent += `**错题总数**: ${allItems.length}\n\n`
    mdContent += `| 序号 | 英文单词 | 我的猜测 | 原意 | 词性 | 来源文件 |\n`
    mdContent += `| --- | --- | --- | --- | --- | --- |\n`

    allItems.forEach((item, index) => {
      mdContent += `| ${index + 1} | ${item.word} | ${item.guess} | ${item.meaning} | ${item.pos || ''} | ${item.source} |\n`
    })

    await fs.writeFile(WRONG_BOOK_FILE, mdContent, 'utf-8')

    res.json({
      success: true,
      added: addedCount,
      total: allItems.length,
      message: addedCount > 0
        ? `新增 ${addedCount} 道错题，共 ${allItems.length} 道`
        : '没有新增错题，错题本已是最新',
    })
  } catch (error) {
    console.error('更新错题本失败:', error)
    res.status(500).json({ error: '更新错题本失败: ' + error.message })
  }
})

/**
 * 获取错题本状态
 * GET /api/wrong-book/status
 */
app.get('/api/wrong-book/status', async (req, res) => {
  try {
    let exists = false
    let count = 0
    try {
      await fs.access(WRONG_BOOK_FILE)
      exists = true
      const content = await fs.readFile(WRONG_BOOK_FILE, 'utf-8')
      const parsed = parseTable(content)
      if (parsed) {
        count = parsed.rows.length
      }
    } catch {
      // 文件不存在
    }

    res.json({ exists, count })
  } catch (error) {
    res.status(500).json({ error: '获取错题本状态失败: ' + error.message })
  }
})

// ============ 启动服务 ============

async function ensureDocsDir() {
  try {
    await fs.mkdir(DOCS_DIR, { recursive: true })
  } catch {
    // 目录已存在
  }
}

const server = http.createServer(app)

server.listen(PORT, async () => {
  await ensureDocsDir()
  console.log(`后端服务已启动: http://localhost:${PORT}`)
  console.log(`文档目录: ${DOCS_DIR}`)
})

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...')
  server.close(() => process.exit(0))
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
