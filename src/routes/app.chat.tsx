import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { Plus, Send, Hash, Radio, ArrowLeft, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const previewTime = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? format(d, "h:mm a") : format(d, "MMM d");
};

export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "Chat — Syncletics" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { club, isStaff, user, profile } = useAuth();
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: channels } = useQuery({
    enabled: !!club,
    queryKey: ["channels", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channels").select("*").eq("club_id", club!.id).order("created_at");
      const list = data || [];
      const ids = list.map((c) => c.id);
      const { data: recent } = await supabase
        .from("chat_messages")
        .select("channel_id, content, created_at")
        .in("channel_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false })
        .limit(120);
      const lastByChannel: Record<string, { content: string; created_at: string }> = {};
      for (const m of recent || []) {
        if (!lastByChannel[m.channel_id]) lastByChannel[m.channel_id] = m;
      }
      return list.map((c) => ({ ...c, last: lastByChannel[c.id] as { content: string; created_at: string } | undefined }));
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

  const filtered = (channels || []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const active = channels?.find((c) => c.id === activeChannel);

  return (
    <div className="md:grid md:h-[calc(100vh-12rem)] md:grid-cols-[20rem_1fr] md:gap-6">
      {/* Conversation list - borderless, Telegram-style rows */}
      <div className={cn("md:flex md:min-h-0 md:flex-col", mobileThreadOpen && "hidden md:flex")}>
        <div className="mb-2 hidden items-center gap-2 md:flex">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-10" />
          </div>
          {isStaff && (
            <Button size="icon" variant="outline" className="shrink-0" aria-label="New channel" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="min-h-0 space-y-0.5 pb-32 md:flex-1 md:overflow-y-auto md:pb-0">
          {filtered.length === 0 && (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">
              {channels?.length === 0 ? "No channels yet." : "No matches."}
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveChannel(c.id); setMobileThreadOpen(true); }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors",
                activeChannel === c.id ? "md:bg-accent" : "hover:bg-accent/50",
              )}
            >
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full text-primary-foreground", c.is_broadcast ? "bg-gradient-hero" : "bg-primary")}>
                {c.is_broadcast ? <Radio className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  {c.last && <span className="shrink-0 text-xs text-muted-foreground">{previewTime(c.last.created_at)}</span>}
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {c.last ? c.last.content : c.is_broadcast ? "Broadcast" : "Group chat"}
                </span>
              </span>
            </button>
          ))}
        </div>
        {/* Floating search + compose above the tab bar (mobile) */}
        <div data-no-ptr className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-12 border-transparent pl-11 shadow-elegant" />
          </div>
          {isStaff && (
            <button type="button" aria-label="New channel" onClick={() => setOpen(true)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-elegant">
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={cn("flex h-[calc(100dvh-13.5rem)] flex-col overflow-hidden rounded-3xl bg-card shadow-card md:h-auto md:border md:border-border", !mobileThreadOpen && "hidden md:flex")}>
        <div className="flex items-center gap-2 border-b border-border p-3 md:p-4">
          <button type="button" onClick={() => setMobileThreadOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden" aria-label="Back to channels">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary-foreground", active?.is_broadcast ? "bg-gradient-hero" : "bg-primary")}>
            {active?.is_broadcast ? <Radio className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
          </span>
          <p className="truncate font-semibold">{active?.name || "Select a channel"}</p>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages?.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet — say hi 👋</p>}
          {messages?.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-3xl px-4 py-2 text-sm shadow-sm", mine ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg bg-secondary")}>
                  {!mine && <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{m.sender?.display_name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn("mt-1 text-right text-[10px] leading-none", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{format(new Date(m.created_at), "h:mm a")}</p>
                </div>
              </div>
            );
          })}
        </div>
        {activeChannel && (
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" className="h-10 border-transparent bg-secondary" />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-gradient-hero"><Send className="h-4 w-4" /></Button>
          </form>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <NewChannelDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["channels"] }); }} />
      </Dialog>
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
