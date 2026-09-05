import { useId } from 'react'

export function Switch({ checked = false, onCheckedChange, className = '', ...props }) {
  const id = useId()

  return (
    <label className={`inline-flex cursor-pointer items-center gap-3 ${className}`} htmlFor={id}>
      <span 
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
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
