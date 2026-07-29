import { useId } from 'react'

export function AlertDialog({ open, onOpenChange, children }) {
  const id = useId()
  return (
    <div data-open={open}>
      {children}
    </div>
  )
}

export function AlertDialogContent({ children, className = '', ...props }) {
  return (
    <div className={`rounded-3xl border border-border bg-white p-6 shadow-xl ${className}`} {...props}>
      {children}
    </div>
  )
}

export function AlertDialogHeader({ children, className = '', ...props }) {
  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function AlertDialogTitle({ children, className = '', ...props }) {
  return (
    <h2 className={`text-lg font-semibold text-slate-900 ${className}`} {...props}>
      {children}
    </h2>
  )
}

export function AlertDialogDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-sm text-slate-600 ${className}`} {...props}>
      {children}
    </p>
  )
}

export function AlertDialogFooter({ children, className = '', ...props }) {
  return (
    <div className={`mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end ${className}`} {...props}>
      {children}
    </div>
  )
}

export function AlertDialogAction({ children, className = '', ...props }) {
  return (
    <button className={`rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${className}`} {...props}>
      {children}
    </button>
  )
}

export function AlertDialogCancel({ children, className = '', ...props }) {
  return (
    <button className={`rounded-2xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${className}`} {...props}>
      {children}
    </button>
  )
}
