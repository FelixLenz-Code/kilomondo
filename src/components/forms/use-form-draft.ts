"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "carlog:draft:";

/**
 * Persist an in-progress form to localStorage so the data survives leaving the
 * page (e.g. walking inside to pay at the pump) or the PWA being killed.
 *
 * Pass `key = null` to disable (e.g. when editing an existing entry). The saved
 * draft is read once on mount and returned as `restored`; the form applies it.
 */
export function useFormDraft<T>(key: string | null) {
  const storageKey = key ? PREFIX + key : null;
  const [restored, setRestored] = useState<T | null>(null);
  const loaded = useRef(false);

  // Read once after mount — localStorage isn't available during SSR.
  useEffect(() => {
    if (!storageKey || loaded.current) return;
    loaded.current = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setRestored(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt drafts */
    }
  }, [storageKey]);

  const save = useCallback(
    (value: T) => {
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* quota / private mode — ignore */
      }
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    if (!storageKey) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setRestored(null);
  }, [storageKey]);

  return { restored, save, clear };
}
