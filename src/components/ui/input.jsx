export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 ${className}`}
      {...props}
    />
  )
}
