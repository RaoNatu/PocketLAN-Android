import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, FileQuestion, X } from "lucide-react";
import MediaPlayer from "./MediaPlayer";
import { fileUrl } from "../utils/api";
import { FileTypeIcon, iconTone } from "../utils/fileIcons.jsx";
import { formatBytes, formatDate, titleCase } from "../utils/format";

export default function PreviewModal({ item, mediaItems = [], onClose, onDownload }) {
  const [textPreview, setTextPreview] = useState("");
  const [textError, setTextError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadText() {
      setTextPreview("");
      setTextError("");

      if (!item || !["text", "code"].includes(item.category)) return;

      try {
        const response = await fetch(fileUrl("/preview", item.path));
        if (!response.ok) throw new Error("Preview failed");
        const text = await response.text();
        if (!cancelled) setTextPreview(text);
      } catch {
        if (!cancelled) setTextError("Text preview could not be loaded.");
      }
    }

    loadText();

    return () => {
      cancelled = true;
    };
  }, [item]);

  const renderPreview = () => {
    if (!item) return null;

    if (item.category === "image") {
      return (
        <div className="flex min-h-[40vh] items-center justify-center bg-slate-950/35">
          <img alt={item.name} className="max-h-[72vh] max-w-full object-contain" src={fileUrl("/preview", item.path)} />
        </div>
      );
    }

    if (item.category === "video" || item.category === "audio") {
      return <MediaPlayer initialItem={item} mediaItems={mediaItems} onDownload={onDownload} />;
    }

    if (item.category === "pdf") {
      return <iframe className="h-[72vh] w-full bg-white" src={fileUrl("/preview", item.path)} title={item.name} />;
    }

    if (["text", "code"].includes(item.category)) {
      return (
        <div className="max-h-[72vh] overflow-auto bg-slate-950/55 p-5 custom-scrollbar">
          {textError ? (
            <p className="text-sm text-rose-200">{textError}</p>
          ) : textPreview ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-slate-200">{textPreview}</pre>
          ) : (
            <div className="space-y-3">
              <div className="skeleton h-5" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-5 w-5/6" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center bg-slate-950/35 p-8 text-center">
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.055] text-slate-200">
          <FileQuestion className="h-11 w-11" />
        </div>
        <h3 className="text-xl font-bold text-white">Preview is not available</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">This file can still be downloaded to your device.</p>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[2rem]"
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconTone(item.category)}`}>
                  <FileTypeIcon item={item} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-white sm:text-lg">{item.name}</h2>
                  <p className="truncate text-xs text-slate-500">
                    {titleCase(item.category)} · {item.type === "folder" ? "Folder" : formatBytes(item.size)} · {formatDate(item.modifiedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a className="icon-button" href={fileUrl("/download", item.path)} title="Open direct download">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button className="icon-button" onClick={() => onDownload(item)} title="Download" type="button">
                  <Download className="h-4 w-4" />
                </button>
                <button className="icon-button" onClick={onClose} title="Close" type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-auto custom-scrollbar">{renderPreview()}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
