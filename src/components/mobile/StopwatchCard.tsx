// Compact stopwatch for the mobile home screen.
//
// Deliberately reads and writes the same localStorage key and entry shape as
// the desktop dashboard's Time Tracker (`syncletics-time-entries:<clubId>`),
// so time logged on a phone shows up on the desktop widget and vice versa.
// If you change the TimeEntry shape here, change it there too.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimeEntry = {
  id: string;
  memberId: string;
  memberName: string;
  ms: number;
  note: string;
  savedAt: string;
};

function formatDuration(ms: number) {
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${hh > 0 ? `${hh}h ` : ""}${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

/** Big monospaced readout: mm:ss.cs, or h:mm:ss.cs once past an hour. */
function readout(ms: number) {
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const core = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  return hh > 0 ? `${hh}:${core}` : core;
}

export function StopwatchCard() {
  const { club } = useAuth();
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  const [saveOpen, setSaveOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const entriesKey = club ? `syncletics-time-entries:${club.id}` : null;

  useEffect(() => {
    if (!entriesKey) return;
    try {
      const raw = JSON.parse(localStorage.getItem(entriesKey) || "null");
      if (Array.isArray(raw)) setEntries(raw);
    } catch {
      /* ignore */
    }
  }, [entriesKey]);

  const { data: members } = useQuery({
    enabled: !!club,
    queryKey: ["time-tracker-members", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("club_id", club!.id);
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({
        id: m.user_id,
        name: profs?.find((p) => p.id === m.user_id)?.display_name || "Member",
      }));
    },
  });

  // 30ms keeps the centiseconds readable without pinning the main thread.
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = window.setInterval(() => {
      setMs(baseRef.current + (Date.now() - (startRef.current ?? Date.now())));
    }, 30);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      baseRef.current = ms;
      setRunning(false);
    } else {
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setMs(0);
  };

  const openSave = () => {
    // Pause first so the figure can't move while the dialog is open.
    if (running) {
      baseRef.current = ms;
      setRunning(false);
    }
    setSaveOpen(true);
  };

  const saveEntry = () => {
    if (!entriesKey) return;
    if (!memberId) {
      toast.error("Choose an athlete to add this time to");
      return;
    }
    if (ms <= 0) {
      toast.error("Track some time before saving");
      return;
    }
    const member = (members || []).find((m) => m.id === memberId);
    const entry: TimeEntry = {
      id: `${Date.now()}`,
      memberId,
      memberName: member?.name || "Member",
      ms,
      note: note.trim(),
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...entries].slice(0, 50);
    setEntries(next);
    try {
      localStorage.setItem(entriesKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast.success(`Added ${formatDuration(ms)} to ${entry.memberName}`);
    setSaveOpen(false);
    setNote("");
    setMemberId("");
    reset();
  };

  return (
    <>
      <div className="rounded-[--radius] bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Stopwatch</p>
          {entries.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{entries.length} saved</p>
          )}
        </div>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums leading-none">
          {readout(ms)}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={toggle} className="flex-1 gap-1.5">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : ms > 0 ? "Resume" : "Start"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={reset}
            disabled={ms === 0}
            aria-label="Reset stopwatch"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={openSave}
            disabled={ms === 0}
            aria-label="Save time"
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {formatDuration(ms)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Athlete</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose an athlete" />
                </SelectTrigger>
                <SelectContent>
                  {(members || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. 400m repeats"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEntry}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
