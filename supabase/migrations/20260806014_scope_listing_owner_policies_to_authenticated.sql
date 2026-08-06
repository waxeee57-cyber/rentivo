-- Revoking anon's SELECT on rentivo_operators/rentivo_hosts (to close the column
-- leak) had a side effect: the "Operators/Hosts manage own listings" policies on
-- rentivo_listings are cmd=ALL, roles=public, and their USING clause runs
-- EXISTS(SELECT 1 FROM rentivo_operators/rentivo_hosts ...). For ANY anon SELECT
-- on listings, Postgres evaluates every permissive policy — including those
-- subqueries — so with anon no longer able to read operators/hosts the whole
-- listings read threw 42501 and the anonymous storefront went 401. Measured.
--
-- These are OWNER-management policies; an anonymous caller can never be an owner
-- (auth.uid() is null), so they belong to `authenticated`, not `public`. Scoping
-- them there means anon evaluates only "Anyone can view available listings"
-- (available = true, no cross-table subquery), while authenticated owners keep
-- exactly the same access — and authenticated still holds SELECT on operators/
-- hosts, so their EXISTS checks resolve.
alter policy "Operators manage own listings" on public.rentivo_listings to authenticated;
alter policy "Hosts manage own listings" on public.rentivo_listings to authenticated;
alter policy "Direct owners manage own listings" on public.rentivo_listings to authenticated;
