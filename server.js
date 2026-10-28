const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Handle Marksheet PDF Upload & Inference API
  if (req.method === 'POST' && reqUrl === '/api/parse-marksheet') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ error: 'No file data received' }));
      }

      // Check if it's a multipart upload or raw PDF
      let pdfBuffer = buffer;
      const pdfIndex = buffer.indexOf(Buffer.from('%PDF'));
      if (pdfIndex !== -1) {
        if (pdfIndex > 0) {
          const endMarker = buffer.indexOf(Buffer.from('\r\n--'), pdfIndex);
          if (endMarker !== -1) {
            pdfBuffer = buffer.slice(pdfIndex, endMarker);
          } else {
            pdfBuffer = buffer.slice(pdfIndex);
          }
        } else {
          pdfBuffer = buffer;
        }
      }

      const tempPath = path.join('/tmp', `marksheet_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
      fs.writeFile(tempPath, pdfBuffer, err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ error: 'Failed to write temp file: ' + err.message }));
        }

        const pythonPath = path.join(BASE_DIR, 'venv/bin/python');
        const scriptPath = path.join(BASE_DIR, 'parse_marksheet.py');
        const { execFile } = require('child_process');

        execFile(pythonPath, [scriptPath, tempPath], { maxBuffer: 10 * 1024 * 1024 }, (execErr, stdout, stderr) => {
          fs.unlink(tempPath, () => {});

          if (execErr) {
            console.error('Python parse error:', execErr.message, stderr);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Failed to parse marksheet PDF', details: stderr || execErr.message }));
          }

          try {
            const data = JSON.parse(stdout);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(data));
          } catch (jsonErr) {
            console.error('Invalid JSON from parser:', stdout);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Invalid JSON from parser', raw: stdout }));
          }
        });
      });
    });
    return;
  }

  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(BASE_DIR, reqUrl);

  // Security check: ensure path is within BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`SEC Curriculum Dashboard server running at http://localhost:${PORT}`);
});
