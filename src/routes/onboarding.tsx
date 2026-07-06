import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trophy, Building2, Users, QrCode, HeartPulse } from "lucide-react";

const searchSchema = z.object({
  code: z.string().optional(),
  group: z.string().optional(),
});

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Get started — Syncletics" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, membership, loading, refresh, signOut, profile } = useAuth();
  const { code: qrCode, group: qrGroup } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
    if (!loading && membership) navigate({ to: "/app/dashboard" });
  }, [user, membership, loading, navigate]);

  // Role chosen at signup ("student" | "parent" | "club_owner"), if any.
  const signupRole = (user?.user_metadata?.signup_role as string | undefined) ?? undefined;

  // Create club
  const [clubName, setClubName] = useState("");
  const [sport, setSport] = useState("Soccer");

  // Join club — prefilled from a scanned QR code (?code=XXXXXX&group=<id>)
  const [code, setCode] = useState(qrCode?.toUpperCase() ?? "");
  const [joinRole, setJoinRole] = useState<"student" | "parent">(
    signupRole === "parent" ? "parent" : "student"
  );

  // Health questionnaire — shown when a kid (student) joins a club.
  const [healthHas, setHealthHas] = useState<"unknown" | "yes" | "no">("unknown");
  const [healthDetails, setHealthDetails] = useState("");
  const [healthLifestyle, setHealthLifestyle] = useState("");

  useEffect(() => {
    if (qrCode) setCode(qrCode.toUpperCase());
  }, [qrCode]);

  // Default to the correct tab: QR scans and student/parent signups land on "join".
  const defaultTab =
    qrCode || signupRole === "student" || signupRole === "parent" ? "join" : "create";

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data: club, error } = await supabase
      .from("clubs")
      .insert({ name: clubName, sport, owner_id: user.id, team_code: "" })
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
    const { data: joined, error } = await (supabase.rpc as any)("join_club_by_code", {
      _code: code,
      _role: joinRole,
      _group_id: qrGroup || null,
    });
    const club = Array.isArray(joined) ? joined[0] : joined;
    if (error || !club) { toast.error(error?.message || "Invalid team code"); setBusy(false); return; }
    if (joinRole === "parent") {
      await supabase.from("profiles").update({ is_parent: true }).eq("id", user.id);
    }
    // Attach the kid's health questionnaire to their profile (best-effort — the
    // join still succeeds even if the health_info column isn't present yet).
    if (joinRole === "student" && healthHas !== "unknown") {
      try {
        await supabase
          .from("profiles")
          .update({
            health_info: {
              has_condition: healthHas === "yes",
              details: healthDetails.trim(),
              lifestyle_impact: healthLifestyle.trim(),
              submitted_at: new Date().toISOString(),
            },
          } as any)
          .eq("id", user.id);
      } catch {
        /* ignore — optional data */
      }
    }
    toast.success(qrGroup ? `Joined ${club.name} and enrolled in your group!` : `Joined ${club.name}!`);
    await refresh();
    navigate({ to: "/app/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-hero text-primary-foreground"><Trophy className="h-4 w-4" /></div>
            <span className="font-display text-lg font-semibold">Syncletics</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold">Welcome{profile ? `, ${profile.display_name}` : ""} 👋</h1>
          <p className="mt-2 text-muted-foreground">Are you running a club, or joining one?</p>
        </div>
        <Card className="p-6 shadow-elegant">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create"><Building2 className="mr-2 h-4 w-4" /> I run a club</TabsTrigger>
              <TabsTrigger value="join"><Users className="mr-2 h-4 w-4" /> I'm joining one</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="mt-6">
              <form onSubmit={onCreate} className="space-y-4">
                <div><Label>Club name</Label><Input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="Eastside FC" required /></div>
                <div><Label>Sport</Label><Input value={sport} onChange={(e) => setSport(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Creating…" : "Create club"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="join" className="mt-6">
              <form onSubmit={onJoin} className="space-y-4">
                {qrCode && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span>
                      QR code scanned — team code prefilled{qrGroup ? "," : "."}
                      {qrGroup && " you'll be enrolled in the selected group."}
                    </span>
                  </div>
                )}
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
                {joinRole === "student" && (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Health questionnaire</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Has the child had a health problem, condition, or something in the past that affects
                      their current lifestyle or activity? This helps coaches keep them safe.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant={healthHas === "no" ? "default" : "outline"} onClick={() => setHealthHas("no")}>No</Button>
                      <Button type="button" size="sm" variant={healthHas === "yes" ? "default" : "outline"} onClick={() => setHealthHas("yes")}>Yes</Button>
                    </div>
                    {healthHas === "yes" && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">What was the problem or condition?</Label>
                          <Textarea value={healthDetails} onChange={(e) => setHealthDetails(e.target.value)} placeholder="e.g. asthma, a past injury, an allergy…" rows={2} />
                        </div>
                        <div>
                          <Label className="text-xs">How does it affect their lifestyle now?</Label>
                          <Textarea value={healthLifestyle} onChange={(e) => setHealthLifestyle(e.target.value)} placeholder="e.g. needs breaks, avoids certain activities, carries an inhaler…" rows={2} />
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">Optional — you can update this later in your profile.</p>
                  </div>
                )}
                {qrGroup && (
                  <Badge variant="secondary" className="font-normal">
                    Group enrollment via QR — group will be assigned automatically
                  </Badge>
                )}
                <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Joining…" : "Join club"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
