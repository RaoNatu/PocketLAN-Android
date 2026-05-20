import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, Pencil, X } from "lucide-react";

export default function TextInputModal({ modal, onCancel, onSubmit }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(modal?.initialValue || "");
  }, [modal]);

  return (
    <AnimatePresence>
      {modal ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.form
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass w-full max-w-md rounded-[2rem] p-5"
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(value.trim());
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
                  {modal.kind === "rename" ? <Pencil className="h-5 w-5" /> : <FolderPlus className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{modal.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{modal.message}</p>
                </div>
              </div>
              <button className="icon-button shrink-0" onClick={onCancel} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              autoFocus
              className="field mb-5 w-full"
              onChange={(event) => setValue(event.target.value)}
              placeholder={modal.placeholder || "Name"}
              value={value}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="secondary-button" onClick={onCancel} type="button">
                Cancel
              </button>
              <button className="primary-button" disabled={!value.trim()} type="submit">
                {modal.submitLabel || "Save"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

