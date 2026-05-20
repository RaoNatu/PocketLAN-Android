import { motion } from "framer-motion";
import { FolderOpen, SearchX, Sparkles } from "lucide-react";

export default function EmptyState({ searchTerm }) {
  const searching = searchTerm.trim().length >= 2;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="glass-subtle flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] px-6 py-12 text-center"
      initial={{ opacity: 0, y: 12 }}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/10 bg-cyan-300/10 text-cyan-100">
        {searching ? <SearchX className="h-9 w-9" /> : <FolderOpen className="h-9 w-9" />}
      </div>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Sparkles className="h-3.5 w-3.5" />
        {searching ? "No matches" : "Ready for files"}
      </div>
      <h2 className="max-w-xl text-2xl font-bold tracking-tight text-white">
        {searching ? "Nothing matched your search." : "This folder is beautifully empty."}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
        {searching
          ? "Try a shorter file name, clear the type filter, or browse back into the folder tree."
          : "Drop files here from your tablet or use the upload button to start building your private Wi-Fi drive."}
      </p>
    </motion.div>
  );
}

