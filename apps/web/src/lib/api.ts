import { ApiClient, type StorageAdapter, type NavigationAdapter } from "../../../../shared/api"

const webStorageAdapter: StorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    localStorage.removeItem(key)
  }
}

const webNavigationAdapter: NavigationAdapter = {
  navigateToLogin(): void {
    window.location.href = "/login"
  }
}

export const apiClient = new ApiClient({
  storage: webStorageAdapter,
  navigation: webNavigationAdapter
})
// VITE_API_BASE_URL is statically replaced at build time by Vite.
// - Development: set to 'http://localhost:8000' in .env (or rely on vite proxy)
// - Production: leave unset → empty string → relative URLs → nginx proxies /api/* to backend
const _base = (import.meta as any)?.env?.VITE_API_BASE_URL ?? ''
;(apiClient as any).baseUrl = _base
