/**
 * Fire-and-forget activity logging to POST /api/calendar/activity.
 * Called from frontend when users perform real learning actions.
 */
import { apiClient } from "./api"

export function logActivity(
  activityType: string,
  subType: string,
  resourceId?: string,
  details?: Record<string, unknown>,
) {
  apiClient.post("/api/calendar/activity", {
    activity_type: activityType,
    sub_type: subType,
    resource_id: resourceId ?? null,
    details: details ?? null,
  }).catch(() => {
    // fire-and-forget — never block the UI
  })
}
