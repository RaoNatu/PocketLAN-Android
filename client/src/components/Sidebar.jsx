import { motion } from "framer-motion";
import {
  FolderPlus,
  HardDrive,
  LayoutDashboard,
  Lock,
  UploadCloud,
  Wifi,
  X
} from "lucide-react";
import { formatBytes } from "../utils/format";
import { quickFilterIcon } from "../utils/fileIcons.jsx";

const filters = [
  { id: "all", label: "All files", icon: LayoutDashboard },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "pdf", label: "PDFs" },
  { id: "document", label: "Documents" },
  { id: "code", label: "Code" },
  { id: "archive", label: "Archives" }
];

export default function Sidebar({
  typeFilter,
  onTypeFilter,
  storage,
  storageLoading,
  onUploadClick,
  onCreateFolder,
  onLock,
  mobileOpen,
  onMobileClose
}) {
  const content = (
    <aside className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img alt="PocketLAN" className="h-12 w-12 shrink-0 rounded-3xl border border-white/15 object-cover shadow-glow" src="/logo.png" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-white">PocketLAN</h1>
            <p className="truncate text-xs text-slate-400">Your private Wi-Fi file explorer</p>
          </div>
        </div>
        <button className="icon-button lg:hidden" onClick={onMobileClose} type="button">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-4 text-emerald-50">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wifi className="h-4 w-4" />
          Local Network
        </div>
        <p className="text-xs leading-5 text-emerald-100/75">Running privately from this Android device for trusted Wi-Fi browsers.</p>
      </div>

      <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.055] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <HardDrive className="h-4 w-4 text-cyan-200" />
            Storage
          </div>
          {storage?.truncated ? <span className="text-[11px] text-amber-200">Partial</span> : null}
        </div>
        {storageLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-5" />
            <div className="skeleton h-5" />
          </div>
        ) : storage ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950/35 p-2">
              <p className="text-sm font-bold text-white">{formatBytes(storage.size)}</p>
              <p className="text-[11px] text-slate-500">Used</p>
            </div>
            <div className="rounded-2xl bg-slate-950/35 p-2">
              <p className="text-sm font-bold text-white">{storage.files}</p>
              <p className="text-[11px] text-slate-500">Files</p>
            </div>
            <div className="rounded-2xl bg-slate-950/35 p-2">
              <p className="text-sm font-bold text-white">{storage.folders}</p>
              <p className="text-[11px] text-slate-500">Folders</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Storage summary unavailable.</p>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button className="secondary-button justify-center" onClick={onUploadClick} type="button">
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>
        <button className="secondary-button justify-center" onClick={onCreateFolder} type="button">
          <FolderPlus className="h-4 w-4" />
          Folder
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-auto pr-1 custom-scrollbar">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const active = typeFilter === filter.id;

          return (
            <button
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "accent-active shadow-glow"
                  : "text-slate-300 hover:bg-white/[0.065] hover:text-white"
              }`}
              key={filter.id}
              onClick={() => onTypeFilter(filter.id)}
              type="button"
            >
              {Icon ? <Icon className="h-4 w-4" /> : quickFilterIcon(filter.id)}
              <span className="font-medium">{filter.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="mt-5 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.055] hover:text-white" onClick={onLock} type="button">
        <Lock className="h-4 w-4" />
        Lock this browser
      </button>
    </aside>
  );

  return (
    <>
      <div className="glass hidden h-[calc(100vh-32px)] min-h-[680px] rounded-[2rem] lg:block">{content}</div>
      {mobileOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 bg-slate-950/70 p-3 backdrop-blur-sm lg:hidden"
          initial={{ opacity: 0 }}
          onClick={onMobileClose}
        >
          <motion.div
            animate={{ x: 0 }}
            className="glass h-full max-w-[320px] rounded-[2rem]"
            initial={{ x: -340 }}
            onClick={(event) => event.stopPropagation()}
          >
            {content}
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}
