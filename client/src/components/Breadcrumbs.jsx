import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumbs({ breadcrumbs = [], searchTerm, onNavigate }) {
  if (searchTerm.trim().length >= 2) {
    return (
      <div className="flex items-center gap-2 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-slate-300">
        <Home className="h-4 w-4 text-cyan-200" />
        <span className="truncate">Search results for “{searchTerm.trim()}”</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm custom-scrollbar">
      <AnimatePresence initial={false}>
        {breadcrumbs.map((crumb, index) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex shrink-0 items-center gap-1"
            exit={{ opacity: 0, x: -8 }}
            initial={{ opacity: 0, x: 8 }}
            key={crumb.path || "home"}
          >
            {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-600" /> : null}
            <button
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 font-medium transition ${
                index === breadcrumbs.length - 1
                  ? "bg-cyan-300/10 text-cyan-100"
                  : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
              }`}
              onClick={() => onNavigate(crumb.path)}
              type="button"
            >
              {index === 0 ? <Home className="h-4 w-4" /> : null}
              {crumb.name}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

