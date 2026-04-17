import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import AttachmentPreview from "../flashcards/AttachmentPreview"
import { apiClient } from "../../lib/api"

export default function LinkPreviewHandler() {
  const [active, setActive] = useState<{ url: string; type?: string } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function findAnchor(el: EventTarget | null): HTMLAnchorElement | null {
      let node = el as Node | null
      while (node) {
        if (node instanceof HTMLAnchorElement) return node
        node = node.parentNode
      }
      return null
    }

    function onClick(e: MouseEvent) {
      try {
        const a = findAnchor(e.target)
        if (!a || !a.href) return
        if (a.hasAttribute('data-no-preview')) return
        const href = a.getAttribute('href') || ''
        // ignore anchors and javascript: links
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

        // Compute absolute URL; prefix api base for server-rooted paths
        const url = (href.startsWith('/') || href.startsWith('/media')) ? `${(apiClient as any).baseUrl}${href}` : href

        // Decide whether to preview: server media, pdf/images/audio/video, youtube links
        const lower = url.toLowerCase()
        const shouldPreview = lower.includes('/media/') || lower.includes('youtube.com/watch') || lower.includes('youtu.be/') || /\.(pdf|png|jpe?g|gif|webp|svg|mp4|webm|ogg|mp3|wav|m4a)$/i.test(lower)
        if (!shouldPreview) return

        e.preventDefault()
        e.stopPropagation()
        setActive({ url })
        setOpen(true)
      } catch (err) {
        // ignore
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        setOpen(false)
        setActive(null)
      }}
      title="Preview"
      size="xl"
    >
      <div className="py-2">
        {active && <AttachmentPreview url={active.url} type={active.type} />}
      </div>
    </Modal>
  )
}
