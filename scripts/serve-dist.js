import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = process.env.DIST_DIR || 'dist'
const root = path.resolve(__dirname, '..', distDir)
const host = process.env.HOST || '127.0.0.1'
const port = process.env.PORT || 8080

const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
}

const server = http.createServer((req, res) => {
  try {
    let reqUrl = decodeURI(new URL(req.url, `http://localhost`).pathname)
    if (reqUrl === '/') reqUrl = '/index.html'
    const safePath = path.normalize(path.join(root, reqUrl))
    if (!safePath.startsWith(root)) {
      res.statusCode = 403
      return res.end('Forbidden')
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404
        return res.end('Not found')
      }

      const ext = path.extname(safePath).toLowerCase()
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
      res.setHeader('Content-Length', stats.size)
      const stream = fs.createReadStream(safePath)
      stream.pipe(res)
      stream.on('error', () => {
        res.statusCode = 500
        res.end()
      })
    })
  } catch (e) {
    res.statusCode = 500
    res.end('Server error')
  }
})

server.listen(port, host, () => console.log(`Serving ${root} at http://${host}:${port}/`))
