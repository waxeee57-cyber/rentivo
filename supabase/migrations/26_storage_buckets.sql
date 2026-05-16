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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Operators upload listing photos') THEN
    CREATE POLICY "Operators upload listing photos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'rentivo-listings' AND
        auth.uid() IS NOT NULL
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone reads listing photos') THEN
    CREATE POLICY "Anyone reads listing photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'rentivo-listings');
  END IF;
END $$;

-- RLS: damage photos — booking parties only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Booking parties upload damage photos') THEN
    CREATE POLICY "Booking parties upload damage photos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'rentivo-damage' AND
        auth.uid() IS NOT NULL
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Booking parties read damage photos') THEN
    CREATE POLICY "Booking parties read damage photos" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'rentivo-damage' AND
        auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- RLS: contracts — private, owner only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Users access own contracts') THEN
    CREATE POLICY "Users access own contracts" ON storage.objects
      FOR ALL USING (
        bucket_id = 'rentivo-contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- RLS: avatars — public read, self upload
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone reads avatars') THEN
    CREATE POLICY "Anyone reads avatars" ON storage.objects
      FOR SELECT USING (bucket_id = 'rentivo-avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Users upload own avatar') THEN
    CREATE POLICY "Users upload own avatar" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'rentivo-avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Users update own avatar') THEN
    CREATE POLICY "Users update own avatar" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'rentivo-avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
