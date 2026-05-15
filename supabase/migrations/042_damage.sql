-- Damage reports — column names match types/index.ts DamageReport interface exactly
CREATE TABLE IF NOT EXISTS public.rentivo_damage_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.rentivo_bookings(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.rentivo_listings(id),
  operator_id UUID REFERENCES public.rentivo_operators(id),
  type TEXT NOT NULL CHECK (type IN ('pickup','return')),
  photo_front TEXT,
  photo_back TEXT,
  photo_left TEXT,
  photo_right TEXT,
  photo_interior TEXT,
  photo_extra TEXT,
  mileage INTEGER,
  fuel_level TEXT CHECK (fuel_level IN ('empty','quarter','half','three_quarters','full')),
  notes TEXT,
  damage_found BOOLEAN DEFAULT false,
  damage_notes TEXT,
  operator_signed BOOLEAN DEFAULT false,
  consumer_signed BOOLEAN DEFAULT false,
  operator_signature TEXT,
  consumer_signature TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_damage_reports_booking_id ON public.rentivo_damage_reports(booking_id);

ALTER TABLE public.rentivo_damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties see damage reports" ON public.rentivo_damage_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_bookings b
      WHERE b.id = booking_id AND (
        b.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.rentivo_operators o
          WHERE o.id = b.operator_id AND o.auth_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Booking parties create damage reports" ON public.rentivo_damage_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rentivo_bookings b
      WHERE b.id = booking_id AND (
        b.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.rentivo_operators o
          WHERE o.id = b.operator_id AND o.auth_id = auth.uid()
        )
      )
    )
  );

COMMENT ON TABLE public.rentivo_damage_reports IS
  'Kárjelentések pickup/return típusonként. Fotók Storage bucket-ben: rentivo-damage.';
