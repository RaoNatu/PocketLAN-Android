import { useCallback, useState } from "react";

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, message, tone = "info", duration = 4200 }) => {
      const id = crypto.randomUUID();
      const toast = { id, title, message, tone };

      setToasts((current) => [toast, ...current].slice(0, 5));

      if (duration) {
        window.setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast]
  );

  return { toasts, pushToast, removeToast };
}

