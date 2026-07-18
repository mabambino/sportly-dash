import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Syncletics" }] }),
  component: AttendancePage,
});

type MarkStatus = "present" | "absent" | "late";

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

  const mark = async (studentId: string, status: MarkStatus) => {
    const existing = records?.find((r) => r.student_id === studentId);
    const { error } = existing
      ? await supabase.from("attendance_records").update({ status }).eq("id", existing.id)
      : await supabase.from("attendance_records").insert({ slot_id: selectedSlot, student_id: studentId, status });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["att", selectedSlot] });
    toast.success(`Marked ${status}`);
  };

  if (!isStaff) {
    return <Card className="p-8 text-center text-muted-foreground">Attendance is managed by trainers.</Card>;
  }

  const marked = (records || []).length;
  const present = (records || []).filter((r) => r.status === "present").length;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark athletes with a tick (present), cross (absent) or clock (late).</p>
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
          <>
            <p className="text-sm text-muted-foreground">
              {marked} of {students?.length ?? 0} marked{marked > 0 && ` · ${Math.round((present / marked) * 100)}% present`}
            </p>
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-border">
                {students?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No athletes yet.</p>}
                {students?.map((s) => {
                  const r = records?.find((x) => x.student_id === s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{s.display_name?.[0]?.toUpperCase()}</div>
                        <div>
                          <p className="font-medium">{s.display_name}</p>
                          {r && (
                            <Badge
                              variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "secondary"}
                              className="mt-0.5 capitalize"
                            >
                              {r.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <MarkButton
                          active={r?.status === "present"}
                          activeClass="bg-emerald-600 text-white hover:bg-emerald-600"
                          label="Present"
                          onClick={() => mark(s.id, "present")}
                        >
                          <Check className="h-4 w-4" />
                        </MarkButton>
                        <MarkButton
                          active={r?.status === "late"}
                          activeClass="bg-amber-500 text-white hover:bg-amber-500"
                          label="Late"
                          onClick={() => mark(s.id, "late")}
                        >
                          <Clock className="h-4 w-4" />
                        </MarkButton>
                        <MarkButton
                          active={r?.status === "absent"}
                          activeClass="bg-destructive text-white hover:bg-destructive"
                          label="Absent"
                          onClick={() => mark(s.id, "absent")}
                        >
                          <X className="h-4 w-4" />
                        </MarkButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function MarkButton({ active, activeClass, label, onClick, children }: {
  active: boolean;
  activeClass: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label={label}
          onClick={onClick}
          className={cn("h-9 w-9 rounded-full", active && activeClass)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
