import { useCallback, useRef, useState } from "react";
import { uploadFiles } from "../utils/api";

export function useUpload({ currentPath, onComplete }) {
  const [uploadState, setUploadState] = useState(null);
  const startedAt = useRef(0);

  const upload = useCallback(
    async (files, overwrite = false) => {
      startedAt.current = Date.now();
      setUploadState({
        active: true,
        fileCount: files.length,
        loaded: 0,
        total: files.reduce((sum, file) => sum + file.size, 0),
        percent: 0,
        speed: 0
      });

      const result = await uploadFiles({
        files,
        path: currentPath,
        overwrite,
        onProgress: (event) => {
          const elapsedSeconds = Math.max((Date.now() - startedAt.current) / 1000, 0.1);
          const loaded = event.loaded || 0;
          const total = event.total || files.reduce((sum, file) => sum + file.size, 0);

          setUploadState({
            active: true,
            fileCount: files.length,
            loaded,
            total,
            percent: total ? Math.round((loaded / total) * 100) : 0,
            speed: loaded / elapsedSeconds
          });
        }
      });

      setUploadState((current) =>
        current
          ? {
              ...current,
              active: false,
              percent: 100
            }
          : current
      );

      onComplete?.(result);
      window.setTimeout(() => setUploadState(null), 1600);
      return result;
    },
    [currentPath, onComplete]
  );

  return { uploadState, upload };
}

