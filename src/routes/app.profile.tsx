import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "My profile — Syncletics" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, club, membership, isStaff } = useAuth();

  // Athlete stats (attendance, badges, tracked metrics) only make sense for the
  // people who are actually coached — students and parents. Staff (owner /
  // trainer) get a club-management profile instead, so don't run this query.
  const { data } = useQuery({
    enabled: !!user && !!club && !isStaff,
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const [stats, att, badges] = await Promise.all([
        supabase.from("student_stats").select("*").eq("student_id", user!.id).order("recorded_at"),
        supabase.from("attendance_records").select("*, time_slots!inner(starts_at, title, club_id)").eq("student_id", user!.id).eq("time_slots.club_id", club!.id).order("marked_at", { ascending: false }),
        supabase.from("badges").select("*").eq("user_id", user!.id),
      ]);
      return { stats: stats.data || [], att: att.data || [], badges: badges.data || [] };
    },
  });

  const metrics = Array.from(new Set((data?.stats || []).map((s) => s.metric)));
  const attRate = data?.att.length ? Math.round((data.att.filter((a) => a.status === "present").length / data.att.length) * 100) : 0;
  const roleLabel = (membership?.role ?? "member").replace(/_/g, " ");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-hero text-2xl font-semibold text-primary-foreground">
          {profile?.display_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold">{profile?.display_name}</h1>
            <Badge variant="secondary" className="capitalize">{roleLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      {isStaff ? <StaffProfile club={club} membership={membership} /> : (
      <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Sessions attended</p><p className="mt-2 font-display text-3xl font-semibold">{data?.att.filter((a) => a.status === "present").length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Attendance rate</p><p className="mt-2 font-display text-3xl font-semibold">{attRate}%</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Badges earned</p><p className="mt-2 font-display text-3xl font-semibold">{data?.badges.length ?? 0}</p></Card>
      </div>

      {data && data.badges.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-medium">Achievements</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.badges.map((b) => (
              <Badge key={b.id} variant="secondary" className="px-3 py-1.5 text-sm">
                <span className="mr-1">{b.icon}</span> {b.label}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((m) => {
          const series = (data!.stats).filter((s) => s.metric === m).map((s) => ({
            date: format(new Date(s.recorded_at), "MMM d"), value: Number(s.value),
          }));
          return (
            <Card key={m} className="p-5">
              <p className="text-sm font-medium">{m}</p>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke="oklch(0.52 0.21 277)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })}
        {metrics.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">No stats recorded yet. Your trainer will start tracking soon.</Card>}
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium">Recent attendance</p>
        <div className="mt-3 divide-y divide-border">
          {(data?.att || []).slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{a.time_slots?.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(a.time_slots!.starts_at), "MMM d, yyyy")}</p>
              </div>
              <Badge variant={a.status === "present" ? "default" : "destructive"} className="capitalize">{a.status}</Badge>
            </div>
          ))}
          {(data?.att.length ?? 0) === 0 && <p className="py-3 text-sm text-muted-foreground">No attendance records yet.</p>}
        </div>
      </Card>
      </>
      )}
    </div>
  );
}

function StaffProfile({ club, membership }: { club: { name?: string; sport?: string; team_code?: string } | null; membership: { role?: string; joined_at?: string } | null }) {
  const joined = membership?.joined_at ? format(new Date(membership.joined_at), "MMM d, yyyy") : null;
  const links = [
    { to: "/app/settings", label: "Club settings" },
    { to: "/app/members", label: "Members" },
    { to: "/app/schedule", label: "Schedule" },
    { to: "/app/announcements", label: "Announcements" },
    { to: "/app/revenue", label: "Revenue" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Club</p><p className="mt-2 truncate font-display text-2xl font-semibold">{club?.name ?? "—"}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Sport</p><p className="mt-2 truncate font-display text-2xl font-semibold">{club?.sport ?? "—"}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Team code</p><p className="mt-2 font-mono text-2xl font-semibold">{club?.team_code ?? "—"}</p></Card>
      </div>
      <Card className="p-5">
        <p className="text-sm font-medium">Manage your club</p>
        <p className="mt-1 text-sm text-muted-foreground">Jump to the areas you run day to day.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
              {l.label}
            </Link>
          ))}
        </div>
        {joined && <p className="mt-4 text-xs text-muted-foreground">On this team since {joined}.</p>}
      </Card>
    </div>
  );
}
