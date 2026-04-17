import { SidebarLayout } from "./SidebarLayout"

/**
 * Layout wrapper for protected routes.
 * Classroom and Detective modes use separate routes (/classroom, /detective).
 */
export function ProtectedLayout() {
  return <SidebarLayout />
}
