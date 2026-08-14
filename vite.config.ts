import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { parseProxyAccessTokens, proxyAuthorization } from './src/proxyAccess.ts'

function proxyTargets(raw: string | undefined, defaultTarget: string) {
  const targets: Record<string, string> = { '/treetop-api': defaultTarget }
  if (!raw?.trim()) return targets
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const [prefix, target] of Object.entries(parsed)) {
      if (prefix.startsWith('/') && typeof target === 'string' && target.trim()) {
        targets[prefix.replace(/\/+$/, '')] = target.trim()
      }
    }
  } catch {
    console.warn('Ignoring invalid VITE_TREETOP_PROXY_TARGETS JSON.')
  }
  return targets
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const env = (name: string) => process.env[name] ?? fileEnv[name]
  const targets = proxyTargets(
    env('VITE_TREETOP_PROXY_TARGETS'),
    env('VITE_TREETOP_PROXY_TARGET') ?? 'http://127.0.0.1:9999',
  )
  const access = parseProxyAccessTokens(
    env('TREETOP_PROXY_ACCESS_TOKEN'),
    env('TREETOP_PROXY_ACCESS_TOKENS'),
  )

  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(Object.entries(targets).map(([prefix, target]) => [
        prefix,
        {
          target,
          changeOrigin: true,
          rewrite: (path: string) => path.startsWith(prefix) ? path.slice(prefix.length) || '/' : path,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest, request) => {
              const authorization = proxyAuthorization(prefix, request.url ?? '/', access)
              if (authorization) proxyRequest.setHeader('Authorization', authorization)
            })
          },
        },
      ])),
    },
  }
})
