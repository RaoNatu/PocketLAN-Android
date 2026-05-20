import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDialog({ dialog, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {dialog ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass w-full max-w-lg rounded-[2rem] p-5"
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{dialog.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{dialog.message}</p>
                </div>
              </div>
              <button className="icon-button shrink-0" onClick={onCancel} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            {dialog.detail ? (
              <div className="mb-5 max-h-36 overflow-auto rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300 custom-scrollbar">
                {dialog.detail}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="secondary-button" onClick={onCancel} type="button">
                Cancel
              </button>
              <button className={dialog.danger ? "danger-button" : "primary-button"} onClick={onConfirm} type="button">
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

