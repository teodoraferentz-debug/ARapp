/* Server static minimal. HTTP implicit; `--https` generează un certificat self-signed (pentru camera pe telefon). */
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const root = __dirname;
const useHttps = process.argv.includes('--https');
const port = Number(process.env.PORT) || (useHttps ? 8443 : 8080);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.dat': 'application/octet-stream', '.hiro': 'text/plain', '.svg': 'image/svg+xml' };

function handler(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) || /(^|[\\/])\.|node_modules/.test(path.relative(root, file))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

let server;
if (useHttps) {
  const dir = path.join(root, '.cert'); fs.mkdirSync(dir, { recursive: true });
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  if (!fs.existsSync(cert)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=ar-cosmos'], { stdio: 'ignore' });
  }
  server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, handler);
} else server = http.createServer(handler);

server.listen(port, '0.0.0.0', () => {
  const proto = useHttps ? 'https' : 'http';
  console.log('AR Cosmos pornit:');
  console.log('  PC:      ' + proto + '://localhost:' + port);
  Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal)
    .forEach((i) => console.log('  Telefon: ' + proto + '://' + i.address + ':' + port + (useHttps ? '  (acceptă avertismentul de certificat)' : '  (camera cere HTTPS — folosește npm run https)')));
});
