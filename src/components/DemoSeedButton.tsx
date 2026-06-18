import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoData } from "@/lib/seed.functions";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";

export function DemoSeedButton() {
  const { club } = useAuth();
  const [busy, setBusy] = useState(false);
  const seed = useServerFn(seedDemoData);
  const qc = useQueryClient();

  const run = async () => {
    if (!club) return;
    setBusy(true);
    try {
      const res = await seed({ data: { clubId: club.id } });
      toast.success(`Loaded ${res.students} students, ${res.trainers} trainers, ${res.sessions} sessions`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  };

  return (
    <Button onClick={run} disabled={busy} variant="outline" className="gap-2">
      <Sparkles className="h-4 w-4 text-primary" />
      {busy ? "Loading demo…" : "Load demo data"}
    </Button>
  );
}
