import {
  Archive,
  Code2,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Music,
  Presentation
} from "lucide-react";

const iconMap = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  subtitle: FileText,
  pdf: FileText,
  text: FileText,
  code: Code2,
  archive: Archive,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  unknown: File
};

const colorMap = {
  folder: "from-amber-300/25 to-orange-400/10 text-amber-200",
  image: "from-fuchsia-300/20 to-pink-400/10 text-fuchsia-200",
  video: "from-sky-300/20 to-blue-400/10 text-sky-200",
  audio: "from-emerald-300/20 to-teal-400/10 text-emerald-200",
  subtitle: "from-cyan-300/20 to-teal-400/10 text-cyan-100",
  pdf: "from-rose-300/20 to-red-400/10 text-rose-200",
  text: "from-slate-300/16 to-slate-400/8 text-slate-100",
  code: "from-cyan-300/20 to-blue-400/10 text-cyan-200",
  archive: "from-violet-300/20 to-indigo-400/10 text-violet-200",
  document: "from-blue-300/20 to-indigo-400/10 text-blue-200",
  spreadsheet: "from-lime-300/20 to-emerald-400/10 text-lime-200",
  presentation: "from-orange-300/20 to-rose-400/10 text-orange-200",
  unknown: "from-slate-300/14 to-white/5 text-slate-200"
};

export function FileTypeIcon({ item, className = "h-6 w-6" }) {
  const Icon = iconMap[item?.category] || (item?.type === "folder" ? Folder : File);
  return <Icon className={className} strokeWidth={1.8} />;
}

export function iconTone(category) {
  return colorMap[category] || colorMap.unknown;
}

export function quickFilterIcon(category, className = "h-4 w-4") {
  const Icon =
    {
      image: FileImage,
      video: FileVideo,
      audio: Music,
      subtitle: FileText,
      pdf: FileText,
      document: FileText,
      code: Code2,
      archive: Archive,
      spreadsheet: FileSpreadsheet
    }[category] || File;

  return <Icon className={className} />;
}
