import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import HistoryList from "@/components/HistoryList";
import { useDevice } from "@/lib/DeviceContext";

export default function History() {
  const { history, clearAllHistory } = useDevice();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Alert History</h1>
        <p className="text-sm text-muted-foreground">
          Every status change is logged with timestamp &amp; location.
        </p>
      </div>

      <HistoryList history={history} onClear={() => setConfirmOpen(true)} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every logged event. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllHistory();
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
