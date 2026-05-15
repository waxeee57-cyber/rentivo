// ical-import — placeholder Edge Function
// Accepts a URL query param, fetches the iCal feed, returns parsed event count.
// Jövőbeni kapu: Nylas calendar API / real iCal parsing + blocked-dates sync
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const icalUrl = url.searchParams.get("url");

  if (!icalUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required query param: url" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Placeholder: real implementation will fetch + parse iCal events
  // and upsert blocked dates into rentivo_availability table.
  return new Response(
    JSON.stringify({ ok: true, url: icalUrl, count: 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
