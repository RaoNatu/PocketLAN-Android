import { memo } from "react";
import { Check, Download, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { fileUrl } from "../utils/api";
import { FileTypeIcon, iconTone } from "../utils/fileIcons.jsx";
import { formatBytes, formatDate, titleCase } from "../utils/format";

function FileCard({
  item,
  layout,
  selected,
  onOpen,
  onPreview,
  onSelect,
  onDownload,
  onRename,
  onDelete
}) {
  const isList = layout === "list" || layout === "detail";
  const isCompact = layout === "compact";
  const isGallery = layout === "gallery";
  const previewableMedia = item.category === "image" || item.category === "video";

  if (isList || isCompact) {
    return (
      <div
        className={`file-card group grid items-center gap-3 rounded-3xl border p-3 transition ${
          isCompact
            ? "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
            : "grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]"
        } ${selected ? "accent-selected" : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]"}`}
      >
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
            selected ? "accent-active border-transparent" : "border-white/15 text-transparent hover:text-slate-200"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item);
          }}
          type="button"
        >
          <Check className="h-4 w-4" />
        </button>

        <button
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconTone(item.category)}`}
          onClick={() => onOpen(item)}
          type="button"
        >
          <FileTypeIcon item={item} className="h-6 w-6" />
        </button>

        <button className="min-w-0 text-left" onClick={() => onOpen(item)} type="button">
          <p className="truncate font-semibold text-white">{item.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {titleCase(item.category)} · {item.type === "folder" ? "Folder" : formatBytes(item.size)}
          </p>
        </button>

        {!isCompact ? (
          <div className="hidden text-right text-xs text-slate-500 md:block">
            <p>{formatDate(item.modifiedAt)}</p>
            <p className="mt-1">{item.extension || item.type}</p>
          </div>
        ) : null}

        <div className="flex justify-end gap-1">
          {item.type === "file" ? (
            <button className="icon-button h-9 w-9" onClick={() => onDownload(item)} title="Download" type="button">
              <Download className="h-4 w-4" />
            </button>
          ) : null}
          <button className="icon-button h-9 w-9" onClick={() => onRename(item)} title="Rename" type="button">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`file-card group overflow-hidden rounded-[1.75rem] border transition ${
        selected ? "accent-selected shadow-glow" : "border-white/10 bg-white/[0.045] hover:-translate-y-0.5 hover:bg-white/[0.075]"
      }`}
    >
      <div className="relative p-3">
        <button
          className={`absolute left-5 top-5 z-10 flex h-7 w-7 items-center justify-center rounded-xl border backdrop-blur-xl transition ${
            selected ? "accent-active border-transparent" : "border-white/15 bg-slate-950/40 text-transparent group-hover:text-slate-200"
          }`}
          onClick={() => onSelect(item)}
          type="button"
        >
          <Check className="h-4 w-4" />
        </button>

        <button
          className={`flex w-full items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${iconTone(item.category)} ${
            isGallery ? "aspect-[4/3]" : "aspect-[5/3]"
          }`}
          onClick={() => onOpen(item)}
          type="button"
        >
          {item.category === "image" && (isGallery || layout === "grid") ? (
            <img alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" src={fileUrl("/preview", item.path)} />
          ) : previewableMedia && isGallery ? (
            <div className="flex h-full w-full items-center justify-center">
              <FileTypeIcon item={item} className="h-14 w-14" />
            </div>
          ) : (
            <FileTypeIcon item={item} className="h-12 w-12" />
          )}
        </button>
      </div>

      <div className="px-4 pb-4">
        <button className="block w-full text-left" onClick={() => onOpen(item)} type="button">
          <h3 className="truncate font-semibold text-white">{item.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            {titleCase(item.category)} · {item.type === "folder" ? "Folder" : formatBytes(item.size)}
          </p>
        </button>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-slate-500">{formatDate(item.modifiedAt)}</p>
          <div className="flex gap-1">
            {item.canPreview ? (
              <button className="icon-button h-9 w-9" onClick={() => onPreview(item)} title="Preview" type="button">
                <Eye className="h-4 w-4" />
              </button>
            ) : null}
            {item.type === "file" ? (
              <button className="icon-button h-9 w-9" onClick={() => onDownload(item)} title="Download" type="button">
                <Download className="h-4 w-4" />
              </button>
            ) : null}
            <button className="icon-button h-9 w-9" onClick={() => onRename(item)} title="Rename" type="button">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <button className="icon-button h-9 w-9 hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-rose-100" onClick={() => onDelete(item)} title="Delete" type="button">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(FileCard);
