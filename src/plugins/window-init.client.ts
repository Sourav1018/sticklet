import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return

  const getNoteId = (): string | null => {
    // 1. From URL hash
    if (window.location.hash.startsWith('#/note/')) {
      const id = window.location.hash.replace('#/note/', '').split('?')[0]
      if (id) return id
    }

    // 2. From URL search params (?note=id)
    try {
      const params = new URLSearchParams(window.location.search)
      const noteParam = params.get('note')
      if (noteParam) return noteParam
    } catch (_) {}

    // 3. From Tauri window label
    try {
      const current = getCurrentWebviewWindow()
      if (current?.label?.startsWith('note-')) {
        return current.label.slice(5)
      }
    } catch (_) {}

    if ('__TAURI_INTERNALS__' in window) {
      try {
        const meta = (window as any).__TAURI_INTERNALS__?.metadata?.currentWebview
        if (meta?.label?.startsWith('note-')) {
          return meta.label.slice(5)
        }
      } catch (_) {}
    }

    return null
  }

  const noteId = getNoteId()
  const router = useRouter()

  if (noteId) {
    if (router.currentRoute.value.path !== `/note/${noteId}`) {
      await router.replace(`/note/${noteId}`)
    }
  }
})

