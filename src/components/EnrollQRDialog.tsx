import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  clubName: string;
  teamCode: string;
};

function joinUrl(code: string, groupId?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/onboarding", origin || "https://app.local");
  url.searchParams.set("code", code);
  if (groupId) url.searchParams.set("group", groupId);
  return url.toString();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
      Copy link
    </Button>
  );
}

function QRPanel({ title, subtitle, code, url, accent }: { title: string; subtitle?: string; code?: string; url: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6">
      <div className="text-center">
        <p className="font-display text-lg font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="rounded-lg bg-white p-3 shadow-sm">
        <QRCodeSVG value={url} size={200} fgColor={accent || "#0f172a"} bgColor="#ffffff" level="M" includeMargin={false} />
      </div>
      {code && <Badge variant="secondary" className="font-mono text-sm tracking-wider">{code}</Badge>}
      <p className="break-all text-center text-[11px] text-muted-foreground">{url}</p>
      <CopyButton value={url} />
    </div>
  );
}

export function EnrollQRDialog({ open, onOpenChange, clubId, clubName, teamCode }: Props) {
  const { data: groups } = useQuery({
    enabled: open && !!clubId,
    queryKey: ["enroll-groups", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_groups")
        .select("id, name, color, schedule_time")
        .eq("club_id", clubId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enroll with a QR code</DialogTitle>
          <DialogDescription>
            Share these codes with students and parents. Scanning opens the join flow with the team and group preselected.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="team" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="groups"><Layers className="mr-2 h-3.5 w-3.5" /> Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-4">
            <QRPanel
              title={clubName}
              subtitle="Scan to join the club"
              code={teamCode}
              url={joinUrl(teamCode)}
            />
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            {!groups || groups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No course groups yet. Create one in Groups to generate a QR.
              </div>
            ) : (
              <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
                {groups.map((g) => (
                  <QRPanel
                    key={g.id}
                    title={g.name}
                    subtitle={g.schedule_time ? `Sessions at ${g.schedule_time}` : "Group enrollment"}
                    url={joinUrl(teamCode, g.id)}
                    accent={g.color || undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
