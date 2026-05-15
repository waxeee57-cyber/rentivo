-- Storage buckets for Rentivo
-- Photos: private buckets, operator/user-specific paths
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('rentivo-listings',  'rentivo-listings',  false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('rentivo-damage',    'rentivo-damage',    false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('rentivo-contracts', 'rentivo-contracts', false, 5242880,  ARRAY['application/pdf']),
  ('rentivo-avatars',   'rentivo-avatars',   true,  2097152,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS: listings photos — operator or listing owner can upload/read
CREATE POLICY "Operators upload listing photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rentivo-listings' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Anyone reads listing photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'rentivo-listings');

-- RLS: damage photos — booking parties only
CREATE POLICY "Booking parties upload damage photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rentivo-damage' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Booking parties read damage photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'rentivo-damage' AND
    auth.uid() IS NOT NULL
  );

-- RLS: contracts — private, owner only
CREATE POLICY "Users access own contracts" ON storage.objects
  FOR ALL USING (
    bucket_id = 'rentivo-contracts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: avatars — public read, self upload
CREATE POLICY "Anyone reads avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'rentivo-avatars');

CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rentivo-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'rentivo-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
