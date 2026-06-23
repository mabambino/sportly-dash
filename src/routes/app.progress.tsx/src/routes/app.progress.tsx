import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/progress")({
  head: () => ({ meta: [{ title: "Progress — ClubHaus" }] }),
  component: ProgressPage,
});

function SkillDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < level ? "bg-primary" : "bg-muted"}`}
        />
      ))}
    </div>
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
      const { data: mems } = await supabase.from("memberships").select("*, profiles(id, display_name)").eq("club_id", club!.id).eq("role", "student");
      return (mems || []).map((m: any) => m.profiles).filter(Boolean);
    },
  });

  const { data: logs } = useQuery({
    enabled: !!club,
    queryKey: ["progress-logs", club?.id, filterStudent],
    queryFn: async () => {
      let q = supabase.from("progress_log").select("*, profiles!student_id(display_name), trainer:profiles!trainer_id(display_name)").eq("club_id", club!.id).order("created_at", { ascending: false });
      if (filterStudent !== "all") q = q.eq("student_id", filterStudent);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Progress</h1>
          <p className="text-sm text-muted-foreground">Student skill development and milestones</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Add note</Button>
            </DialogTrigger>
            <AddNoteDialog
              clubId={club!.id}
              trainerId={user!.id}
              students={students || []}
              onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["progress-logs"] }); }}
            />
          </Dialog>
        )}
      </div>

      {students && students.length > 0 && (
        <Card className="p-4">
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {students.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      <div className="space-y-3">
        {logs?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No progress notes yet.</Card>
        )}
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
    const { error } = await supabase.from("progress_log").insert({
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
              {students.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>
              ))}
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
          <div><Label>Milestone</Label><Input value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="First goal, Passed test…" /></div>
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Saving…" : "Save note"}</Button>
      </form>
    </DialogContent>
  );
}
