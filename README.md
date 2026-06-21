# vue-en-h2a

英语单词辅助学习工具。输入英文单词并猜测其含义，由 DeepSeek AI 即时检查匹配度，支持记录保存、文档管理和错题本。

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Pinia + Vue Router
- **后端**: Express + OpenAI SDK (DeepSeek API)
- **存储**: Markdown 文件 (服务器端) + localStorage (客户端持久化)

---

## 本地开发

### 前置要求
- [Bun](https://bun.sh/) (推荐) 或 Node.js >= 20.19.0
- DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys))

### 安装依赖

```sh
bun install
```

### 配置 API Key

```sh
cp server/.env.example server/.env
# 编辑 server/.env，填入你的 DeepSeek API Key
```

### 启动开发服务

同时启动前端和后端：

```sh
# 终端 1: 启动 Vite 前端开发服务器
bun dev

# 终端 2: 启动 Express 后端服务
bun start
```

前端访问: http://localhost:5173
后端 API: http://localhost:3001

---

## 服务器部署

### 方案一：一键部署（推荐）

在服务器上运行以下命令：

```sh
# 1. 安装依赖
bun install

# 2. 配置 API Key
cp server/.env.example server/.env
# 编辑 server/.env，填入 DeepSeek API Key

# 3. 构建前端 + 启动生产服务（前端页面由 Express 托管）
VITE_API_BASE=http://你的服务器IP:3001/api npm run deploy
```

### 方案二：PM2 持久化运行（推荐生产环境）

```sh
# 安装 PM2
npm install -g pm2

# 构建前端并启动
VITE_API_BASE=http://你的服务器IP:3001/api npm run build-only
NODE_ENV=production pm2 start ./server/index.js --name vue-en-h2a

# 设置开机自启
pm2 save
pm2 startup
```

### 方案三：自定义端口

```sh
VITE_API_BASE=http://你的服务器IP:8080/api PORT=8080 node ./server/index.js
# 先构建前端：VITE_API_BASE=http://你的服务器IP:8080/api npm run build-only
```

### 服务器部署详细步骤

1. **克隆代码到服务器**
   ```sh
   git clone <你的仓库地址> /path/to/vue-en-h2a
   cd /path/to/vue-en-h2a
   ```

2. **安装依赖**
   ```sh
   bun install
   ```

3. **配置环境变量**
   ```sh
   cp server/.env.example server/.env
   # 编辑 server/.env，填入你的 DeepSeek API Key
   ```

4. **构建前端并启动**
   ```sh
   # 将 <服务器IP> 替换为你的服务器实际 IP 地址
   VITE_API_BASE=http://你的服务器IP:3001/api npm run build-only
   NODE_ENV=production node ./server/index.js
   ```

5. **放行防火墙端口**
   ```sh
   # Linux (firewalld)
   firewall-cmd --add-port=3001/tcp --permanent
   firewall-cmd --reload

   # Linux (iptables)
   iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
   ```

6. **用手机访问**
   ```
   http://你的服务器IP:3001
   ```

### 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `http://localhost:3001/api` | 前端构建时注入的后端 API 地址 |
| `PORT` | `3001` | Express 服务监听端口 |
| `NODE_ENV` | 开发环境无需设置 | 设为 `production` 启用静态文件服务 |
| `DS_API_KEY` | 从 `.env` 读取 | DeepSeek API Key |

---

## 脚本说明

| 命令 | 说明 |
|------|------|
| `bun dev` | 启动 Vite 前端开发服务器 |
| `bun run build` | 类型检查 + 构建前端 |
| `bun run build-only` | 仅构建前端（跳过类型检查） |
| `bun run start` | 启动 Express 后端开发服务 |
| `bun run deploy` | 构建前端 + 启动生产服务 (Linux/Mac) |
| `bun run deploy:win` | 构建前端 + 启动生产服务 (Windows) |
| `bun run format` | 格式化代码 |
| `bun run lint` | 代码检查 |

---

## 项目结构

```
vue-en-h2a/
├── src/                    # 前端源码
│   ├── App.vue             # 根组件（全局样式 + 服务器状态栏）
│   ├── main.ts             # 入口
│   ├── api/index.ts        # API 调用（后端通信）
│   ├── router/index.ts     # 路由配置
│   ├── stores/             # Pinia 状态管理
│   │   ├── counter.ts
│   │   └── word.ts         # 单词录入流程状态
│   └── views/
│       ├── WordInput.vue   # 单词录入主页面
│       └── DocManager.vue  # 文档管理页面
├── server/
│   ├── index.js            # Express 后端服务
│   ├── .env                # API Key 配置（不提交到 Git）
│   └── .env.example        # 环境变量示例
├── docs/                   # MD 单词记录文档目录
├── public/
├── index.html
├── vite.config.ts
└── package.json
```

---

## 功能说明

1. **单词录入流程**: 输入英文 → 猜测含义 → AI 即时检查匹配度 → 记录结果
2. **文档管理**: 按天分组查看单词记录，支持 AI 批量添加释义
3. **错题本**: 自动收集匹配度"差距过大"的单词，生成复习列表
