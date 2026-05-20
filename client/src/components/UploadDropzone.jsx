import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { formatBytes } from "../utils/format";

export default function UploadDropzone({ dragging, uploadState }) {
  return (
    <>
      <AnimatePresence>
        {dragging ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.div
              animate={{ scale: 1, y: 0 }}
              className="rounded-[2rem] border border-dashed border-cyan-200/60 bg-cyan-300/10 px-8 py-10 text-center shadow-glow"
              initial={{ scale: 0.96, y: 10 }}
            >
              <UploadCloud className="mx-auto mb-4 h-12 w-12 text-cyan-100" />
              <p className="text-xl font-bold text-white">Drop files to upload</p>
              <p className="mt-2 text-sm text-cyan-100/75">They will land in the current folder.</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {uploadState ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-4 left-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-4 shadow-glow backdrop-blur-2xl"
            exit={{ opacity: 0, y: 18 }}
            initial={{ opacity: 0, y: 18 }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {uploadState.active ? "Uploading" : "Upload complete"} · {uploadState.fileCount} file
                  {uploadState.fileCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatBytes(uploadState.loaded)} of {formatBytes(uploadState.total)} · {formatBytes(uploadState.speed)}/s
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-100">{uploadState.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ width: `${uploadState.percent}%` }}
                className="h-full rounded-full bg-cyan-300"
                initial={false}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

