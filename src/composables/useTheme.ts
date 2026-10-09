import { ref, watch, onMounted } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'sticklet_theme_mode'
const currentTheme = ref<ThemeMode>('system')
const isDark = ref(false)

function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return

  let dark = false
  if (theme === 'dark') {
    dark = true
  } else if (theme === 'light') {
    dark = false
  } else {
    // system
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  isDark.value = dark
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    currentTheme.value = mode
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode)
      } catch (_) {}
    }
    applyTheme(mode)
  }

  function toggleTheme() {
    if (currentTheme.value === 'dark') {
      setTheme('light')
    } else if (currentTheme.value === 'light') {
      setTheme('dark')
    } else {
      // If system, switch to opposite of current actual state
      setTheme(isDark.value ? 'light' : 'dark')
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
      if (stored && ['light', 'dark', 'system'].includes(stored)) {
        currentTheme.value = stored
      }
    } catch (_) {}

    applyTheme(currentTheme.value)

    // Listen to system changes if in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (currentTheme.value === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handler)
  })

  return {
    theme: currentTheme,
    isDark,
    setTheme,
    toggleTheme,
  }
}
