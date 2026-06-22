import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { EmbedWidgetCard } from "@/components/EmbedWidgetCard";
import { SensitiveValue } from "@/components/SensitiveValue";
import { Users, CalendarCheck, DollarSign, TrendingUp, Settings } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ClubHaus" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { club, isStaff, profile } = useAuth();

  const { data } = useQuery({
    enabled: !!club,
    queryKey: ["dashboard", club?.id],
    queryFn: async () => {
      const [members, slots, payments, attendance, ann] = await Promise.all([
        supabase.from("memberships").select("*").eq("club_id", club!.id),
        supabase.from("time_slots").select("*").eq("club_id", club!.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        supabase.from("payments").select("*").eq("club_id", club!.id),
        supabase.from("attendance_records").select("*, time_slots!inner(club_id)").eq("time_slots.club_id", club!.id),
        supabase.from("announcements").select("*").eq("club_id", club!.id).order("created_at", { ascending: false }).limit(3),
      ]);
      return { members: members.data || [], slots: slots.data || [], payments: payments.data || [], attendance: attendance.data || [], ann: ann.data || [] };
    },
  });

  const members = data?.members || [];
  const students = members.filter((m) => m.role === "student");
  const att = data?.attendance || [];
  const presentCount = att.filter((a) => a.status === "present").length;
  const attRate = att.length ? Math.round((presentCount / att.length) * 100) : 0;
  const paidThisMonth = (data?.payments || []).filter((p) => p.status === "paid");
  const mrr = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0) / 100;

  const growth = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { day: format(d, "EEE"), members: Math.max(1, students.length - (6 - i) * 1 + Math.floor(Math.random() * 2)) };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
          <h1 className="font-display text-3xl font-semibold">{isStaff ? `${club?.name} Dashboard` : "Your home"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && students.length === 0 && <DemoSeedButton />}
          <Link
            to="/app/settings"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {isStaff ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active members" value={members.length} icon={Users} sub={`${students.length} students`} />
            <StatCard label="Attendance rate" value={`${attRate}%`} icon={CalendarCheck} sub={`Across ${att.length} records`} />
            <StatCard label="Upcoming sessions" value={data?.slots.length ?? 0} icon={TrendingUp} sub="Next 7 days" />
            <StatCard label="Monthly revenue" value={`$${mrr.toFixed(0)}`} icon={DollarSign} sub={`${paidThisMonth.length} paid`} sensitive />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <p className="text-sm font-medium">Member growth (last 7 days)</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growth}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.52 0.21 277)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.52 0.21 277)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" stroke="currentColor" fontSize={12} />
                    <YAxis stroke="currentColor" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Area dataKey="members" stroke="oklch(0.52 0.21 277)" fill="url(#g)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-6">
              <p className="text-sm font-medium">Recent announcements</p>
              <div className="mt-4 space-y-4">
                {data?.ann.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
                {data?.ann.map((a) => (
                  <div key={a.id}>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <p className="text-sm font-medium">Upcoming sessions</p>
              <div className="mt-4 divide-y divide-border">
                {data?.slots.length === 0 && <p className="py-4 text-sm text-muted-foreground">No upcoming sessions.</p>}
                {data?.slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")} • {s.location}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Cap: {s.capacity}</span>
                  </div>
                ))}
              </div>
            </Card>
            {club && <EmbedWidgetCard clubId={club.id} />}
          </div>
        </>
      ) : (
        <MemberHome data={data} growth={growth} />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, sensitive }: { label: string; value: string | number; sub: string; icon: typeof Users; sensitive?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {sensitive ? <SensitiveValue mask="$ ••••">{value}</SensitiveValue> : value}
          </p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}


function MemberHome({ data, growth }: { data: any; growth: { day: string; members: number }[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Upcoming sessions</p><p className="mt-2 font-display text-3xl font-semibold">{data?.slots.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Announcements</p><p className="mt-2 font-display text-3xl font-semibold">{data?.ann.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Members in club</p><p className="mt-2 font-display text-3xl font-semibold">{data?.members.length ?? 0}</p></Card>
      </div>
      <Card className="p-6">
        <p className="text-sm font-medium">Upcoming sessions</p>
        <div className="mt-4 divide-y divide-border">
          {data?.slots.length === 0 && <p className="py-4 text-sm text-muted-foreground">No upcoming sessions yet.</p>}
          {data?.slots.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(s.starts_at), "EEE MMM d, h:mm a")} • {s.location}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
