export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return

  const getNoteId = (): string | null => {
    // 1. From init script global
    if ((window as any).__STICKLET_NOTE_ID__) {
      return (window as any).__STICKLET_NOTE_ID__
    }
    // 2. From URL hash
    if (window.location.hash.startsWith('#/note/')) {
      const id = window.location.hash.replace('#/note/', '').split('?')[0]
      if (id) return id
    }
    // 3. From Tauri window label
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
