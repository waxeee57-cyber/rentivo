-- GDPR erasure was one forgotten foreign key away from failing, every time.
--
-- Nine rentivo_* columns reference auth.users with ON DELETE NO ACTION.
-- delete-account handles three of them by hand; the other six each block
-- deleteUser for any user who happens to have such a row, and the erasure then
-- fails at the last step after everything else has already been destroyed.
--
-- Patching the function for each column is not a fix, it is a race against the
-- next foreign key somebody adds. The rule belongs in the schema: a column that
-- merely ATTRIBUTES a record to a person becomes NULL when that person is
-- erased, and the record survives without naming them.
--
-- The three the function handles deliberately stay NO ACTION, because they must
-- be repointed at the placeholder rather than nulled: bookings and reviews are
-- retained under GDPR Art. 17(3)(b) and need a non-null owner, and a dispute
-- must keep a raiser.

alter table public.rentivo_conversations
  drop constraint if exists rentivo_conversations_operator_user_id_fkey;
alter table public.rentivo_conversations
  add constraint rentivo_conversations_operator_user_id_fkey
  foreign key (operator_user_id) references auth.users(id) on delete set null;

alter table public.rentivo_disputes
  drop constraint if exists rentivo_disputes_resolved_by_auth_id_fkey;
alter table public.rentivo_disputes
  add constraint rentivo_disputes_resolved_by_auth_id_fkey
  foreign key (resolved_by_auth_id) references auth.users(id) on delete set null;

alter table public.rentivo_operator_staff
  drop constraint if exists rentivo_operator_staff_user_id_fkey;
alter table public.rentivo_operator_staff
  add constraint rentivo_operator_staff_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.rentivo_referrals
  drop constraint if exists rentivo_referrals_referred_user_id_fkey;
alter table public.rentivo_referrals
  add constraint rentivo_referrals_referred_user_id_fkey
  foreign key (referred_user_id) references auth.users(id) on delete set null;

-- These two are NOT NULL, so SET NULL is not available. An admin log entry and a
-- referral both belong to the person who made them; when that person is erased
-- the row has no subject left, so it goes with them. Neither is retained for a
-- financial or legal obligation the way a booking is.
alter table public.rentivo_admin_logs
  drop constraint if exists rentivo_admin_logs_admin_auth_id_fkey;
alter table public.rentivo_admin_logs
  add constraint rentivo_admin_logs_admin_auth_id_fkey
  foreign key (admin_auth_id) references auth.users(id) on delete cascade;

alter table public.rentivo_referrals
  drop constraint if exists rentivo_referrals_referrer_user_id_fkey;
alter table public.rentivo_referrals
  add constraint rentivo_referrals_referrer_user_id_fkey
  foreign key (referrer_user_id) references auth.users(id) on delete cascade;
