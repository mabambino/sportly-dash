import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Megaphone, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Compact popover panels for the top-bar Messages / Announcements /
 * Notifications icons — a small squared view of recent items with a
 * "View all" link, instead of navigating straight to the full page.
 */

const triggerCls =
  "relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground";

function Panel({
  title,
  viewAllTo,
  onNavigate,
  children,
}: {
  title: string;
  viewAllTo: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <Link
          to={viewAllTo}
          onClick={onNavigate}
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          View all
        </Link>
      </div>
      <div className="max-h-80 overflow-auto py-1">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

export function MessagesPopover() {
  const { club } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: channels } = useQuery({
    enabled: !!club && open,
    queryKey: ["quick-channels", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_channels")
        .select("id, name, is_broadcast")
        .eq("club_id", club!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerCls} aria-label="Messages">
        <Mail className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <Panel title="Messages" viewAllTo="/app/chat" onNavigate={() => setOpen(false)}>
          {!channels ? (
            <EmptyState label="Loading…" />
          ) : channels.length === 0 ? (
            <EmptyState label="No channels yet." />
          ) : (
            channels.map((c) => (
              <Link
                key={c.id}
                to="/app/chat"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 px-4 py-2 text-sm transition hover:bg-accent/50"
              >
                <span className="truncate font-medium"># {c.name}</span>
                {c.is_broadcast && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Broadcast
                  </span>
                )}
              </Link>
            ))
          )}
        </Panel>
      </PopoverContent>
    </Popover>
  );
}

export function AnnouncementsPopover() {
  const { club } = useAuth();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    enabled: !!club && open,
    queryKey: ["quick-announcements", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("club_id", club!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerCls} aria-label="Announcements">
        <Megaphone className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <Panel title="Announcements" viewAllTo="/app/announcements" onNavigate={() => setOpen(false)}>
          {!data ? (
            <EmptyState label="Loading…" />
          ) : data.length === 0 ? (
            <EmptyState label="No announcements yet." />
          ) : (
            data.map((a) => (
              <Link
                key={a.id}
                to="/app/announcements"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 transition hover:bg-accent/50"
              >
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
              </Link>
            ))
          )}
        </Panel>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    enabled: !!user && open,
    queryKey: ["quick-notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });
  // Lightweight unread count for the trigger dot (runs whenever signed in).
  const { data: unread } = useQuery({
    enabled: !!user,
    queryKey: ["quick-notifications-unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerCls} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {(unread ?? 0) > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <Panel title="Notifications" viewAllTo="/app/notifications" onNavigate={() => setOpen(false)}>
          {!data ? (
            <EmptyState label="Loading…" />
          ) : data.length === 0 ? (
            <EmptyState label="You're all caught up." />
          ) : (
            data.map((n) => (
              <Link
                key={n.id}
                to="/app/notifications"
                onClick={() => setOpen(false)}
                className={cn("block px-4 py-2.5 transition hover:bg-accent/50", !n.read && "bg-primary/5")}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </Panel>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Combined bell for the mobile header — notifications and announcements
 * merged into a single popover with a tab switcher.
 */
export function AlertsPopover() {
  const { club, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"notifications" | "announcements">("notifications");

  const { data: notifications } = useQuery({
    enabled: !!user && open,
    queryKey: ["quick-notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });
  const { data: announcements } = useQuery({
    enabled: !!club && open,
    queryKey: ["quick-announcements", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("club_id", club!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });
  const { data: unread } = useQuery({
    enabled: !!user,
    queryKey: ["quick-notifications-unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerCls} aria-label="Notifications and announcements">
        <Bell className="h-4 w-4" />
        {(unread ?? 0) > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="flex gap-1 border-b border-border p-2">
          <button
            type="button"
            onClick={() => setTab("notifications")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              tab === "notifications" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Bell className="h-3.5 w-3.5" /> Notifications
          </button>
          <button
            type="button"
            onClick={() => setTab("announcements")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              tab === "announcements" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Megaphone className="h-3.5 w-3.5" /> Announcements
          </button>
        </div>
        {tab === "notifications" ? (
          <Panel title="Notifications" viewAllTo="/app/notifications" onNavigate={() => setOpen(false)}>
            {!notifications ? (
              <EmptyState label="Loading…" />
            ) : notifications.length === 0 ? (
              <EmptyState label="You're all caught up." />
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  to="/app/notifications"
                  onClick={() => setOpen(false)}
                  className={cn("block px-4 py-2.5 transition hover:bg-accent/50", !n.read && "bg-primary/5")}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </Panel>
        ) : (
          <Panel title="Announcements" viewAllTo="/app/announcements" onNavigate={() => setOpen(false)}>
            {!announcements ? (
              <EmptyState label="Loading…" />
            ) : announcements.length === 0 ? (
              <EmptyState label="No announcements yet." />
            ) : (
              announcements.map((a) => (
                <Link
                  key={a.id}
                  to="/app/announcements"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 transition hover:bg-accent/50"
                >
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </Link>
              ))
            )}
          </Panel>
        )}
      </PopoverContent>
    </Popover>
  );
}
