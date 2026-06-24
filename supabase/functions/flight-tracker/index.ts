import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { booking_id, flight_number } = await req.json() as { booking_id: string; flight_number: string }

    // AviationStack API integration point
    // const AVIATION_KEY = Deno.env.get('AVIATIONSTACK_API_KEY')
    // Real implementation would fetch: http://api.aviationstack.com/v1/flights?access_key={KEY}&flight_iata={flight_number}

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
    )

    // Mock response — replace with real AviationStack API call
    const mockStatus = 'on_time'
    const mockArrival = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('rentivo_bookings')
      .update({
        flight_status: mockStatus,
        flight_arrival_time: mockArrival,
      })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ success: true, status: mockStatus, arrival: mockArrival }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
