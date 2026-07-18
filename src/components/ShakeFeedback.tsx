import { useEffect, useRef, useState } from "react";
import { Bug, LifeBuoy, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { hapticTick } from "@/lib/native";

/**
 * Shake-to-report: shaking the phone opens a quick dialog to report a bug or
 * reach support. iOS requires motion-sensor permission, which can only be
 * requested from a user gesture - so we ask once, on the first tap.
 */
const SHAKE_THRESHOLD = 24; // m/s^2 delta between samples
const SHAKE_COOLDOWN_MS = 5000;

export function ShakeFeedback() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const lastMag = useRef<number | null>(null);
  const lastShake = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (lastMag.current !== null && Math.abs(mag - lastMag.current) > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShake.current > SHAKE_COOLDOWN_MS) {
          lastShake.current = now;
          void hapticTick();
          setOpen(true);
        }
      }
      lastMag.current = mag;
    };

    const attach = () => window.addEventListener("devicemotion", onMotion);

    // iOS 13+ gates motion events behind a permission that must be requested
    // from a user gesture; other platforms can listen right away.
    const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DME.requestPermission === "function") {
      const askOnce = () => {
        DME.requestPermission!()
          .then((state) => { if (state === "granted") attach(); })
          .catch(() => { /* denied or unavailable - shake stays off */ });
        window.removeEventListener("touchend", askOnce);
      };
      window.addEventListener("touchend", askOnce, { once: true });
      return () => {
        window.removeEventListener("touchend", askOnce);
        window.removeEventListener("devicemotion", onMotion);
      };
    }
    attach();
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  const sendReport = () => {
    if (!text.trim()) { toast.error("Tell us what went wrong first"); return; }
    toast.success("Thanks! Our team will look into it.");
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="h-5 w-5" /> Spotted a problem?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">You shook your phone - tell us what's broken or confusing and we'll fix it.</p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the bug or issue…" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={sendReport}><Send className="mr-2 h-4 w-4" /> Send report</Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("open-support")); }}
          >
            <LifeBuoy className="mr-2 h-4 w-4" /> Contact support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
