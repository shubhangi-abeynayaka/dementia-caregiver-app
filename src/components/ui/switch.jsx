import { useId } from 'react'

export function Switch({ checked = false, onCheckedChange, className = '', ...props }) {
  const id = useId()

  return (
    <label className={`inline-flex cursor-pointer items-center gap-3 ${className}`} htmlFor={id}>
      <span className="relative inline-flex h-7 w-12 items-center rounded-full bg-slate-300 transition-colors duration-200"
        aria-hidden="true"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="sr-only"
        {...props}
      />
    </label>
  )
}
