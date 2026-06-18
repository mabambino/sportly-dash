import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trophy, Building2, Users } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Get started — ClubHaus" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, membership, loading, refresh, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
    if (!loading && membership) navigate({ to: "/app/dashboard" });
  }, [user, membership, loading, navigate]);

  // Create club
  const [clubName, setClubName] = useState("");
  const [sport, setSport] = useState("Soccer");
  const [fee, setFee] = useState("50");

  // Join club
  const [code, setCode] = useState("");
  const [joinRole, setJoinRole] = useState<"student" | "parent">("student");

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data: club, error } = await supabase
      .from("clubs")
      .insert({ name: clubName, sport, owner_id: user.id, monthly_fee_cents: Math.round(parseFloat(fee) * 100), team_code: "" })
      .select().single();
    if (error || !club) { toast.error(error?.message || "Failed"); setBusy(false); return; }
    const { error: mErr } = await supabase.from("memberships").insert({ club_id: club.id, user_id: user.id, role: "club_owner" });
    if (mErr) { toast.error(mErr.message); setBusy(false); return; }
    toast.success(`Club created! Team code: ${club.team_code}`);
    await refresh();
    navigate({ to: "/app/dashboard" });
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data: club, error } = await supabase.from("clubs").select("*").eq("team_code", code.toUpperCase()).maybeSingle();
    if (error || !club) { toast.error("Invalid team code"); setBusy(false); return; }
    const { error: mErr } = await supabase.from("memberships").insert({ club_id: club.id, user_id: user.id, role: joinRole });
    if (mErr) { toast.error(mErr.message); setBusy(false); return; }
    if (joinRole === "parent") {
      await supabase.from("profiles").update({ is_parent: true }).eq("id", user.id);
    }
    toast.success(`Joined ${club.name}!`);
    await refresh();
    navigate({ to: "/app/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-hero text-primary-foreground"><Trophy className="h-4 w-4" /></div>
            <span className="font-display text-lg font-semibold">ClubHaus</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold">Welcome{profile ? `, ${profile.display_name}` : ""} 👋</h1>
          <p className="mt-2 text-muted-foreground">Are you running a club, or joining one?</p>
        </div>
        <Card className="p-6 shadow-elegant">
          <Tabs defaultValue="create">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create"><Building2 className="mr-2 h-4 w-4" /> I run a club</TabsTrigger>
              <TabsTrigger value="join"><Users className="mr-2 h-4 w-4" /> I'm joining one</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="mt-6">
              <form onSubmit={onCreate} className="space-y-4">
                <div><Label>Club name</Label><Input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="Eastside FC" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Sport</Label><Input value={sport} onChange={(e) => setSport(e.target.value)} /></div>
                  <div><Label>Monthly fee ($)</Label><Input type="number" min="0" step="1" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Creating…" : "Create club"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="join" className="mt-6">
              <form onSubmit={onJoin} className="space-y-4">
                <div>
                  <Label>Team code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD23" required className="font-mono uppercase tracking-widest" maxLength={6} />
                  <p className="mt-1 text-xs text-muted-foreground">Ask your club for the 6-character code.</p>
                </div>
                <div>
                  <Label>I am a…</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant={joinRole === "student" ? "default" : "outline"} onClick={() => setJoinRole("student")}>Student</Button>
                    <Button type="button" variant={joinRole === "parent" ? "default" : "outline"} onClick={() => setJoinRole("parent")}>Parent</Button>
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Joining…" : "Join club"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
