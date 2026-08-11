import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getEmbedStats = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ clubId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [clubRes, membersRes, slotsRes, attRes] = await Promise.all([
      supabaseAdmin.from("clubs").select("id, name, sport, monthly_fee_cents").eq("id", data.clubId).maybeSingle(),
      supabaseAdmin.from("memberships").select("role").eq("club_id", data.clubId),
      supabaseAdmin
        .from("time_slots")
        .select("id, title, starts_at, location")
        .eq("club_id", data.clubId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(5),
      supabaseAdmin
        .from("attendance_records")
        .select("status, time_slots!inner(club_id)")
        .eq("time_slots.club_id", data.clubId),
    ]);

    if (!clubRes.data) throw new Error("Club not found");

    const members = membersRes.data || [];
    const students = members.filter((m) => m.role === "student").length;
    const trainers = members.filter((m) => m.role === "trainer" || m.role === "club_owner").length;
    const att = attRes.data || [];
    const present = att.filter((a) => a.status === "present").length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : 0;

    return {
      club: clubRes.data,
      stats: { students, trainers, members: members.length, attRate },
      upcoming: slotsRes.data || [],
    };
  });

// This endpoint is deliberately unauthenticated (it backs the public embed
// widget) but it writes with the service-role client, which bypasses RLS.
// Anything reachable that way needs its own limits, since RLS provides none.
const MAX_LEADS_PER_CLUB_PER_HOUR = 20;

export const submitEmbedLead = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      clubId: z.string().uuid(),
      // Length caps: unbounded strings on a public, service-role write are an
      // easy way to fill the table.
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().max(254).email().optional().or(z.literal("")),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm the club exists before writing. Without this the only thing
    // standing between a stranger and an insert is a foreign-key error.
    const { data: club } = await supabaseAdmin
      .from("clubs")
      .select("id")
      .eq("id", data.clubId)
      .maybeSingle();
    if (!club) throw new Error("Club not found");

    // Coarse per-club throttle so a script cannot flood one club's pipeline.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await (supabaseAdmin as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("club_id", data.clubId)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= MAX_LEADS_PER_CLUB_PER_HOUR) {
      throw new Error("Too many enquiries right now — please try again later.");
    }

    const { error } = await (supabaseAdmin as any).from("leads").insert({
      club_id: data.clubId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      // "new" is not one of the statuses the leads CHECK constraint allows
      // (lead | trial | converted | lost), so every embed submission was
      // rejected by the database. The Leads board starts at "lead".
      status: "lead",
      source: "embed",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
