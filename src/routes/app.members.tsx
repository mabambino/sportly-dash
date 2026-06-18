import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/members")({
  head: () => ({ meta: [{ title: "Members — ClubHaus" }] }),
  component: MembersPage,
});

function MembersPage() {
  const { club, isStaff } = useAuth();
  const [q, setQ] = useState("");

  const { data } = useQuery({
    enabled: !!club,
    queryKey: ["members", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id);
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const members = (data || []).filter((m) =>
    !q || m.profile?.display_name?.toLowerCase().includes(q.toLowerCase()) || m.profile?.email?.toLowerCase().includes(q.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [["Name", "Email", "Role", "Joined"], ...members.map((m) => [m.profile?.display_name || "", m.profile?.email || "", m.role, m.joined_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "members.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">{members.length} {members.length === 1 ? "member" : "members"} in {club?.name}</p>
        </div>
        {isStaff && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {members.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members yet. Share your team code <span className="font-mono font-semibold">{club?.team_code}</span> to invite them, or load demo data.</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                  {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.profile?.display_name || "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
              </div>
              <Badge variant={m.role === "club_owner" ? "default" : "secondary"} className="capitalize">{m.role.replace("_", " ")}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
