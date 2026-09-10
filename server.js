const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const TIMEOUT = 24 * 60 * 60 * 1000;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: '没有选择文件' });
  }
  const result = req.files.map(f => ({
    originalname: f.originalname,
    filename: f.filename,
    size: f.size,
  }));
  res.json({ success: true, files: result });
});

app.get('/files', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).map(name => {
    const stat = fs.statSync(path.join(UPLOAD_DIR, name));
    return {
      name,
      size: stat.size,
      time: stat.mtime.getTime(),
    };
  });
  res.json({ success: true, files });
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }
  res.download(filePath);
});

app.delete('/files/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: '文件超过10GB限制' });
  }
  if (err.message === 'Request aborted' || err.code === 'ECONNABORTED') {
    console.log('客户端中断了上传');
    return;
  }
  console.error('服务器错误:', err.message);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

const server = app.listen(PORT, () => {
  console.log(`文件上传服务已启动: http://localhost:${PORT}`);
});

server.timeout = TIMEOUT;
server.keepAliveTimeout = TIMEOUT;
server.headersTimeout = TIMEOUT;

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.message === 'Request aborted') {
    console.log('连接被客户端重置');
  } else {
    console.error('未捕获异常:', err);
  }
});
