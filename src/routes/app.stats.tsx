import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/stats")({
  head: () => ({ meta: [{ title: "Stats — ClubHaus" }] }),
  component: StatsPage,
});

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

  const { data: stats } = useQuery({
    enabled: !!selectedStudent,
    queryKey: ["stats", selectedStudent],
    queryFn: async () => {
      const { data } = await supabase.from("student_stats").select("*").eq("student_id", selectedStudent).order("recorded_at");
      return data || [];
    },
  });

  if (!isStaff) return <Card className="p-8 text-center text-muted-foreground">Stats are managed by trainers.</Card>;

  const metrics = Array.from(new Set((stats || []).map((s) => s.metric)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Performance Stats</h1>
          <p className="text-sm text-muted-foreground">Track configurable metrics over time.</p>
        </div>
        {selectedStudent && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Record stat</Button></DialogTrigger>
            <AddStatDialog studentId={selectedStudent} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["stats"] }); }} />
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <Label>Student</Label>
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Choose a student…" /></SelectTrigger>
          <SelectContent>{students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {selectedStudent && (
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
          {metrics.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">No stats recorded yet for this student.</Card>}
        </div>
      )}
    </div>
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
