import { useCallback, useEffect, useState } from "react";
import { getAuthStatus, getStoredPin, setStoredPin, verifyPin } from "../utils/api";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const status = await getAuthStatus();
        const storedPin = getStoredPin();

        if (cancelled) return;

        setPinEnabled(status.pinEnabled);
        setUnlocked(!status.pinEnabled || Boolean(storedPin));
      } catch {
        if (!cancelled) {
          setError("Could not reach the local drive backend.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async (pin) => {
    setError("");
    await verifyPin(pin);
    setStoredPin(pin);
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    setStoredPin("");
    setUnlocked(!pinEnabled);
  }, [pinEnabled]);

  return { loading, pinEnabled, unlocked, error, unlock, lock };
}

