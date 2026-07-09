import { Capacitor } from "@capacitor/core";

/**
 * Native niceties for the iOS/Android shell. Every call is a no-op on the
 * web, and each plugin is loaded dynamically so the web bundle stays lean.
 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  // Status bar: match the app theme and react to dark-mode toggles.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const apply = () => {
      const dark = document.documentElement.classList.contains("dark");
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    };
    apply();
    new MutationObserver(apply).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  } catch {
    /* plugin not installed */
  }

  // Keyboard: hide the grey accessory bar above the iOS keyboard.
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    /* plugin not installed */
  }
}

/** Light haptic tick for tab switches and toggles. */
export async function hapticTick() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* plugin not installed */
  }
}
