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
      res.setHeader('Accept-Ranges', 'bytes')
      // One byte range ("bytes=a-b", "bytes=a-", "bytes=-n"), as Potree 2
      // clouds read octree.bin node by node (like worker/static_files.py).
      let start = 0
      let end = stats.size - 1
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
      if (range && (range[1] || range[2])) {
        if (range[1]) {
          start = Number(range[1])
          if (range[2]) end = Math.min(Number(range[2]), end)
        } else {
          start = Math.max(0, stats.size - Number(range[2]))
        }
        if (start > end || start >= stats.size) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${stats.size}`)
          return res.end()
        }
        res.statusCode = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`)
      }
      res.setHeader('Content-Length', end - start + 1)
      const stream = fs.createReadStream(safePath, { start, end })
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
