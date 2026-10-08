import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 text-sm shadow-xl">
            {t.type === 'error'
              ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sev-critical" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            <span className="flex-1 text-ink-100">{t.message}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-ink-400 hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
