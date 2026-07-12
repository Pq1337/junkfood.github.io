const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const MAX_BODY = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const rateLimits = new Map();

loadEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.flac': 'audio/flac',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.lrc': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function allowRequest(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || now - current.start >= WINDOW_MS) {
    rateLimits.set(ip, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY) {
        reject(Object.assign(new Error('訊息過長'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(Object.assign(new Error('JSON 格式錯誤'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

async function chat(req, res) {
  if (!allowRequest(req)) return json(res, 429, { error: '請求太頻繁，請稍後再試' });
  if (!process.env.DEEPSEEK_API_KEY) return json(res, 503, { error: '伺服器尚未設定聊天 API Key' });

  let body;
  try { body = await readJson(req); }
  catch (error) { return json(res, error.status || 400, { error: error.message }); }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(res, 400, { error: '訊息不能為空' });
  if (message.length > 2000) return json(res, 413, { error: '訊息不得超過 2000 字' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一個網頁助手，說話幽默風趣，使用正體中文。' },
          { role: 'user', content: message }
        ],
        stream: true
      }),
      signal: controller.signal
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      console.error('DeepSeek error:', upstream.status, detail.slice(0, 300));
      return json(res, 502, { error: '上游聊天服務暫時無法使用' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff'
    });
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (error) {
    if (!res.headersSent) json(res, error.name === 'AbortError' ? 504 : 502, { error: '聊天服務連線失敗' });
    else res.end();
  } finally {
    clearTimeout(timeout);
  }
}

function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return json(res, 400, { error: '網址格式錯誤' }); }

  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(ROOT, `.${pathname}`);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return json(res, 403, { error: '禁止存取' });

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return json(res, 404, { error: '找不到檔案' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return void chat(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  json(res, 405, { error: '不支援的請求方法' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Website running at http://127.0.0.1:${PORT}`);
});
