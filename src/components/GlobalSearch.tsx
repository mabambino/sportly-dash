import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, TrendingUp, Kanban, Calendar, Layers, UserCog, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  icon: typeof Search;
  keywords?: string;
};

const FEATURE_RESULTS: SearchResult[] = [
  { id: "members", title: "Members", subtitle: "Users, students, trainers and admins", to: "/app/members", icon: Users, keywords: "people users students coaches trainers admins roles" },
  { id: "revenue", title: "Revenue", subtitle: "Income, paid and overdue payments", to: "/app/revenue", icon: TrendingUp, keywords: "money income finance payments billing invoices" },
  { id: "pipeline", title: "Pipeline", subtitle: "Members and upcoming sessions", to: "/app/pipeline", icon: Kanban, keywords: "pipeline funnel members sessions" },
  { id: "leads", title: "Leads", subtitle: "Trials, prospects and conversions", to: "/app/leads", icon: UserCog, keywords: "pipeline prospects trial converted lost" },
  { id: "schedule", title: "Schedule", subtitle: "Sessions, calendar and locations", to: "/app/schedule", icon: Calendar, keywords: "events time slots classes calendar" },
  { id: "groups", title: "Groups & courses", subtitle: "Teams, classes and course groups", to: "/app/groups", icon: Layers, keywords: "courses groups teams classes" },
  { id: "billing", title: "Billing", subtitle: "Invoices and payment status", to: "/app/billing", icon: CreditCard, keywords: "payments paid overdue invoice money" },
];

const POPULAR_SUGGESTIONS = ["Find a member", "Show revenue", "Open pipeline", "Upcoming sessions"];

export function GlobalSearch() {
  const { club } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = query.trim().toLowerCase();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const { data: records = [], isFetching } = useQuery({
    enabled: !!club && term.length >= 2,
    queryKey: ["global-search", club?.id, term],
    queryFn: async (): Promise<SearchResult[]> => {
      const safe = term.replace(/[,()%_]/g, " ").trim();
      const [memberships, profiles, slots, groups, payments] = await Promise.all([
        supabase.from("memberships").select("user_id, role").eq("club_id", club!.id).limit(250),
        supabase.from("profiles").select("id, display_name, email").or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%`).limit(12),
        supabase.from("time_slots").select("id, title, location, starts_at").eq("club_id", club!.id).or(`title.ilike.%${safe}%,location.ilike.%${safe}%`).limit(8),
        supabase.from("course_groups").select("id, name, description").eq("club_id", club!.id).or(`name.ilike.%${safe}%,description.ilike.%${safe}%`).limit(8),
        supabase.from("payments").select("id, member_id, status, amount_cents").eq("club_id", club!.id).limit(250),
      ]);
      const membershipByUser = new Map((memberships.data || []).map((m) => [m.user_id, m.role]));
      const roleIds = (memberships.data || []).filter((m) => m.role.replace("_", " ").includes(term)).map((m) => m.user_id);
      const roleProfiles = roleIds.length
        ? await supabase.from("profiles").select("id, display_name, email").in("id", roleIds.slice(0, 20))
        : { data: [] };
      const matchedProfiles = [...(profiles.data || []), ...(roleProfiles.data || [])]
        .filter((profile, index, all) => all.findIndex((item) => item.id === profile.id) === index);
      const results: SearchResult[] = [];

      for (const p of matchedProfiles) {
        const role = membershipByUser.get(p.id);
        if (!role) continue;
        results.push({ id: `profile-${p.id}`, title: p.display_name || p.email, subtitle: `${role.replace("_", " ")} · ${p.email}`, to: "/app/members", icon: Users });
        const memberPayments = (payments.data || []).filter((payment) => payment.member_id === p.id);
        if (memberPayments.length) results.push({ id: `payment-${p.id}`, title: `${p.display_name || p.email} payments`, subtitle: `${memberPayments.length} invoice${memberPayments.length === 1 ? "" : "s"}`, to: "/app/revenue", icon: CreditCard });
      }
      for (const lead of leads.data || []) results.push({ id: `lead-${lead.id}`, title: lead.name, subtitle: `${lead.status} lead${lead.email ? ` · ${lead.email}` : ""}`, to: "/app/leads", icon: UserCog });
      for (const slot of slots.data || []) results.push({ id: `slot-${slot.id}`, title: slot.title, subtitle: slot.location || "Scheduled session", to: "/app/schedule", icon: Calendar });
      for (const group of groups.data || []) results.push({ id: `group-${group.id}`, title: group.name, subtitle: group.description || "Course group", to: "/app/groups", icon: Layers });
      return results.slice(0, 20);
    },
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const features = FEATURE_RESULTS.filter((item) => !term || `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(term));
    return [...features, ...records].slice(0, 24);
  }, [term, records]);

  useEffect(() => setActive(0), [query, results.length]);

  const choose = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate({ to: result.to as any });
  };

  return (
    <div ref={rootRef} className="relative flex-1 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
          if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Search members, revenue, pipeline…"
        className="h-10 w-full rounded-full border border-border bg-muted/40 pl-9 pr-16 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        aria-label="Search the application"
        aria-expanded={open}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">⌘ F</kbd>

      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          {!term && (
            <div className="px-2 pb-2 pt-1"><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested searches</p><div className="flex flex-wrap gap-2">{POPULAR_SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion.replace(/^(Find a |Show |Open )/i, ""))} className="rounded-full bg-muted px-3 py-1.5 text-xs hover:bg-accent">{suggestion}</button>)}</div></div>
          )}
          {term && isFetching && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
          {results.length ? results.map((result, index) => {
            const Icon = result.icon;
            return <button key={result.id} type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(result)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${active === index ? "bg-accent" : "hover:bg-accent/60"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span></span></button>;
          }) : term && !isFetching ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found. Try a member name, email, role, payment, session or group.</p> : null}
        </div>
      )}
    </div>
  );
}
