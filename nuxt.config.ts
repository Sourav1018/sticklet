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
  hooks: {
    'vite:extendConfig'(config) {
      const input = config.build?.rollupOptions?.input
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        if (!('server' in input) && 'entry' in input) {
          ;(input as Record<string, any>).server = (input as Record<string, any>).entry
        }
      }
    },
  },
})
