import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import ConfirmDialog from "../components/ConfirmDialog";
import DetailsPanel from "../components/DetailsPanel";
import FileBrowser from "../components/FileBrowser";
import PreviewModal from "../components/PreviewModal";
import Sidebar from "../components/Sidebar";
import TextInputModal from "../components/TextInputModal";
import ToastStack from "../components/ToastStack";
import TopBar from "../components/TopBar";
import UploadDropzone from "../components/UploadDropzone";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useFiles } from "../hooks/useFiles";
import { useToasts } from "../hooks/useToasts";
import { useUpload } from "../hooks/useUpload";
import { bulkDownload, createFolder, deleteEntry, fileUrl, renameEntry } from "../utils/api";
import { saveBlob } from "../utils/format";
import { getLastPlayedVideo, LAST_PLAYED_VIDEO_EVENT } from "../utils/mediaMemory";
import { applyAccentColor, applyColorMode, getStoredAccentColor, getStoredColorMode, storeAccentColor, storeColorMode } from "../utils/theme";

export default function DrivePage({ onLock }) {
  const [currentPath, setCurrentPath] = useState("");
  const [backStack, setBackStack] = useState([]);
  const [forwardStack, setForwardStack] = useState([]);
  const [layout, setLayout] = useState(() => window.localStorage.getItem("pocketlan-layout") || "list");
  const [accentColor, setAccentColor] = useState(getStoredAccentColor);
  const [colorMode, setColorMode] = useState(getStoredColorMode);
  const [lastPlayedVideo, setLastPlayedVideo] = useState(getLastPlayedVideo);
  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 260);
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [activeItem, setActiveItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [textModal, setTextModal] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { toasts, pushToast, removeToast } = useToasts();
  const { folder, storage, storageLoading, searchResults, items, loading, error, refresh, refreshStorage } = useFiles({
    currentPath,
    searchTerm: debouncedSearchTerm,
    typeFilter,
    sortKey,
    sortDirection
  });
  const { uploadState, upload } = useUpload({
    currentPath,
    onComplete: () => {
      refresh();
      refreshStorage();
    }
  });

  const selectedPathSet = useMemo(() => new Set(selectedItems.keys()), [selectedItems]);
  const selectedList = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);
  const mediaItems = useMemo(() => items.filter((item) => item.type === "file" && ["audio", "video"].includes(item.category)), [items]);
  const activeVisibleItem = activeItem ? items.find((item) => item.path === activeItem.path) || activeItem : null;
  const detailItem = activeVisibleItem || selectedList[0] || null;

  useEffect(() => {
    window.localStorage.setItem("pocketlan-layout", layout);
  }, [layout]);

  useEffect(() => {
    applyAccentColor(accentColor);
    storeAccentColor(accentColor);
  }, [accentColor]);

  useEffect(() => {
    applyColorMode(colorMode);
    storeColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    const syncLastPlayedVideo = () => setLastPlayedVideo(getLastPlayedVideo());
    const syncFromStorage = (event) => {
      if (event.key === "pocketlan-last-played-video") syncLastPlayedVideo();
    };

    window.addEventListener(LAST_PLAYED_VIDEO_EVENT, syncLastPlayedVideo);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(LAST_PLAYED_VIDEO_EVENT, syncLastPlayedVideo);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function clearSelection() {
    setSelectedItems(new Map());
  }

  function navigateTo(nextPath, recordHistory = true) {
    const normalized = nextPath || "";

    if (normalized === currentPath && !searchTerm) return;

    if (recordHistory) {
      setBackStack((current) => (currentPath === normalized ? current : [...current, currentPath]));
      setForwardStack([]);
    }

    clearSelection();
    setActiveItem(null);
    setSearchTerm("");
    setCurrentPath(normalized);
  }

  function goBack() {
    setBackStack((current) => {
      if (!current.length) return current;

      const nextPath = current[current.length - 1];
      setForwardStack((forward) => [currentPath, ...forward]);
      setCurrentPath(nextPath);
      clearSelection();
      setActiveItem(null);
      setSearchTerm("");
      return current.slice(0, -1);
    });
  }

  function goForward() {
    setForwardStack((current) => {
      if (!current.length) return current;

      const [nextPath, ...rest] = current;
      setBackStack((back) => [...back, currentPath]);
      setCurrentPath(nextPath);
      clearSelection();
      setActiveItem(null);
      setSearchTerm("");
      return rest;
    });
  }

  function openItem(item) {
    setActiveItem(item);

    if (item.type === "folder") {
      navigateTo(item.path);
      return;
    }

    setPreviewItem(item);
  }

  function openLastPlayedVideo() {
    if (lastPlayedVideo?.item) {
      setPreviewItem(lastPlayedVideo.item);
    }
  }

  function toggleSelect(item) {
    setActiveItem(item);
    setSelectedItems((current) => {
      const next = new Map(current);
      if (next.has(item.path)) next.delete(item.path);
      else next.set(item.path, item);
      return next;
    });
  }

  function downloadViaAnchor(item) {
    const anchor = document.createElement("a");
    anchor.href = fileUrl("/download", item.path);
    anchor.download = item.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadFilesIndividually(fileItems) {
    fileItems.forEach((item, index) => {
      window.setTimeout(() => downloadViaAnchor(item), index * 180);
    });
  }

  async function downloadItem(item) {
    try {
      if (item.type === "folder") {
        const blob = await bulkDownload([item.path]);
        saveBlob(blob, `${item.name}.zip`);
      } else {
        downloadViaAnchor(item);
      }
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Download failed",
        message: requestError.response?.data?.error || "The selected item could not be downloaded."
      });
    }
  }

  async function downloadSelected() {
    try {
      const fileItems = selectedList.filter((item) => item.type === "file");
      const folderItems = selectedList.filter((item) => item.type === "folder");

      if (fileItems.length) {
        downloadFilesIndividually(fileItems);
      }

      if (!folderItems.length) {
        pushToast({
          tone: "success",
          title: "Downloads started",
          message: `${fileItems.length} file${fileItems.length === 1 ? "" : "s"} downloading individually.`
        });
        return;
      }

      const blob = await bulkDownload(folderItems.map((item) => item.path));
      saveBlob(blob, folderItems.length === 1 ? `${folderItems[0].name}.zip` : "pocketlan-folders.zip");
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Download failed",
        message: requestError.response?.data?.error || "The selection could not be downloaded."
      });
    }
  }

  function requestDelete(targets) {
    const itemList = Array.isArray(targets) ? targets : [targets];
    if (!itemList.length) return;

    setConfirmDialog({
      title: itemList.length === 1 ? "Delete item permanently?" : "Delete selected items permanently?",
      message:
        itemList.length === 1
          ? `"${itemList[0].name}" will be deleted permanently. This cannot be undone from PocketLAN.`
          : `${itemList.length} items will be deleted permanently. This cannot be undone from PocketLAN.`,
      detail: itemList.map((item) => item.path || item.name).join("\n"),
      danger: true,
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await Promise.all(itemList.map((item) => deleteEntry(item.path)));
          clearSelection();
          setActiveItem(null);
          await refresh();
          await refreshStorage();
          pushToast({ tone: "success", title: "Deleted permanently", message: `${itemList.length} item${itemList.length === 1 ? "" : "s"} removed.` });
        } catch (requestError) {
          pushToast({
            tone: "error",
            title: "Delete failed",
            message: requestError.response?.data?.error || "One or more items could not be deleted."
          });
        }
      }
    });
  }

  function requestCreateFolder() {
    setTextModal({
      kind: "folder",
      title: "Create folder",
      message: "Add a new folder inside the current location.",
      placeholder: "Folder name",
      submitLabel: "Create folder"
    });
  }

  function requestRename(item) {
    setActiveItem(item);
    setTextModal({
      kind: "rename",
      item,
      title: "Rename item",
      message: "Choose a new safe name for this file or folder.",
      placeholder: "New name",
      initialValue: item.name,
      submitLabel: "Continue"
    });
  }

  async function handleTextModalSubmit(value) {
    if (!textModal || !value) return;

    const modal = textModal;
    setTextModal(null);

    if (modal.kind === "folder") {
      try {
        await createFolder(currentPath, value);
        await refresh();
        await refreshStorage();
        pushToast({ tone: "success", title: "Folder created", message: value });
      } catch (requestError) {
        pushToast({
          tone: "error",
          title: "Folder not created",
          message: requestError.response?.data?.error || "Could not create that folder."
        });
      }
      return;
    }

    if (modal.kind === "rename" && modal.item) {
      setConfirmDialog({
        title: "Confirm rename",
        message: `Rename "${modal.item.name}" to "${value}"?`,
        confirmLabel: "Rename",
        onConfirm: async () => {
          setConfirmDialog(null);
          try {
            const renamed = await renameEntry(modal.item.path, value);
            setActiveItem(renamed);
            await refresh();
            pushToast({ tone: "success", title: "Renamed", message: renamed.name });
          } catch (requestError) {
            pushToast({
              tone: "error",
              title: "Rename failed",
              message: requestError.response?.data?.error || "Could not rename that item."
            });
          }
        }
      });
    }
  }

  async function performUpload(fileList, overwrite = false) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    try {
      const result = await upload(files, overwrite);
      const count = result.uploaded?.length || files.length;
      pushToast({
        tone: "success",
        title: overwrite ? "Upload complete with overwrite" : "Upload complete",
        message: `${count} file${count === 1 ? "" : "s"} uploaded.`
      });
    } catch (requestError) {
      const conflicts = requestError.response?.data?.conflicts || [];

      if (requestError.response?.status === 409 && conflicts.length && !overwrite) {
        requestOverwrite(files, conflicts);
        return;
      }

      pushToast({
        tone: "error",
        title: "Upload failed",
        message: requestError.response?.data?.error || "The upload could not be completed."
      });
    }
  }

  function requestOverwrite(files, conflictNames) {
    setConfirmDialog({
      title: "Overwrite existing files?",
      message: `${conflictNames.length} uploaded file${conflictNames.length === 1 ? "" : "s"} already exist in this folder.`,
      detail: conflictNames.join("\n"),
      danger: true,
      confirmLabel: "Overwrite",
      onConfirm: async () => {
        setConfirmDialog(null);
        await performUpload(files, true);
      }
    });
  }

  function handleUploadRequest(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    const currentNames = new Set((folder?.items || []).map((item) => item.name.toLowerCase()));
    const conflicts = files.map((file) => file.name).filter((name) => currentNames.has(name.toLowerCase()));

    if (conflicts.length) {
      requestOverwrite(files, conflicts);
      return;
    }

    performUpload(files, false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    handleUploadRequest(event.dataTransfer.files);
  }

  const subtitle = searchResults
    ? `${searchResults.results.length} result${searchResults.results.length === 1 ? "" : "s"}`
    : folder
      ? `${folder.items.length} item${folder.items.length === 1 ? "" : "s"} in this folder`
      : "Loading files";

  return (
    <div
      className="min-h-screen p-3 sm:p-4"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        className="hidden"
        multiple
        onChange={(event) => {
          handleUploadRequest(event.target.files);
          event.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <UploadDropzone dragging={dragging} uploadState={uploadState} />
      <ToastStack onDismiss={removeToast} toasts={toasts} />

      <div className="mx-auto grid max-w-[1800px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCreateFolder={requestCreateFolder}
          onLock={onLock}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onTypeFilter={setTypeFilter}
          onUploadClick={() => fileInputRef.current?.click()}
          storage={storage}
          storageLoading={storageLoading}
          typeFilter={typeFilter}
        />

        <main className="min-w-0 space-y-4">
          <TopBar
            canBack={backStack.length > 0}
            canForward={forwardStack.length > 0}
            accentColor={accentColor}
            colorMode={colorMode}
            lastPlayedVideo={lastPlayedVideo}
            layout={layout}
            onBack={goBack}
            onClearSelection={clearSelection}
            onCreateFolder={requestCreateFolder}
            onDeleteSelected={() => requestDelete(selectedList)}
            onDownloadSelected={downloadSelected}
            onForward={goForward}
            onLayout={setLayout}
            onLastPlayedVideo={openLastPlayedVideo}
            onMobileMenu={() => setMobileSidebarOpen(true)}
            onAccentColor={setAccentColor}
            onColorMode={setColorMode}
            onSearchTerm={setSearchTerm}
            onSortDirection={setSortDirection}
            onSortKey={setSortKey}
            onUploadClick={() => fileInputRef.current?.click()}
            searchTerm={searchTerm}
            selectedCount={selectedItems.size}
            sortDirection={sortDirection}
            sortKey={sortKey}
          />

          <motion.section animate={{ opacity: 1, y: 0 }} className="space-y-4" initial={{ opacity: 0, y: 12 }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="accent-text text-sm font-semibold uppercase tracking-[0.18em]">Private drive</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {searchResults ? "Search results" : folder?.name || "Home"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>
            </div>

            <Breadcrumbs breadcrumbs={folder?.breadcrumbs || [{ name: "Home", path: "" }]} onNavigate={navigateTo} searchTerm={searchTerm} />

            <FileBrowser
              error={error}
              items={items}
              layout={layout}
              loading={loading}
              onDelete={requestDelete}
              onDownload={downloadItem}
              onOpen={openItem}
              onPreview={setPreviewItem}
              onRefresh={refresh}
              onRename={requestRename}
              onSelect={toggleSelect}
              searchTerm={searchTerm}
              selectedPaths={selectedPathSet}
            />
          </motion.section>
        </main>

        <DetailsPanel
          item={detailItem}
          onDownload={downloadItem}
          onPreview={setPreviewItem}
          onRename={requestRename}
          selectedCount={selectedItems.size}
        />
      </div>

      <PreviewModal item={previewItem} mediaItems={mediaItems} onClose={() => setPreviewItem(null)} onDownload={downloadItem} />
      <ConfirmDialog
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.onConfirm?.()}
      />
      <TextInputModal modal={textModal} onCancel={() => setTextModal(null)} onSubmit={handleTextModalSubmit} />
    </div>
  );
}
