-- Digital Contract + e-Signature columns for rentivo_bookings
-- operator_signature already exists in the schema — using operator_signature_data to avoid conflict
-- contract_signed_at and contract_url already exist — adding new granular fields only

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS contract_html TEXT,
  ADD COLUMN IF NOT EXISTS guest_signature TEXT,
  ADD COLUMN IF NOT EXISTS operator_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS guest_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN public.rentivo_bookings.contract_html IS
  'Generated HTML of the rental contract at booking time.';
COMMENT ON COLUMN public.rentivo_bookings.guest_signature IS
  'SVG path data of guest e-signature (eIDAS SES).';
COMMENT ON COLUMN public.rentivo_bookings.operator_signature_data IS
  'SVG path data of operator e-signature (eIDAS SES). Separate from legacy operator_signature column.';
COMMENT ON COLUMN public.rentivo_bookings.guest_signed_at IS
  'Timestamp when the guest completed their e-signature.';
COMMENT ON COLUMN public.rentivo_bookings.operator_signed_at IS
  'Timestamp when the operator completed their e-signature.';
COMMENT ON COLUMN public.rentivo_bookings.contract_status IS
  'Contract signing state: pending | guest_signed | fully_signed.';
