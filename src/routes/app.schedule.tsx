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
import { Plus, MapPin, Clock, Users as UsersIcon, Check, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/schedule")({
  head: () => ({ meta: [{ title: "Schedule — ClubHaus" }] }),
  component: SchedulePage,
});

function SchedulePage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: slots } = useQuery({
    enabled: !!club,
    queryKey: ["slots", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("time_slots").select("*").eq("club_id", club!.id).order("starts_at");
      return data || [];
    },
  });

  const { data: rsvps } = useQuery({
    enabled: !!club,
    queryKey: ["rsvps", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("rsvps").select("*, time_slots!inner(club_id)").eq("time_slots.club_id", club!.id);
      return data || [];
    },
  });

  const toggleRsvp = async (slotId: string) => {
    if (!user) return;
    const existing = rsvps?.find((r) => r.slot_id === slotId && r.user_id === user.id);
    if (existing) {
      await supabase.from("rsvps").delete().eq("id", existing.id);
      toast.success("RSVP removed");
    } else {
      await supabase.from("rsvps").insert({ slot_id: slotId, user_id: user.id, status: "going" });
      toast.success("You're going!");
    }
    qc.invalidateQueries({ queryKey: ["rsvps"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">{slots?.length ?? 0} sessions</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> New session</Button></DialogTrigger>
            <NewSlotDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["slots"] }); }} />
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {slots?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No sessions scheduled yet.</Card>}
        {slots?.map((s) => {
          const count = rsvps?.filter((r) => r.slot_id === s.id).length ?? 0;
          const mine = rsvps?.find((r) => r.slot_id === s.id && r.user_id === user?.id);
          const past = new Date(s.starts_at) < new Date();
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{s.title}</h3>
                    {past && <Badge variant="secondary">Past</Badge>}
                  </div>
                  {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(s.starts_at), "EEE MMM d, h:mm a")}</span>
                    {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {s.location}</span>}
                    <span className="flex items-center gap-1.5"><UsersIcon className="h-4 w-4" /> {count}/{s.capacity}</span>
                  </div>
                </div>
                {!past && (
                  <Button onClick={() => toggleRsvp(s.id)} variant={mine ? "default" : "outline"}>
                    {mine ? <><Check className="mr-2 h-4 w-4" /> Going</> : "RSVP"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewSlotDialog({ onDone }: { onDone: () => void }) {
  const { club, user } = useAuth();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("17:00");
  const [duration, setDuration] = useState("90");
  const [location, setLocation] = useState("Main Field");
  const [capacity, setCapacity] = useState("20");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    setBusy(true);
    const starts = new Date(`${date}T${time}`);
    const ends = new Date(starts.getTime() + parseInt(duration) * 60000);
    const { error } = await supabase.from("time_slots").insert({
      club_id: club.id, title, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      location, capacity: parseInt(capacity), trainer_id: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Session created"); onDone(); }
    setBusy(false);
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New training session</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Friday Practice" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div><Label>Capacity</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        </div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Creating…" : "Create session"}</Button>
      </form>
    </DialogContent>
  );
}
