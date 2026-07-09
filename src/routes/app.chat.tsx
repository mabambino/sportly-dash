import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { Plus, Send, Hash, Radio, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "Chat — Syncletics" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { club, isStaff, user, profile } = useAuth();
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: channels } = useQuery({
    enabled: !!club,
    queryKey: ["channels", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channels").select("*").eq("club_id", club!.id).order("created_at");
      return data || [];
    },
  });

  useEffect(() => {
    if (channels && channels.length > 0 && !activeChannel) setActiveChannel(channels[0].id);
  }, [channels, activeChannel]);

  const { data: messages } = useQuery({
    enabled: !!activeChannel,
    queryKey: ["msgs", activeChannel],
    queryFn: async () => {
      const { data: ms } = await supabase.from("chat_messages").select("*").eq("channel_id", activeChannel).order("created_at");
      const senderIds = Array.from(new Set((ms || []).map((m) => m.sender_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"]);
      return (ms || []).map((m) => ({ ...m, sender: profs?.find((p) => p.id === m.sender_id) }));
    },
  });

  useEffect(() => {
    if (!activeChannel) return;
    const ch = supabase.channel(`chat:${activeChannel}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel}` },
      () => qc.invalidateQueries({ queryKey: ["msgs", activeChannel] })
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChannel, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChannel || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase.from("chat_messages").insert({ channel_id: activeChannel, sender_id: user.id, content: text });
    if (error) toast.error(error.message);
  };

  return (
    <div className="grid h-[calc(100dvh-11.5rem)] grid-cols-1 gap-4 md:h-[calc(100vh-12rem)] md:grid-cols-[16rem_1fr]">
      <Card className={cn("p-3", mobileThreadOpen && "hidden md:block")}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Channels</p>
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button></DialogTrigger>
              <NewChannelDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["channels"] }); }} />
            </Dialog>
          )}
        </div>
        <div className="space-y-1">
          {channels?.length === 0 && <p className="px-2 text-xs text-muted-foreground">No channels yet.</p>}
          {channels?.map((c) => (
            <button key={c.id} onClick={() => { setActiveChannel(c.id); setMobileThreadOpen(true); }} className={cn(
              "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors",
              activeChannel === c.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}>
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", activeChannel === c.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>
                {c.is_broadcast ? <Radio className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className={cn("block truncate text-xs", activeChannel === c.id ? "text-primary-foreground/70" : "text-muted-foreground")}>{c.is_broadcast ? "Broadcast" : "Group chat"}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className={cn("flex flex-col overflow-hidden p-0", !mobileThreadOpen && "hidden md:flex")}>
        <div className="flex items-center gap-2 border-b border-border p-3 md:p-4">
          <button type="button" onClick={() => setMobileThreadOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden" aria-label="Back to channels">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            {channels?.find((c) => c.id === activeChannel)?.is_broadcast ? <Radio className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
          </span>
          <p className="truncate font-semibold">{channels?.find((c) => c.id === activeChannel)?.name || "Select a channel"}</p>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages?.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet — say hi 👋</p>}
          {messages?.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                  {!mine && <p className="mb-0.5 text-[11px] font-semibold text-primary">{m.sender?.display_name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn("mt-1 text-right text-[10px] leading-none", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{format(new Date(m.created_at), "h:mm a")}</p>
                </div>
              </div>
            );
          })}
        </div>
        {activeChannel && (
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" className="h-10 rounded-full" />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-gradient-hero"><Send className="h-4 w-4" /></Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function NewChannelDialog({ onDone }: { onDone: () => void }) {
  const { club, user } = useAuth();
  const [name, setName] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    const { error } = await supabase.from("chat_channels").insert({ club_id: club.id, name, is_broadcast: broadcast, created_by: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Channel created"); onDone(); }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New channel</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /> Broadcast (staff only posts)</label>
        <Button type="submit" className="w-full bg-gradient-hero">Create</Button>
      </form>
    </DialogContent>
  );
}
