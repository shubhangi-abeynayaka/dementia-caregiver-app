import { useState } from "react";
import { Trash2 } from "lucide-react";
import HistoryList from "@/components/HistoryList";
import { useDevice } from "@/lib/DeviceContext";
import { Button } from "@/components/ui/button";

export default function History() {
  const { historyLogs, clearAllHistory, deleteHistoryLog } = useDevice();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const clearHistory = () => {
    if (historyLogs.length) setShowConfirmModal(true);
  };

  const confirmClearHistory = () => {
    clearAllHistory();
    setShowConfirmModal(false);
  };

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
          onClick={clearHistory}
          disabled={!historyLogs.length}
          className="shrink-0 rounded-xl text-destructive disabled:opacity-40"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear History
        </Button>
      </div>

      <HistoryList history={historyLogs} onDelete={deleteHistoryLog} />

      {showConfirmModal && (
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
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmClearHistory}
                className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
