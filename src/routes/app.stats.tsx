import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { useMemo, useState } from "react";
import { format, startOfWeek, subWeeks, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { Plus, Flame, Users, CalendarCheck, Activity } from "lucide-react";

export const Route = createFileRoute("/app/stats")({
  head: () => ({ meta: [{ title: "Stats — Syncletics" }] }),
  component: StatsPage,
});

type AttRecord = {
  id: string;
  student_id: string;
  status: string;
  time_slots: { club_id: string; starts_at: string } | null;
};

function StatsPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [open, setOpen] = useState(false);

  const { data: students } = useQuery({
    enabled: !!club && isStaff,
    queryKey: ["stu-stats", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id).eq("role", "student");
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return profs || [];
    },
  });

  const { data: attendance } = useQuery({
    enabled: !!club && isStaff,
    queryKey: ["att-stats", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("id, student_id, status, time_slots!inner(club_id, starts_at)")
        .eq("time_slots.club_id", club!.id);
      return (data as unknown as AttRecord[]) || [];
    },
  });

  const { data: monthSessions } = useQuery({
    enabled: !!club && isStaff,
    queryKey: ["month-sessions", club?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("time_slots")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club!.id)
        .gte("starts_at", startOfMonth(new Date()).toISOString());
      return count ?? 0;
    },
  });

  const { data: stats } = useQuery({
    enabled: !!selectedStudent,
    queryKey: ["stats", selectedStudent],
    queryFn: async () => {
      const { data } = await supabase.from("student_stats").select("*").eq("student_id", selectedStudent).order("recorded_at");
      return data || [];
    },
  });

  // ── Derived club-wide attendance analytics ──────────────────
  const { weeklyTrend, leaderboard, overallRate } = useMemo(() => {
    const records = attendance || [];
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const overallRate = total ? Math.round((present / total) * 100) : 0;

    // Weekly attendance % for the last 8 weeks
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(new Date(), 7 - i), { weekStartsOn: 1 });
      const weekEnd = startOfWeek(subWeeks(new Date(), 6 - i), { weekStartsOn: 1 });
      const inWeek = records.filter((r) => {
        const d = r.time_slots ? new Date(r.time_slots.starts_at) : null;
        return d && d >= weekStart && d < weekEnd;
      });
      const p = inWeek.filter((r) => r.status === "present").length;
      return {
        week: format(weekStart, "MMM d"),
        rate: inWeek.length ? Math.round((p / inWeek.length) * 100) : 0,
        records: inWeek.length,
      };
    });

    // Per-student attendance % and current streak (consecutive most
    // recent sessions marked present).
    const byStudent = new Map<string, AttRecord[]>();
    for (const r of records) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
      byStudent.get(r.student_id)!.push(r);
    }
    const leaderboard = Array.from(byStudent.entries()).map(([studentId, recs]) => {
      const sorted = [...recs].sort((a, b) =>
        new Date(b.time_slots?.starts_at ?? 0).getTime() - new Date(a.time_slots?.starts_at ?? 0).getTime()
      );
      let streak = 0;
      for (const r of sorted) {
        if (r.status === "present") streak++;
        else break;
      }
      const p = recs.filter((r) => r.status === "present").length;
      return { studentId, rate: recs.length ? Math.round((p / recs.length) * 100) : 0, streak, sessions: recs.length };
    }).sort((a, b) => b.rate - a.rate || b.streak - a.streak).slice(0, 5);

    return { weeklyTrend, leaderboard, overallRate };
  }, [attendance]);

  if (!isStaff) return <Card className="p-8 text-center text-muted-foreground">Stats are managed by trainers.</Card>;

  const metrics = Array.from(new Set((stats || []).map((s) => s.metric)));
  const nameOf = (id: string) => students?.find((s) => s.id === id)?.display_name ?? "Unknown";
  const selectedBoard = leaderboard.find((l) => l.studentId === selectedStudent);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Stats</h1>
          <p className="text-sm text-muted-foreground">Club attendance analytics and per-athlete performance.</p>
        </div>
        {selectedStudent && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Record stat</Button></DialogTrigger>
            <AddStatDialog studentId={selectedStudent} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["stats"] }); }} />
          </Dialog>
        )}
      </div>

      {/* Club overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard icon={Users} label="Athletes" value={students?.length ?? 0} />
        <OverviewCard icon={CalendarCheck} label="Attendance rate" value={`${overallRate}%`} />
        <OverviewCard icon={Activity} label="Sessions this month" value={monthSessions ?? 0} />
        <OverviewCard
          icon={Flame}
          label="Longest active streak"
          value={leaderboard.length ? `${Math.max(...leaderboard.map((l) => l.streak))}` : "0"}
          sub={leaderboard.length ? nameOf([...leaderboard].sort((a, b) => b.streak - a.streak)[0].studentId) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm font-medium">Weekly attendance rate (last 8 weeks)</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="rate" fill="oklch(0.52 0.21 277)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium">Attendance leaderboard</p>
          <div className="mt-3 space-y-2">
            {leaderboard.length === 0 && <p className="py-4 text-sm text-muted-foreground">No attendance records yet.</p>}
            {leaderboard.map((l, i) => (
              <button
                key={l.studentId}
                onClick={() => setSelectedStudent(l.studentId)}
                className="flex w-full items-center justify-between rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center font-display font-semibold text-muted-foreground">{i + 1}</span>
                  {nameOf(l.studentId)}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {l.streak >= 3 && <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3 text-amber-500" /> {l.streak}</Badge>}
                  <span className="font-semibold">{l.rate}%</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Per-student metrics */}
      <Card className="p-4">
        <Label>Athlete</Label>
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Choose an athlete…" /></SelectTrigger>
          <SelectContent>{students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {selectedStudent && (
        <>
          {selectedBoard && (
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">Attendance {selectedBoard.rate}%</Badge>
              <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3 text-amber-500" /> Streak: {selectedBoard.streak} sessions</Badge>
              <Badge variant="secondary">{selectedBoard.sessions} sessions recorded</Badge>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {metrics.map((m) => {
              const series = (stats || []).filter((s) => s.metric === m).map((s) => ({
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
            {metrics.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">No stats recorded yet for this athlete.</Card>}
          </div>
        </>
      )}
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </div>
    </Card>
  );
}

function AddStatDialog({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const { club, user } = useAuth();
  const [metric, setMetric] = useState("Speed (m/s)");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    setBusy(true);
    const { error } = await supabase.from("student_stats").insert({
      club_id: club.id, student_id: studentId, metric, value: parseFloat(value), notes, recorded_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Recorded"); onDone(); }
    setBusy(false);
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record stat</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Metric</Label><Input value={metric} onChange={(e) => setMetric(e.target.value)} /></div>
        <div><Label>Value</Label><Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">Save</Button>
      </form>
    </DialogContent>
  );
}
