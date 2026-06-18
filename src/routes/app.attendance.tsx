import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — ClubHaus" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const { data: slots } = useQuery({
    enabled: !!club,
    queryKey: ["slots-att", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("time_slots").select("*").eq("club_id", club!.id).order("starts_at", { ascending: false });
      return data || [];
    },
  });

  const { data: students } = useQuery({
    enabled: !!club,
    queryKey: ["students-att", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id).eq("role", "student");
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return profs || [];
    },
  });

  const { data: records } = useQuery({
    enabled: !!selectedSlot,
    queryKey: ["att", selectedSlot],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_records").select("*").eq("slot_id", selectedSlot);
      return data || [];
    },
  });

  const mark = async (studentId: string, status: "present" | "absent") => {
    const existing = records?.find((r) => r.student_id === studentId);
    if (existing) {
      await supabase.from("attendance_records").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("attendance_records").insert({ slot_id: selectedSlot, student_id: studentId, status });
    }
    qc.invalidateQueries({ queryKey: ["att", selectedSlot] });
    toast.success(`Marked ${status}`);
  };

  if (!isStaff) {
    return <Card className="p-8 text-center text-muted-foreground">Attendance is managed by trainers.</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark students present or absent for each session.</p>
      </div>

      <Card className="p-4">
        <label className="text-sm font-medium">Session</label>
        <Select value={selectedSlot} onValueChange={setSelectedSlot}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Choose a session…" /></SelectTrigger>
          <SelectContent>
            {slots?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.title} — {format(new Date(s.starts_at), "MMM d, h:mm a")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {selectedSlot && (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            {students?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No students yet.</p>}
            {students?.map((s) => {
              const r = records?.find((x) => x.student_id === s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{s.display_name?.[0]?.toUpperCase()}</div>
                    <div>
                      <p className="font-medium">{s.display_name}</p>
                      {r && <Badge variant={r.status === "present" ? "default" : "destructive"} className="mt-0.5 capitalize">{r.status}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={r?.status === "present" ? "default" : "outline"} onClick={() => mark(s.id, "present")}>Present</Button>
                    <Button size="sm" variant={r?.status === "absent" ? "destructive" : "outline"} onClick={() => mark(s.id, "absent")}>Absent</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
