// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  srcDir: 'src',
  ssr: false, // Desktop apps run purely client-side
  devtools: { enabled: false },
  css: ['~/assets/css/tailwind.css'],
  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  devServer: {
    port: 1420,
    host: '0.0.0.0',
  },
  router: {
    options: {
      hashMode: true, // Crucial for desktop/Tauri file navigation
    },
  },
  alias: {
    'lucide-vue-next': '@lucide/vue',
  },
  vite: {
    clearScreen: false,
    server: {
      strictPort: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 1420,
      },
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    resolve: {
      dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom'],
    },
  },
  nitro: {
    hooks: {
      'prerender:generate'(route) {
        if (route.fileName && route.fileName.endsWith('.html') && route.contents) {
          const fs = require('node:fs')
          const path = require('node:path')
          const nuxtDir = path.resolve('.output/public/_nuxt')
          if (fs.existsSync(nuxtDir)) {
            const cssFiles = fs.readdirSync(nuxtDir).filter((f: string) => f.endsWith('.css') && !f.startsWith('error-'))
            const links = cssFiles.map((f: string) => `<link rel="stylesheet" href="/_nuxt/${f}">`).join('\n')
            route.contents = route.contents.replace('</head>', `${links}\n</head>`)
          }
        }
      },
    },
  },
  hooks: {
    'vite:extendConfig'(config) {
      const input = config.build?.rollupOptions?.input
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        if (!('server' in input) && 'entry' in input) {
          ;(input as Record<string, any>).server = (input as Record<string, any>).entry
        }
      }
    },
    close() {
      // Post-process all output HTML files directly after generate
      const fs = require('node:fs')
      const path = require('node:path')
      const outDir = path.resolve('.output/public')
      const nuxtDir = path.join(outDir, '_nuxt')
      if (fs.existsSync(nuxtDir)) {
        const cssFiles = fs.readdirSync(nuxtDir).filter((f: string) => f.endsWith('.css') && !f.startsWith('error-'))
        const links = cssFiles.map((f: string) => `<link rel="stylesheet" href="/_nuxt/${f}">`).join('\n')
        for (const htmlFile of ['index.html', '200.html', '404.html']) {
          const p = path.join(outDir, htmlFile)
          if (fs.existsSync(p)) {
            let content = fs.readFileSync(p, 'utf-8')
            if (!content.includes('rel="stylesheet"')) {
              content = content.replace('</head>', `${links}\n</head>`)
              fs.writeFileSync(p, content, 'utf-8')
            }
          }
        }
      }
    },
  },
})
