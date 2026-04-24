import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Spinner from '../components/ui/Spinner'

interface BlockingOverlayState {
  active: boolean
  message: string
}

interface BlockingOverlayContextValue {
  block: (message: string) => void
  unblock: () => void
  isBlocking: boolean
}

const BlockingOverlayContext = createContext<BlockingOverlayContextValue | undefined>(undefined)

export function useBlockingOverlay() {
  const ctx = useContext(BlockingOverlayContext)
  if (!ctx) throw new Error('useBlockingOverlay must be used within BlockingOverlayProvider')
  return ctx
}

export function BlockingOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BlockingOverlayState>({ active: false, message: '' })

  const block = useCallback((message: string) => {
    setState({ active: true, message })
  }, [])

  const unblock = useCallback(() => {
    setState({ active: false, message: '' })
  }, [])

  return (
    <BlockingOverlayContext.Provider value={{ block, unblock, isBlocking: state.active }}>
      {children}
      {state.active && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ cursor: 'wait' }}
          role="alertdialog"
          aria-modal="true"
          aria-label={state.message}
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onKeyDown={(e) => {
            if (e.key === 'Tab' || e.key === 'Escape') {
              e.preventDefault()
            }
          }}
        >
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-lg px-6 py-4 shadow-2xl flex items-center gap-3 min-w-[280px]">
            <Spinner size="md" />
            <span className="text-sm font-medium text-[var(--color-text)]">{state.message}</span>
          </div>
        </div>
      )}
    </BlockingOverlayContext.Provider>
  )
}
