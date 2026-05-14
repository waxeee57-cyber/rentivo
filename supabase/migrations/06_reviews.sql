CREATE OR REPLACE FUNCTION check_review_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rentivo_bookings
    WHERE id = NEW.booking_id
    AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Can only review completed bookings';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_review_eligibility
  BEFORE INSERT ON rentivo_reviews
  FOR EACH ROW EXECUTE FUNCTION check_review_eligibility();
