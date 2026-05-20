import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  FolderPlus,
  Grid2X2,
  History,
  LayoutGrid,
  List,
  Menu,
  Moon,
  Palette,
  RotateCcw,
  Rows3,
  Search,
  Sun,
  TableProperties,
  UploadCloud,
  X
} from "lucide-react";
import { DEFAULT_ACCENT_COLOR } from "../utils/theme";

const layouts = [
  { id: "grid", label: "Grid", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "compact", label: "Compact", icon: Rows3 },
  { id: "gallery", label: "Gallery", icon: Grid2X2 },
  { id: "detail", label: "Detail", icon: TableProperties }
];

const sortOptions = [
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "category", label: "Type" },
  { value: "modifiedAt", label: "Modified" }
];

export default function TopBar({
  searchTerm,
  onSearchTerm,
  layout,
  onLayout,
  sortKey,
  onSortKey,
  sortDirection,
  onSortDirection,
  onUploadClick,
  onCreateFolder,
  onBack,
  onForward,
  canBack,
  canForward,
  accentColor,
  onAccentColor,
  colorMode,
  onColorMode,
  lastPlayedVideo,
  onLastPlayedVideo,
  selectedCount,
  onDownloadSelected,
  onDeleteSelected,
  onClearSelection,
  onMobileMenu
}) {
  return (
    <header className="glass rounded-[2rem] p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="icon-button lg:hidden" onClick={onMobileMenu} type="button">
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <button className="icon-button" disabled={!canBack} onClick={onBack} title="Back" type="button">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button className="icon-button" disabled={!canForward} onClick={onForward} title="Forward" type="button">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="field w-full pl-11 pr-10"
              onChange={(event) => onSearchTerm(event.target.value)}
              placeholder="Search files across your shared folder"
              value={searchTerm}
            />
            {searchTerm ? (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                onClick={() => onSearchTerm("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <button className="secondary-button" onClick={onCreateFolder} type="button">
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New folder</span>
          </button>
          <button className="primary-button" onClick={onUploadClick} type="button">
            <UploadCloud className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          {lastPlayedVideo ? (
            <button className="secondary-button" onClick={onLastPlayedVideo} title={`Resume ${lastPlayedVideo.name}`} type="button">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Last played</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-2xl border border-white/10 bg-slate-950/35 p-1">
              {layouts.map((option) => {
                const Icon = option.icon;
                const active = layout === option.id;

                return (
                  <button
                    className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-xs font-semibold transition ${
                      active ? "accent-active" : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                    key={option.id}
                    onClick={() => onLayout(option.id)}
                    title={`${option.label} view`}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-1 text-sm text-slate-300">
              <ArrowDownAZ className="h-4 w-4 text-slate-500" />
              <select
                className="bg-transparent text-sm outline-none"
                onChange={(event) => onSortKey(event.target.value)}
                value={sortKey}
              >
                {sortOptions.map((option) => (
                  <option className="bg-slate-900" key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="secondary-button min-h-10 px-3" onClick={() => onSortDirection(sortDirection === "asc" ? "desc" : "asc")} type="button">
              <ArrowDownWideNarrow className={`h-4 w-4 transition ${sortDirection === "asc" ? "rotate-180" : ""}`} />
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </button>

            <label
              className="flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 text-sm text-slate-300"
              title="Website color"
            >
              <Palette className="h-4 w-4 text-slate-500" />
              <span className="sr-only">Website color</span>
              <input
                aria-label="Website color"
                className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0"
                onChange={(event) => onAccentColor(event.target.value)}
                type="color"
                value={accentColor}
              />
              <button
                className="rounded-xl p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
                onClick={() => onAccentColor(DEFAULT_ACCENT_COLOR)}
                title="Reset color"
                type="button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </label>

            <button
              className="icon-button"
              onClick={() => onColorMode(colorMode === "light" ? "dark" : "light")}
              title={colorMode === "light" ? "Use dark theme" : "Use light theme"}
              type="button"
            >
              {colorMode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>

          {selectedCount ? (
            <div className="accent-selected flex flex-wrap items-center gap-2 rounded-2xl border px-2 py-2">
              <span className="px-2 text-sm font-semibold text-white">{selectedCount} selected</span>
              <button className="secondary-button min-h-9 px-3" onClick={onDownloadSelected} type="button">
                Download
              </button>
              <button className="danger-button min-h-9 px-3" onClick={onDeleteSelected} type="button">
                Delete
              </button>
              <button className="icon-button h-9 w-9" onClick={onClearSelection} title="Clear selection" type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
