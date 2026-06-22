import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function EmbedWidgetCard({ clubId }: { clubId: string }) {
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(520);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `${origin}/embed/${clubId}`;
  const snippet = useMemo(
    () =>
      `<iframe src="${src}" width="100%" height="${height}" style="border:0;border-radius:16px;overflow:hidden" loading="lazy" title="Club widget"></iframe>`,
    [src, height]
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
              <p className="text-xs text-muted-foreground">Paste this iframe on your club's website.</p>
            </div>
          </div>
        </div>
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Preview <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs">
        <label className="text-muted-foreground">Height</label>
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

      <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground">
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
