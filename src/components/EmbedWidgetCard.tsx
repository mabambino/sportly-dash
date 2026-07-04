import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function EmbedWidgetCard({ clubId }: { clubId: string }) {
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(520);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#0B2626");
  const [showStats, setShowStats] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [rounded, setRounded] = useState(true);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (theme === "dark") params.set("theme", "dark");
    if (accent !== "#0B2626") params.set("accent", accent);
    if (!showStats) params.set("stats", "0");
    if (!showSchedule) params.set("schedule", "0");
    if (!showForm) params.set("form", "0");
    const qs = params.toString();
    return `${origin}/embed/${clubId}${qs ? `?${qs}` : ""}`;
  }, [origin, clubId, theme, accent, showStats, showSchedule, showForm]);

  const snippet = useMemo(
    () =>
      `<iframe src="${src}" width="100%" height="${height}" style="border:0;${rounded ? "border-radius:16px;" : ""}overflow:hidden" loading="lazy" title="Club widget"></iframe>`,
    [src, height, rounded]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Code2 className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-medium">Website embed widget</p>
              <p className="text-xs text-muted-foreground">Customize and paste this iframe on your club's website.</p>
            </div>
          </div>
        </div>
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Preview <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Height</Label>
          <input
            type="number"
            value={height}
            min={300}
            max={1200}
            step={20}
            onChange={(e) => setHeight(Number(e.target.value) || 520)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1"
          />
          <span className="text-muted-foreground">px</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Theme</Label>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`px-3 py-1 ${theme === "light" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`px-3 py-1 ${theme === "dark" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              Dark
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Accent</Label>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
            aria-label="Accent color"
          />
          <span className="font-mono text-muted-foreground">{accent}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Rounded corners</Label>
          <Switch checked={rounded} onCheckedChange={setRounded} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Show stats</Label>
          <Switch checked={showStats} onCheckedChange={setShowStats} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Show schedule</Label>
          <Switch checked={showSchedule} onCheckedChange={setShowSchedule} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Show signup form</Label>
          <Switch checked={showForm} onCheckedChange={setShowForm} />
        </div>
      </div>

      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground">
        <code>{snippet}</code>
      </pre>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={copy} variant={copied ? "secondary" : "default"}>
          {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy embed code"}
        </Button>
      </div>
    </Card>
  );
}
