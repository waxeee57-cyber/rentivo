-- BUG (measured 2026-08-06): update_listing_rating() is SECURITY INVOKER and fires
-- on rentivo_reviews, which travelers insert themselves (app/(consumer)/bookings/
-- review/[bookingId].tsx). Its UPDATE rentivo_listings then runs as the traveler,
-- who satisfies no listings UPDATE policy (all three are owner-scoped) and holds
-- only a table-level UPDATE grant -> the UPDATE matches 0 rows silently. Result:
-- listing rating/review_count never move in production; the only non-zero rating
-- in the DB came from a service-role test insert. Recomputing the aggregate is a
-- safe owner-privileged operation, so run it as DEFINER. search_path already pinned.
alter function public.update_listing_rating() security definer;
