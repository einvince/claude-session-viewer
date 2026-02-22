import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8000;

const CLAUDE_PROJECTS_DIR = path.join(process.env.HOME || '/root', '.claude', 'projects', '-root');

// CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());

// 读取所有会话文件
function getSessions() {
  try {
    const files = fs.readdirSync(CLAUDE_PROJECTS_DIR);
    const sessions = files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const filePath = path.join(CLAUDE_PROJECTS_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          id: f.replace('.jsonl', ''),
          name: f.replace('.jsonl', ''),
          modified: stat.mtime,
          size: stat.size
        };
      })
      .sort((a, b) => b.modified - a.modified);

    return sessions;
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

// 解析 JSONL 文件
function parseSession(sessionId) {
  try {
    const filePath = path.join(CLAUDE_PROJECTS_DIR, `${sessionId}.jsonl`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const messages = [];

    lines.forEach(line => {
      try {
        const obj = JSON.parse(line);

        // 处理 user 消息
        if (obj.type === 'user' && obj.message) {
          const content = obj.message.content;
          let text = '';

          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content.map(c => c.text || c.type || '').join('\n');
          }

          if (text) {
            messages.push({
              role: 'user',
              content: text.substring(0, 1000), // 限制长度
              timestamp: obj.timestamp
            });
          }
        }
        // 处理 assistant 消息
        else if (obj.type === 'assistant' && obj.message) {
          const content = obj.message.content;
          let text = '';

          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content.map(c => c.text || c.type || '').join('\n');
          }

          if (text) {
            messages.push({
              role: 'assistant',
              content: text.substring(0, 1000), // 限制长度
              timestamp: obj.timestamp
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    });

    return {
      id: sessionId,
      name: sessionId,
      messages
    };
  } catch (error) {
    console.error('Error parsing session:', error);
    return { id: sessionId, name: sessionId, messages: [] };
  }
}

// API 路由
app.get('/api/sessions', (req, res) => {
  const sessions = getSessions();
  res.json(sessions);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = parseSession(req.params.id);
  res.json(session);
});

// 读取会话别名
app.get('/api/session-names', (req, res) => {
  try {
    const namesPath = path.join(__dirname, 'session-names.json');
    const names = JSON.parse(fs.readFileSync(namesPath, 'utf-8'));
    res.json(names);
  } catch (e) {
    res.json({});
  }
});

// 保存会话别名
app.post('/api/session-names/:id', (req, res) => {
  try {
    const namesPath = path.join(__dirname, 'session-names.json');
    const names = JSON.parse(fs.readFileSync(namesPath, 'utf-8'));
    names[req.params.id] = req.body.name;
    fs.writeFileSync(namesPath, JSON.stringify(names, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 读取归档列表
app.get('/api/archived', (req, res) => {
  try {
    const archivedPath = path.join(__dirname, 'archived.json');
    const archived = JSON.parse(fs.readFileSync(archivedPath, 'utf-8'));
    res.json(archived);
  } catch (e) {
    res.json([]);
  }
});

// 归档/取消归档会话
app.post('/api/archived/:id', (req, res) => {
  try {
    const archivedPath = path.join(__dirname, 'archived.json');
    let archived = [];
    try {
      archived = JSON.parse(fs.readFileSync(archivedPath, 'utf-8'));
    } catch (e) {}

    const idx = archived.indexOf(req.params.id);
    if (req.body.archive) {
      if (idx === -1) archived.push(req.params.id);
    } else {
      if (idx !== -1) archived.splice(idx, 1);
    }

    fs.writeFileSync(archivedPath, JSON.stringify(archived, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 搜索会话内容
app.get('/api/search', (req, res) => {
  const keyword = (req.query.q || '').toLowerCase();
  if (!keyword) return res.json([]);

  try {
    const files = fs.readdirSync(CLAUDE_PROJECTS_DIR).filter(f => f.endsWith('.jsonl'));
    const results = [];

    for (const f of files) {
      const filePath = path.join(CLAUDE_PROJECTS_DIR, f);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.toLowerCase().includes(keyword)) continue;

      const sessionId = f.replace('.jsonl', '');
      const lines = content.trim().split('\n');
      let snippet = '';

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (!obj.message || !obj.message.content) continue;
          const msgContent = typeof obj.message.content === 'string'
            ? obj.message.content
            : Array.isArray(obj.message.content)
              ? obj.message.content.map(c => c.text || '').join(' ')
              : '';
          const idx = msgContent.toLowerCase().indexOf(keyword);
          if (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(msgContent.length, idx + keyword.length + 40);
            snippet = (start > 0 ? '...' : '') + msgContent.substring(start, end) + (end < msgContent.length ? '...' : '');
            break;
          }
        } catch (e) {}
      }

      results.push({ id: sessionId, snippet });
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
