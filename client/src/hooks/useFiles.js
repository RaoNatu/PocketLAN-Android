import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage, listFiles, searchFiles } from "../utils/api";
import { sortItems } from "../utils/format";

export function useFiles({ currentPath, searchTerm, typeFilter, sortKey, sortDirection }) {
  const [folder, setFolder] = useState(null);
  const [storage, setStorage] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageLoading, setStorageLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const trimmedSearch = searchTerm.trim();

      if (trimmedSearch.length >= 2) {
        const data = await searchFiles(trimmedSearch);
        setSearchResults(data);
      } else {
        const data = await listFiles(currentPath);
        setFolder(data);
        setSearchResults(null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Could not load files.");
    } finally {
      setLoading(false);
    }
  }, [currentPath, searchTerm]);

  const loadStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      setStorage(await getStorage());
    } catch {
      setStorage(null);
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  const rawItems = searchResults ? searchResults.results : folder?.items || [];

  const items = useMemo(() => {
    const filtered =
      typeFilter === "all"
        ? rawItems
        : rawItems.filter((item) => item.category === typeFilter || (typeFilter === "document" && ["document", "spreadsheet", "presentation"].includes(item.category)));

    return sortItems(filtered, sortKey, sortDirection);
  }, [rawItems, sortDirection, sortKey, typeFilter]);

  return {
    folder,
    storage,
    storageLoading,
    searchResults,
    items,
    loading,
    error,
    refresh: loadFiles,
    refreshStorage: loadStorage
  };
}

