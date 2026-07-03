import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DemoSeedButton } from "@/components/DemoSeedButton";
import { EmbedWidgetCard } from "@/components/EmbedWidgetCard";
import { SensitiveValue } from "@/components/SensitiveValue";
import { Users, CalendarCheck, DollarSign, TrendingUp } from "lucide-react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";
import { format, subDays, endOfDay, startOfMonth } from "date-fns";
import { useMemo } from "react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Syncletics" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { club, isStaff, profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    enabled: !!club,
    queryKey: ["dashboard", club?.id],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const [members, slots, monthPayments, attTotal, attPresent, ann] = await Promise.all([
        supabase.from("memberships").select("role, joined_at").eq("club_id", club!.id),
        supabase.from("time_slots").select("*").eq("club_id", club!.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        supabase.from("payments").select("amount_cents, status").eq("club_id", club!.id).gte("period_month", monthStart),
        supabase.from("attendance_records").select("id, time_slots!inner(club_id)", { count: "exact", head: true }).eq("time_slots.club_id", club!.id),
        supabase.from("attendance_records").select("id, time_slots!inner(club_id)", { count: "exact", head: true }).eq("time_slots.club_id", club!.id).eq("status", "present"),
        supabase.from("announcements").select("*").eq("club_id", club!.id).order("created_at", { ascending: false }).limit(3),
      ]);
      const firstError = members.error || slots.error || monthPayments.error || ann.error;
      if (firstError) throw firstError;
      return {
        members: members.data || [],
        slots: slots.data || [],
        monthPayments: monthPayments.data || [],
        attTotal: attTotal.count ?? 0,
        attPresent: attPresent.count ?? 0,
        ann: ann.data || [],
      };
    },
  });

  const members = data?.members || [];
  const students = members.filter((m) => m.role === "student");
  const attRate = data?.attTotal ? Math.round((data.attPresent / data.attTotal) * 100) : 0;
  const paidThisMonth = (data?.monthPayments || []).filter((p) => p.status === "paid");
  const revenueThisMonth = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0) / 100;

  // Real member growth: cumulative membership count per day, from joined_at.
  const growth = useMemo(() => {
    const days = 30;
    return Array.from({ length: days }, (_, i) => {
      const d = endOfDay(subDays(new Date(), days - 1 - i));
      return {
        day: format(d, "MMM d"),
        members: members.filter((m) => new Date(m.joined_at) <= d).length,
      };
    });
  }, [members]);

  if (error) {
    return <Card className="p-8 text-center text-sm text-destructive">Could not load the dashboard: {(error as Error).message}</Card>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
          <h1 className="font-display text-3xl font-semibold">{isStaff ? `${club?.name} Dashboard` : "Your home"}</h1>
        </div>
        {isStaff && !isLoading && students.length === 0 && <DemoSeedButton />}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-8 w-16" /><Skeleton className="mt-3 h-3 w-20" /></Card>
          ))}
        </div>
      ) : isStaff ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active members" value={members.length} icon={Users} sub={`${students.length} students`} />
            <StatCard label="Attendance rate" value={`${attRate}%`} icon={CalendarCheck} sub={`Across ${data?.attTotal ?? 0} records`} />
            <StatCard label="Upcoming sessions" value={data?.slots.length ?? 0} icon={TrendingUp} sub="Next up" />
            <StatCard label="Revenue this month" value={`$${revenueThisMonth.toFixed(0)}`} icon={DollarSign} sub={`${paidThisMonth.length} paid invoices`} sensitive />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <p className="text-sm font-medium">Member growth (last 30 days)</p>
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
                    <XAxis dataKey="day" stroke="currentColor" fontSize={12} minTickGap={24} />
                    <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
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
        <MemberHome data={data} />
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

function MemberHome({ data }: { data: any }) {
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
