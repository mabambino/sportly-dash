import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { addMember } from "@/lib/members.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";
import { Download, Search, UserPlus, QrCode, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/members")({
  // Accept an optional ?q= so the global search can deep-link a member lookup.
  // Returning an object with the key omitted (rather than q: undefined) keeps the
  // param truly optional, so existing <Link to="/app/members"> calls still compile.
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q ? { q: search.q } : {},
  head: () => ({ meta: [{ title: "Members — Syncletics" }] }),
  component: MembersPage,
});

function MembersPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");

  // Keep the search box in sync when navigated here with a new ?q=.
  useEffect(() => {
    if (initialQ !== undefined) setQ(initialQ);
  }, [initialQ]);
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const { data, isLoading } = useQuery({
    enabled: !!club,
    queryKey: ["members", club?.id],
    queryFn: async () => {
      const { data: mems, error } = await supabase.from("memberships").select("*").eq("club_id", club!.id).order("joined_at", { ascending: false });
      if (error) throw error;
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const { data: groups } = useQuery({
    enabled: !!club,
    queryKey: ["groups", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("course_groups").select("*").eq("club_id", club!.id).order("name");
      return data || [];
    },
  });

  const assignGroup = async (membershipId: string, newGroupId: string | null) => {
    const { error } = await supabase
      .from("memberships")
      .update({ group_id: newGroupId || null })
      .eq("id", membershipId);
    if (error) { toast.error(error.message); return; }
    if (newGroupId && groups) {
      const group = groups.find((g: any) => g.id === newGroupId);
      toast.success(group ? `Assigned to "${group.name}"` : "Group assigned");
    } else {
      toast.success("Group removed");
    }
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["group-memberships"] });
  };

  const members = (data || []).filter((m) =>
    !q || m.profile?.display_name?.toLowerCase().includes(q.toLowerCase()) || m.profile?.email?.toLowerCase().includes(q.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [["Name", "Email", "Role", "Group", "Joined"], ...members.map((m) => {
      const group = groups?.find((g: any) => g.id === m.group_id);
      return [m.profile?.display_name || "", m.profile?.email || "", m.role, group?.name || "", m.joined_at];
    })];
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
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
            <Button className="bg-gradient-hero" onClick={() => setAddOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Add member</Button>
          </div>
        )}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {isLoading && <p className="p-8 text-center text-sm text-muted-foreground">Loading members…</p>}
          {!isLoading && members.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members yet. Share your team code <span className="font-mono font-semibold">{club?.team_code}</span> or use "Add member".</p>}
          {members.map((m) => {
            const group = groups?.find((g: any) => g.id === m.group_id);
            return (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                    {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.profile?.display_name || "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {group && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.name}
                    </span>
                  )}
                  <Badge variant={m.role === "club_owner" ? "default" : "secondary"} className="capitalize">{m.role.replace("_", " ")}</Badge>
                  {isStaff && groups && groups.length > 0 && (
                    <Select
                      value={m.group_id || "none"}
                      onValueChange={(val) => assignGroup(m.id, val === "none" ? null : val)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Assign group…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No group</SelectItem>
                        {groups.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: g.color }} />
                              {g.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {club && (
        <>
          <AddMemberDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            clubId={club.id}
            groups={groups || []}
            onShowQr={() => { setAddOpen(false); setQrOpen(true); }}
            onDone={() => qc.invalidateQueries({ queryKey: ["members"] })}
          />
          <EnrollQRDialog
            open={qrOpen}
            onOpenChange={setQrOpen}
            clubId={club.id}
            clubName={club.name}
            teamCode={club.team_code}
          />
        </>
      )}
    </div>
  );
}

function AddMemberDialog({ open, onOpenChange, clubId, groups, onShowQr, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clubId: string;
  groups: any[];
  onShowQr: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "trainer" | "parent">("student");
  const [groupId, setGroupId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ existingAccount: boolean; tempPassword: string | null } | null>(null);

  const reset = () => { setName(""); setEmail(""); setRole("student"); setGroupId("none"); setResult(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await addMember({
        data: { clubId, email, displayName: name, role, groupId: groupId === "none" ? null : groupId },
      });
      setResult({ existingAccount: res.existingAccount, tempPassword: res.tempPassword });
      toast.success(res.existingAccount ? "Existing account enrolled in the club" : "Account created and enrolled");
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Could not add the member");
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = () => {
    if (result?.tempPassword) {
      navigator.clipboard.writeText(result.tempPassword);
      toast.success("Temporary password copied");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-4">
            {result.tempPassword ? (
              <>
                <p className="text-sm text-muted-foreground">
                  A new account was created for <span className="font-medium text-foreground">{email}</span>.
                  Share this temporary password with them — it is shown only once. They should change it after logging in.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm">{result.tempPassword}</code>
                  <Button size="icon" variant="outline" onClick={copyPassword}><Copy className="h-4 w-4" /></Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email}</span> already had an account, so they were enrolled directly. They can log in with their existing password.
              </p>
            )}
            <Button className="w-full" onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jamie Novak" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jamie@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course group</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">
              {busy ? "Adding…" : "Add member"}
            </Button>
            <button type="button" onClick={onShowQr} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <QrCode className="h-3.5 w-3.5" /> Or let them self-enroll with the team QR code
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
