// ical-export — placeholder Edge Function
// Returns a minimal valid iCal feed for a listing's booked dates.
// Jövőbeni kapu: Nylas calendar API / real iCal generation (pg_cron nightly export)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const listingId = url.searchParams.get("listing_id") ?? "unknown";

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rentivo//EN",
    `X-WR-CALNAME:Rentivo listing ${listingId}`,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rentivo-${listingId}.ics"`,
    },
  });
});
