/**
 * @fileoverview ToggleRow — a reusable label + toggle button row.
 * Generalised from the inline ToggleButton in Settings.jsx.
 * Pure presentational component.
 */

/**
 * @param {{
 *   label: string,
 *   description?: string,
 *   checked: boolean,
 *   onToggle: () => void,
 * }} props
 */
export default function ToggleRow({ label, description, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p>{label}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
