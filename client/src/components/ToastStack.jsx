import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X, Zap } from "lucide-react";

const toneStyles = {
  success: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  error: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  warning: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  info: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: Zap,
  info: Info
};

export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-32px))] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone] || Info;

          return (
            <motion.div
              key={toast.id}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`pointer-events-auto rounded-3xl border p-4 shadow-soft backdrop-blur-2xl ${
                toneStyles[toast.tone] || toneStyles.info
              }`}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              layout
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.message ? <p className="mt-1 text-sm opacity-80">{toast.message}</p> : null}
                </div>
                <button
                  aria-label="Dismiss notification"
                  className="rounded-full p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
                  onClick={() => onDismiss(toast.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

