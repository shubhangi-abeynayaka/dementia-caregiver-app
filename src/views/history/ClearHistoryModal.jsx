/**
 * @fileoverview ClearHistoryModal — confirmation dialog for clearing all history.
 * Pure presentational component.
 */

import { Button } from '@/components/ui/button'

/**
 * @param {{
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ClearHistoryModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-history-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
        <h2 id="clear-history-title" className="text-lg font-bold">
          Clear Alert History?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently remove all logged tracking events.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="rounded-xl bg-red-600 text-white hover:bg-red-700"
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>
  )
}
