import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { exportKey, generateKey, importKey } from "@phoebe/crypto";

type KeyContextValue = {
  key: CryptoKey | null;
  keyExported: string;
  ready: boolean;
  error: string | null;
  importSessionKey: (base64Key: string) => Promise<void>;
  regenerateKey: () => Promise<void>;
};

const KeyContext = createContext<KeyContextValue | null>(null);

const STORAGE_KEY = "phoebe.sessionEncryptionKey";

export function KeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [keyExported, setKeyExported] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyKey = async (nextKey: CryptoKey, persist: boolean) => {
    const exported = await exportKey(nextKey);
    setKey(nextKey);
    setKeyExported(exported);
    setError(null);
    if (persist) {
      sessionStorage.setItem(STORAGE_KEY, exported);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const existing = sessionStorage.getItem(STORAGE_KEY);
        if (existing) {
          const imported = await importKey(existing);
          if (!cancelled) {
            await applyKey(imported, false);
          }
        } else {
          const generated = await generateKey();
          if (!cancelled) {
            await applyKey(generated, true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize encryption key");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const importSessionKey = async (base64Key: string) => {
    const imported = await importKey(base64Key.trim());
    await applyKey(imported, true);
  };

  const regenerateKey = async () => {
    const generated = await generateKey();
    await applyKey(generated, true);
  };

  const value = useMemo(
    () => ({
      key,
      keyExported,
      ready,
      error,
      importSessionKey,
      regenerateKey,
    }),
    [key, keyExported, ready, error]
  );

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useEncryptionKey() {
  const ctx = useContext(KeyContext);
  if (!ctx) {
    throw new Error("useEncryptionKey must be used within KeyProvider");
  }
  return ctx;
}
