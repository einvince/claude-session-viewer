# Claude Session Viewer

查看和管理 Claude Code 的会话历史记录。

Claude Code 会将所有会话保存为 JSONL 文件到 `~/.claude/projects/` 目录下，本工具提供 Web 界面来浏览这些会话。

## 功能

- 浏览所有 Claude Code 会话
- 搜索会话
- 重命名会话（自定义别名）
- 归档 / 取消归档会话
- 对话视图和时间线视图
- 导出为 Markdown

## 环境要求

- Node.js >= 18
- npm >= 8
- Claude Code 已安装并产生过会话记录（`~/.claude/projects/` 目录下有 `.jsonl` 文件）

## 快速部署

### 1. 克隆项目

```bash
git clone https://github.com/einvince/claude-session-viewer.git
cd claude-session-viewer
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建前端

```bash
npm run build
```

这会在 `dist/` 目录下生成前端静态文件。

### 4. 启动服务

```bash
# 直接启动（前台运行，默认端口 8000）
node server.js

# 或使用 PM2 后台运行（推荐生产环境使用）
npx pm2 start ecosystem.config.cjs
```

启动后访问 `http://<你的服务器IP>:8000` 即可使用。

### 5. PM2 常用命令

```bash
npx pm2 status              # 查看运行状态
npx pm2 logs claude-viewer  # 查看日志
npx pm2 restart claude-viewer  # 重启服务
npx pm2 stop claude-viewer  # 停止服务
```

## 配置

编辑 `server.js` 中的以下变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8000` | 服务监听端口 |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects/-root` | Claude Code 会话文件目录 |

如果你的 Claude Code 会话文件在其他路径，修改 `CLAUDE_PROJECTS_DIR` 即可。

## 开发模式

如果你想修改前端代码并实时预览：

```bash
# 启动 Vite 开发服务器（端口 5173）
npm run dev

# 同时启动后端 API 服务
node server.js
```

开发模式下前端运行在 `http://localhost:5173`，需要后端 API 同时运行在 8000 端口。

## 数据存储

| 文件 | 说明 |
|------|------|
| `session-names.json` | 会话自定义别名 |
| `archived.json` | 归档会话列表 |
| `~/.claude/projects/` | Claude Code 原始会话数据（只读） |

## 项目结构

```
claude-session-viewer/
├── server.js              # Express 后端服务（API + 静态文件）
├── src/
│   ├── main.js            # Vue 入口
│   └── App.vue            # 主组件（单文件应用）
├── index.html             # HTML 模板
├── vite.config.js         # Vite 构建配置
├── ecosystem.config.cjs   # PM2 部署配置
├── dist/                  # 构建产物（npm run build 生成）
├── session-names.json     # 会话别名数据
└── archived.json          # 归档列表数据
```
