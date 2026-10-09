import { detectFloatingNoteId } from '@/composables/useFloatingWindow'

export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return

  const noteId = detectFloatingNoteId()
  if (noteId) {
    try {
      const router = useRouter()
      if (router && router.currentRoute.value.path !== `/note/${noteId}`) {
        await router.replace(`/note/${noteId}`)
      }
    } catch (_) {
      // In case router navigation fails or is aborted, app.vue handles rendering FloatingNoteWindow directly
    }
  }
})
