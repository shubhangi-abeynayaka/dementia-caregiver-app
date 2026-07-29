import { useMemo } from 'react'

export function InputOTP({ children, value, onChange, maxLength = 6, autoFocus, ...props }) {
  const handleChange = (event) => {
    const next = event.target.value.replace(/[^0-9]/g, '').slice(0, maxLength)
    onChange(next)
  }

  return (
    <div className="flex items-center justify-center gap-2" {...props}>
      {children}
      <input
        type="text"
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        autoFocus={autoFocus}
        className="absolute opacity-0"
      />
    </div>
  )
}

export function InputOTPGroup({ children }) {
  return <div className="flex gap-2">{children}</div>
}

export function InputOTPSlot({ index }) {
  return (
    <span className="flex h-12 w-10 items-center justify-center rounded-2xl border border-border bg-background text-xl font-semibold text-foreground">
      {/* slot placeholder */}
    </span>
  )
}
