import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import HistoryList from '@/components/HistoryList'
import { useDevice } from '@/lib/DeviceContext'
import { Button } from '@/components/ui/button'
import ClearHistoryModal from '@/views/history/ClearHistoryModal'

export default function History() {
  const { historyLogs, clearAllHistory, deleteHistoryLog } = useDevice()
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const handleClearClick = () => {
    if (historyLogs.length) setShowConfirmModal(true)
  }

  const handleConfirm = () => {
    clearAllHistory()
    setShowConfirmModal(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Alert History</h1>
          <p className="text-sm text-muted-foreground">
            Every status change is logged with timestamp &amp; location.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={handleClearClick}
          disabled={!historyLogs.length}
          className="shrink-0 rounded-xl text-destructive disabled:opacity-40"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear History
        </Button>
      </div>

      <HistoryList history={historyLogs} onDelete={deleteHistoryLog} />

      {showConfirmModal && (
        <ClearHistoryModal
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  )
}
