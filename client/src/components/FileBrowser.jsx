import EmptyState from "./EmptyState";
import FileCard from "./FileCard";
import SkeletonGrid from "./SkeletonGrid";

export default function FileBrowser({
  items,
  loading,
  error,
  layout,
  selectedPaths,
  searchTerm,
  onOpen,
  onPreview,
  onSelect,
  onDownload,
  onRename,
  onDelete,
  onRefresh
}) {
  if (loading) {
    return <SkeletonGrid layout={layout} />;
  }

  if (error) {
    return (
      <div className="glass-subtle rounded-[2rem] p-8 text-center">
        <h2 className="text-xl font-bold text-white">Could not load this view.</h2>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <button className="primary-button mt-5" onClick={onRefresh} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (!items.length) {
    return <EmptyState searchTerm={searchTerm} />;
  }

  const gridClass =
    layout === "gallery"
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : layout === "compact"
        ? "space-y-2"
        : layout === "list" || layout === "detail"
          ? "space-y-3"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  const scrollClass = items.length > 10 ? "max-h-[min(72vh,820px)] overflow-y-auto pr-1 custom-scrollbar" : "";

  return (
    <div className={scrollClass}>
      <div className={gridClass}>
        {items.map((item) => (
          <FileCard
            item={item}
            key={item.path}
            layout={layout}
            onDelete={onDelete}
            onDownload={onDownload}
            onOpen={onOpen}
            onPreview={onPreview}
            onRename={onRename}
            onSelect={onSelect}
            selected={selectedPaths.has(item.path)}
          />
        ))}
      </div>
    </div>
  );
}
