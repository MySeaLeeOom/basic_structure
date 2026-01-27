import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import FastifyMiddie from '@fastify/middie'
import FastifyStatic from '@fastify/static'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'

async function createServer() {
  const app = Fastify()

  // Required for Vite middleware compatibility
  await app.register(FastifyMiddie)

  let vite
  if (!isProduction) {
    // DEV MODE: Use Vite as middleware
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    })
    app.use(vite.middlewares)
  } else {
    // PROD MODE: Serve static assets
    await app.register(FastifyStatic, {
      root: path.join(__dirname, 'dist/client'),
      wildcard: false
    })
  }

  app.get('*', async (req, reply) => {
    const url = req.raw.url

    try {
      let template, render
      
      if (!isProduction) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template)
        render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8')
        render = (await import('./dist/server/entry-server.js')).render
      }

      const { html } = await render(url)
      const responseHtml = template.replace('<!--ssr-outlet-->', html)
      
      reply.type('text/html').send(responseHtml)
    } catch (e) {
      if (!isProduction) vite.ssrFixStacktrace(e)
      console.error(e)
      reply.code(500).send(e.stack)
    }
  })

  return app
}

createServer().then(app => {
  app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
  })
})
