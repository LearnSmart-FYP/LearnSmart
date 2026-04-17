/**
 * Lightweight event bus for error-book mutations.
 * Any component that writes to /api/error-book (schedule, mark mastered, etc.)
 * should dispatch `errorBookChanged` so other mounted pages can re-fetch.
 */

export const ERROR_BOOK_CHANGED = "errorBookChanged"

export function dispatchErrorBookChanged() {
  window.dispatchEvent(new CustomEvent(ERROR_BOOK_CHANGED))
}

export function onErrorBookChanged(handler: () => void): () => void {
  window.addEventListener(ERROR_BOOK_CHANGED, handler)
  return () => window.removeEventListener(ERROR_BOOK_CHANGED, handler)
}
