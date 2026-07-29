import clsx from 'clsx'

const VARIANTS = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
};

const SIZES = {
  default: 'h-12 px-4 text-sm',
  icon: 'h-10 w-10 p-0',
};

export function Button({ variant = 'default', size = 'default', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}
