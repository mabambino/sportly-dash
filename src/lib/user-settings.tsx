import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight per-device user preferences that don't need a database round-trip:
 *  - "Privacy mode": an eye toggle that masks every sensitive value on the
 *    dashboard at once (see SensitiveValue + the dashboard stat cards).
 *  - A locally-stored profile picture override, so a member can set an avatar
 *    even before the backend avatar_url column is populated.
 *
 * Both are stored in localStorage and broadcast changes so any mounted
 * component (sidebar, top bar, dashboard) updates immediately.
 */

const PRIVACY_KEY = "syncletics-privacy-hide-all";

interface PrivacyCtx {
  hideAll: boolean;
  setHideAll: (value: boolean) => void;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyCtx | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAll, setHideAllState] = useState(false);

  useEffect(() => {
    try {
      setHideAllState(localStorage.getItem(PRIVACY_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setHideAll = useCallback((value: boolean) => {
    setHideAllState(value);
    try {
      localStorage.setItem(PRIVACY_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setHideAllState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PRIVACY_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hideAll, setHideAll, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

/**
 * Safe even outside the provider: returns a no-op default so components like
 * SensitiveValue never crash if rendered in isolation.
 */
export function usePrivacy(): PrivacyCtx {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    return { hideAll: false, setHideAll: () => {}, toggle: () => {} };
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Local profile-picture override                                      */
/* ------------------------------------------------------------------ */

const AVATAR_EVENT = "syncletics-avatar-changed";

function avatarKey(userId: string) {
  return `syncletics-avatar:${userId}`;
}

export function getLocalAvatar(userId?: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(avatarKey(userId));
  } catch {
    return null;
  }
}

export function setLocalAvatar(userId: string, dataUrl: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (dataUrl) localStorage.setItem(avatarKey(userId), dataUrl);
    else localStorage.removeItem(avatarKey(userId));
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the picture to show for a user: a locally-set override wins,
 * otherwise the backend avatar_url, otherwise null (fall back to initials).
 */
export function useAvatar(
  userId?: string | null,
  fallbackUrl?: string | null,
): string | null {
  const [url, setUrl] = useState<string | null>(
    () => getLocalAvatar(userId) ?? fallbackUrl ?? null,
  );

  useEffect(() => {
    const read = () => setUrl(getLocalAvatar(userId) ?? fallbackUrl ?? null);
    read();
    window.addEventListener(AVATAR_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(AVATAR_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [userId, fallbackUrl]);

  return url;
}
