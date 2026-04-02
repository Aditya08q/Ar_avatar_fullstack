#!/usr/bin/env node
/**
 * serve.js 
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const PORT = 3000;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.vrm':  'model/gltf-binary',
  '.glb':  'model/gltf-binary',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// Auto-generate self-signed cert if not present
function ensureCert() {
  const keyPath  = path.join(__dirname, 'cert', 'key.pem');
  const certPath = path.join(__dirname, 'cert', 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('Generating self-signed SSL cert…');
    fs.mkdirSync(path.join(__dirname, 'cert'), { recursive: true });
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`,
        { stdio: 'pipe' }
      );
      console.log('Cert generated');
    } catch (e) {
      console.error(' Could not generate cert. Install openssl and try again.');
      process.exit(1);
    }
  }

  return {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

const sslOptions = ensureCert();

const server = https.createServer(sslOptions, (req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  // Remove query strings
  filePath = filePath.split('?')[0];

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found: ' + req.url);
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': mime,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log('\nARIA Dev Server running!\n');
  console.log(`   Local:   https://localhost:${PORT}`);
  console.log(`   Network: https://${localIP}:${PORT}  ← use this on mobile\n`);
  console.log('   Accept the self-signed cert warning in browser\n');
});
