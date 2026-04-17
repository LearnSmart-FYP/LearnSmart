/**
 * Chat - Main Component
 * Manages floating button and chat panel state
 * Connects/disconnects WebSocket when panel opens/closes
 */
import { useState, useEffect } from 'react'
import { FloatingChatButton } from './FloatingChatButton'
import { ChatPanel } from './ChatPanel'
import { useChat } from '../../contexts'

export function Chat() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const { connect, disconnect } = useChat()

  // Connect WebSocket when panel opens, disconnect when it closes
  useEffect(() => {
    if (isPanelOpen) {
      console.log('💬 Chat panel opened - connecting WebSocket')
      connect()
    }
    return () => {
      if (isPanelOpen) {
        console.log('💬 Chat panel closed - disconnecting WebSocket')
        disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanelOpen])

  return (
    <>
      <FloatingChatButton
        onClick={() => setIsPanelOpen(true)}
        isOpen={isPanelOpen}
      />
      <ChatPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </>
  )
}
