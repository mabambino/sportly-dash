import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Raw breakpoint state.
 *
 * `undefined` means "not known yet" — the first render happens on the server
 * and again during hydration, before any media query can be read. Callers that
 * pick between two different layouts must wait for a real boolean, otherwise
 * they render the desktop branch for a frame and visibly snap to the mobile one
 * once the effect fires.
 */
export function useIsMobileState(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

/**
 * Convenience boolean. Treats "not known yet" as not-mobile, which is the right
 * default for progressive enhancement (showing a sidebar, say) but wrong when
 * you are choosing between two whole layouts — use `useIsMobileState` there.
 */
export function useIsMobile(): boolean {
  return !!useIsMobileState();
}
