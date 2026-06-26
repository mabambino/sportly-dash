// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, FileText, TrendingUp, Trophy, LineChart as LineChartIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/progress")({
  head: () => ({ meta: [{ title: "Progress — Syncletics" }] }),
  component: ProgressPage,
});

function SkillDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < level ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function ProgressPage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterStudent, setFilterStudent] = useState("all");

  const { data: students } = useQuery({
    enabled: !!club,
    queryKey: ["students-progress", club?.id],
    queryFn: async () => {
      const { data: mems } = await sb.from("memberships").select("*, profiles(id, display_name)").eq("club_id", club!.id).eq("role", "student");
      return (mems || []).map((m: any) => m.profiles).filter(Boolean);
    },
  });

  const { data: logs, isLoading } = useQuery({
    enabled: !!club,
    queryKey: ["progress-logs", club?.id, filterStudent],
    queryFn: async () => {
      let q = sb.from("progress_log").select("*, profiles!student_id(display_name), trainer:profiles!trainer_id(display_name)").eq("club_id", club!.id).order("created_at", { ascending: false });
      if (filterStudent !== "all") q = q.eq("student_id", filterStudent);
      const { data } = await q;
      return data || [];
    },
  });

  // Stats are computed across ALL notes (independent of the student filter).
  const { data: allLogs } = useQuery({
    enabled: !!club,
    queryKey: ["progress-logs-all", club?.id],
    queryFn: async () => {
      const { data } = await sb.from("progress_log").select("student_id, skill_level, milestone, created_at").eq("club_id", club!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const rows = allLogs || [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const notesThisWeek = rows.filter((r: any) => new Date(r.created_at) >= weekAgo).length;
    const milestonesThisMonth = rows.filter((r: any) => r.milestone && new Date(r.created_at) >= monthStart).length;
    const tracked = new Set(rows.map((r: any) => r.student_id)).size;
    const latestByStudent = new Map<string, number>();
    for (const r of rows as any[]) {
      if (r.skill_level && !latestByStudent.has(r.student_id)) latestByStudent.set(r.student_id, r.skill_level);
    }
    const levels = [...latestByStudent.values()];
    const avgSkill = levels.length ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : "—";
    return { notesThisWeek, milestonesThisMonth, tracked, avgSkill };
  }, [allLogs]);

  const chartData = useMemo(() => {
    if (filterStudent === "all" || !logs) return [];
    return (logs as any[])
      .filter((l) => l.skill_level)
      .map((l) => ({ date: format(new Date(l.created_at), "MMM d"), level: l.skill_level }))
      .reverse();
  }, [logs, filterStudent]);

  const hasNotes = (allLogs?.length ?? 0) > 0;
  const noStudents = students && students.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Progress</h1>
          <p className="text-sm text-muted-foreground">Student skill development and milestones</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Add note</Button></DialogTrigger>
            <AddNoteDialog
              clubId={club!.id}
              trainerId={user!.id}
              students={students || []}
              onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["progress-logs"] }); }}
            />
          </Dialog>
        )}
      </div>

      {hasNotes && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Students tracked" value={stats.tracked} />
          <StatCard icon={FileText} label="Notes this week" value={stats.notesThisWeek} />
          <StatCard icon={TrendingUp} label="Avg skill level" value={stats.avgSkill} hint="latest rating / student" />
          <StatCard icon={Trophy} label="Milestones this month" value={stats.milestonesThisMonth} />
        </div>
      )}

      {students && students.length > 0 && hasNotes && (
        <Card className="p-4">
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All students" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      )}

      {filterStudent !== "all" && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Skill level over time</p>
          </div>
          {chartData.length > 1 ? (
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="level" stroke="oklch(0.52 0.21 277)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Add at least two rated notes to see a trend.</p>
          )}
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
              </div>
              <Skeleton className="h-3.5 w-3/4" />
            </Card>
          ))}
        </div>
      ) : !hasNotes ? (
        <Card className="p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          {noStudents ? (
            <>
              <p className="mt-4 font-medium">No students yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add students to your club before logging progress.</p>
              {isStaff && (
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/app/members">Go to Members</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="mt-4 font-medium">No progress notes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isStaff ? "Log a student's skill development to start building their history." : "Your coach hasn't added any notes yet."}
              </p>
              {isStaff && (
                <Button onClick={() => setOpen(true)} className="mt-4 bg-gradient-hero">
                  <Plus className="mr-2 h-4 w-4" /> Add first note
                </Button>
              )}
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {logs?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No notes for this student yet.</Card>}
          {logs?.map((log: any) => (
            <Card key={log.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {log.profiles?.display_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{log.profiles?.display_name}</p>
                    <p className="text-xs text-muted-foreground">by {log.trainer?.display_name} · {format(new Date(log.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {log.skill_level && <SkillDots level={log.skill_level} />}
                  {log.milestone && <Badge variant="secondary">{log.milestone}</Badge>}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{log.note}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddNoteDialog({ clubId, trainerId, students, onDone }: { clubId: string; trainerId: string; students: any[]; onDone: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [note, setNote] = useState("");
  const [skillLevel, setSkillLevel] = useState("0");
  const [milestone, setMilestone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) { toast.error("Select a student"); return; }
    setBusy(true);
    const { error } = await sb.from("progress_log").insert({
      club_id: clubId,
      student_id: studentId,
      trainer_id: trainerId,
      note,
      skill_level: skillLevel !== "0" ? parseInt(skillLevel) : null,
      milestone: milestone || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Note added"); onDone(); }
    setBusy(false);
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add progress note</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Student *</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Select student…" /></SelectTrigger>
            <SelectContent>
              {students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Note *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Today we worked on…" rows={4} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Skill level (1–5)</Label>
            <Select value={skillLevel} onValueChange={setSkillLevel}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None</SelectItem>
                {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Milestone</Label><Input value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="First goal…" /></div>
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Saving…" : "Save note"}</Button>
      </form>
    </DialogContent>
  );
}
