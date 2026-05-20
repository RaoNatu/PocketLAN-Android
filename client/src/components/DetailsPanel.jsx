import { Download, Eye, Info, Pencil, ShieldCheck } from "lucide-react";
import { FileTypeIcon, iconTone } from "../utils/fileIcons.jsx";
import { formatBytes, formatDate, titleCase } from "../utils/format";

export default function DetailsPanel({ item, selectedCount, onPreview, onDownload, onRename }) {
  return (
    <aside className="glass hidden h-[calc(100vh-32px)] min-h-[680px] overflow-hidden rounded-[2rem] xl:block">
      <div className="flex h-full flex-col p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Info className="h-4 w-4 text-cyan-200" />
          Details
        </div>

        {item ? (
          <div className="min-h-0 flex-1 overflow-auto pr-1 custom-scrollbar">
            <div className={`mb-5 flex aspect-square max-h-48 items-center justify-center rounded-[2rem] bg-gradient-to-br ${iconTone(item.category)}`}>
              <FileTypeIcon item={item} className="h-16 w-16" />
            </div>

            <h2 className="break-words text-xl font-bold tracking-tight text-white">{item.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
                {titleCase(item.category)}
              </span>
              {item.canPreview ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  Previewable
                </span>
              ) : null}
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="mt-1 text-slate-200">{item.type === "folder" ? "Folder" : titleCase(item.category)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Size</dt>
                <dd className="mt-1 text-slate-200">{item.type === "folder" ? "Folder" : formatBytes(item.size)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Modified</dt>
                <dd className="mt-1 text-slate-200">{formatDate(item.modifiedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Relative path</dt>
                <dd className="mt-1 break-all rounded-2xl border border-white/10 bg-slate-950/35 p-3 font-mono text-xs text-slate-300">
                  {item.path || "/"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-2">
              {item.type === "file" ? (
                <>
                  <button className="primary-button w-full" onClick={() => onDownload(item)} type="button">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button className="secondary-button w-full" disabled={!item.canPreview} onClick={() => onPreview(item)} type="button">
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </>
              ) : null}
              <button className="secondary-button w-full" onClick={() => onRename(item)} type="button">
                <Pencil className="h-4 w-4" />
                Rename
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.055] text-cyan-100">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">{selectedCount ? `${selectedCount} items selected` : "Nothing selected"}</h2>
            <p className="mt-2 max-w-56 text-sm leading-6 text-slate-500">
              Select an item to inspect its metadata, preview support, and quick actions.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

