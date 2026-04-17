import { useState } from "react"
import { Card, Button } from "../../components"

function isVisionOS(): boolean {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  return /xros|visionOS/i.test(ua)
}

export function MemoryPalacePage() {
  const [linkStatus, setLinkStatus] = useState<"idle" | "trying" | "failed">("idle")
  const onVisionOS = isVisionOS()

  const handleEnterImmersive = () => {
    setLinkStatus("trying")

    // Try to open the custom URL scheme
    window.location.href = "memorypalace://open"

    // If the app is not installed the browser stays on this page.
    // After 2 s with no navigation away, assume the link failed.
    setTimeout(() => {
      setLinkStatus("failed")
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card title="Memory Palace" subtitle="AR & VR memory palace experiences">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>Overview:</strong> Put flashcards or 3D objects into a real AR scene or a virtual VR world — using space and interaction to make recall easier.</p>
            <p><strong>How it typically works:</strong> Sign in, choose AR or VR, place or pick anchors/objects, interact with the scene, and save your progress.</p>
            <p><strong>Notes:</strong> AR anchors persist across sessions. VR scenes are interactive and game-like to help practice recall. Vision Pro offers the best experience.</p>
          </div>

          <div className="mt-5 space-y-3">
            {onVisionOS ? (
              <>
                <Button
                  onClick={handleEnterImmersive}
                  disabled={linkStatus === "trying"}
                >
                  {linkStatus === "trying" ? "Opening…" : "Enter Immersive Experience"}
                </Button>

                {linkStatus === "idle" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Vision Pro detected — tap the button to launch the Memory Palace app.
                  </p>
                )}

                {linkStatus === "failed" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 space-y-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      Could not open the Memory Palace app
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Make sure the Memory Palace app is installed on your Apple Vision Pro and try again.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-amber-700 dark:text-amber-300 underline mt-1"
                      onClick={() => setLinkStatus("idle")}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Apple Vision Pro required
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Memory Palace is an immersive AR/VR experience that only runs on Apple Vision Pro. Open this page in Safari on your headset to launch the app.
                </p>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}

export default MemoryPalacePage
