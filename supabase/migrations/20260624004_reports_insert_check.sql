-- ════════════════════════════════════════════════════════════════════════════
-- Tighten rentivo_reports INSERT: stop reporter_id spoofing + clear the
-- "RLS Policy Always True" advisor, WITHOUT breaking anonymous reporting.
-- ════════════════════════════════════════════════════════════════════════════
-- The client (app/(consumer)/listing/[id].tsx:163) inserts reporter_id = user?.id ?? null
-- — i.e. an authenticated reporter uses their own id, an anonymous reporter uses null.
-- The previous WITH CHECK (true) let anyone set reporter_id to ANOTHER user's id
-- (framing) and tripped advisor 0024. This check matches the legit client exactly.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "Anyone can create reports" ON public.rentivo_reports;
--   CREATE POLICY "Anyone can create reports" ON public.rentivo_reports
--     FOR INSERT WITH CHECK (true);
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can create reports" ON public.rentivo_reports;
CREATE POLICY "Anyone can create reports" ON public.rentivo_reports
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND reporter_id = auth.uid())
    OR (auth.uid() IS NULL AND reporter_id IS NULL)
  );
