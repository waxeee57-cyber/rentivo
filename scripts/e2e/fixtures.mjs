/**
 * Who owns what, so the suites cannot collide.
 *
 * Every suite passed on its own and several failed when run together. A safety
 * net that only works when you use it one strand at a time is not a safety net:
 * the whole point is to run the lot before shipping, and the failures it
 * produced there were noise, which is how a team learns to ignore red.
 *
 * Four collisions caused all of it:
 *   1. Shared LISTINGS. Two suites booking the same vehicle fight over the
 *      double-booking guard and over rentivo_availability rows.
 *   2. Overlapping DATE WINDOWS. The contract suite exhausted +150..+188 because
 *      three other suites had been booking into it, and then failed with "no
 *      free window" — a fixture problem wearing a product bug's clothes.
 *   3. Shared OPERATOR STATE. identity-gate flips requires_identity_verification
 *      on its operator; every other suite booking the shared operator's listings
 *      then got 403 "Identity verification required" from a gate that is working
 *      exactly as designed. admin.mjs suspends an operator for the same reason.
 *   4. Shared ACCOUNTS. admin.mjs bans a user mid-run, and until now that user
 *      was the same account gdpr.mjs and identity-gate.mjs were booking with.
 *
 * The fix is ownership, not coordination: one listing and one date window per
 * suite, a private operator for any suite that mutates operator-level state, and
 * a private account for any suite that mutates account-level state. A suite can
 * then only collide with itself.
 *
 * NOTHING here points at production data or at the project owner's account.
 * Seed with scripts/e2e/seed-fixtures.sql (applied 2026-08-06).
 */

/** Operator whose Connect account is live, shared by suites that only READ it. */
export const SHARED_OPERATOR = {
  id: 'b1e2c3d4-0000-4e2e-9000-0000000000e2',
  authId: 'e59ac702-a6aa-428d-a3b3-7f116a34cfdd',
  email: 'e2e-operator@rentivo.domrol.com',
  password: 'e2e-Operator-Pass-2026!',
}

/**
 * Suites that MUTATE operator-level state get one nobody else reads.
 *
 * `admin` was added because admin.mjs used to approve/suspend the seeded "Test
 * Operator", whose auth_id is the PROJECT OWNER's account. Suspending it for the
 * length of a run is both a collision and a thing this suite has no business
 * doing. The sanction operator below owns no listings: it exists to be
 * approved, suspended and put back.
 */
export const PRIVATE_OPERATORS = {
  identity: 'e2e0ec70-0000-4e2e-9000-000000000101',
  onboarding: 'ca15fc15-e4d1-46a8-889d-5a6d2f002199',
  cancellation: 'e2ecafe1-0000-4e2e-9000-0000000000aa',
  admin: 'e2eadd11-0000-4e2e-9000-0000000000ad',
}

/** The one host record the host suite owns. */
export const PRIVATE_HOSTS = {
  host: 'fd979e4f-2fad-4322-8cc1-6bf9320b4187',
}

/**
 * Date windows are disjoint AND wide enough for the busiest suite.
 * cancellation-matrix books 21 times, so it gets the largest slice.
 *
 * `owner` is the row that must own the listing. It is asserted at startup, and
 * it is the check that would have caught the two mistakes this file shipped
 * with: `cancellation` pointed at the seeded Porsche Cayenne and `host` at
 * "Villa Sol", both of which belong to the PROJECT OWNER's account. A window
 * that is disjoint on paper means nothing if the listing under it is somebody
 * else's vehicle.
 */
const OP = SHARED_OPERATOR.id

export const FIXTURES = {
  money:        { listing: 'e2e11111-0000-4e2e-9000-000000000001', from: 20,  to: 60,  owner: { operator: OP } },
  contract:     { listing: 'e2e11111-0000-4e2e-9000-000000000002', from: 70,  to: 110, owner: { operator: OP } },
  damage:       { listing: 'e2e11111-0000-4e2e-9000-00000000da11', from: 120, to: 160, owner: { operator: OP } },
  messaging:    { listing: 'e2e11111-0000-4e2e-9000-000000000003', from: 170, to: 210, owner: { operator: OP } },
  gdpr:         { listing: 'e2e11111-0000-4e2e-9000-000000000004', from: 220, to: 260, owner: { operator: OP } },
  identity:     { listing: 'e2e11111-0000-4e2e-9000-000000000005', from: 270, to: 300, owner: { operator: PRIVATE_OPERATORS.identity } },
  admin:        { listing: 'e2e11111-0000-4e2e-9000-000000000006', from: 310, to: 340, owner: { operator: OP } },
  // The matrix needs one listing per (policy x canceller) so two cells in
  // different timing bands never collide on rentivo_bookings_no_overlap. They
  // all belong to the private cancellation operator; `listing` below is the
  // shared "scenarios" one the non-matrix cases use.
  cancellation: { listing: 'e2ecafe1-0000-4e2e-9000-000000000008', from: 350, to: 420, owner: { operator: PRIVATE_OPERATORS.cancellation } },
  host:         { listing: '93ae9c54-5283-44a5-ac97-6b8a743b2979', from: 430, to: 470, owner: { host: PRIVATE_HOSTS.host } },
  // Deliberately parked (available = false) between runs: an operator who never
  // finished Connect onboarding must not leave a bookable listing on the
  // marketplace. The suite un-parks it for the length of its own run, which is
  // why it asserts its fixture with requireAvailable: false.
  onboarding:   { listing: '8f218af1-fab9-4aca-b942-ac058d3be18a', from: 480, to: 510, owner: { operator: PRIVATE_OPERATORS.onboarding } },
}

/** Every cancellation-matrix listing, by role. All under PRIVATE_OPERATORS.cancellation. */
export const CANCELLATION_LISTINGS = {
  flexTraveler: 'e2ecafe1-0000-4e2e-9000-000000000001',
  modTraveler:  'e2ecafe1-0000-4e2e-9000-000000000002',
  strTraveler:  'e2ecafe1-0000-4e2e-9000-000000000003',
  modOdd:       'e2ecafe1-0000-4e2e-9000-000000000004',
  flexOwner:    'e2ecafe1-0000-4e2e-9000-000000000005',
  modOwner:     'e2ecafe1-0000-4e2e-9000-000000000006',
  strOwner:     'e2ecafe1-0000-4e2e-9000-000000000007',
  scenarios:    'e2ecafe1-0000-4e2e-9000-000000000008',
}

/**
 * Assert at startup that the fixture is really there and really ours.
 *
 * A suite that silently books somebody else's vehicle is worse than one that
 * fails: it passes, and it corrupts the run it collided with. So the check is
 * not "a listing with this id exists" but "this listing is owned by the row this
 * suite is allowed to touch".
 *
 * `requireAvailable` is opt-out for the one fixture that is parked on purpose
 * between runs (see FIXTURES.onboarding). Everywhere else a paused listing means
 * an earlier run died half way through and left the fixture unusable, which is
 * worth failing on rather than booking around.
 */
export async function assertFixture(sb, name, token, { requireAvailable = true } = {}) {
  const fixture = FIXTURES[name]
  if (!fixture) throw new Error(`No fixture declared for suite "${name}"`)
  const res = await sb(
    `/rest/v1/rentivo_listings?id=eq.${fixture.listing}`
    + '&select=id,title,available,operator_id,host_id,owner_type,price_per_day,deposit_amount,cancellation_policy',
    {}, token,
  )
  const row = Array.isArray(res.body) ? res.body[0] : null
  if (!row) {
    throw new Error(
      `Fixture listing ${fixture.listing} for suite "${name}" is missing or not readable. ` +
      `Re-seed with scripts/e2e/seed-fixtures.sql.`,
    )
  }
  const wantOperator = fixture.owner?.operator ?? null
  const wantHost = fixture.owner?.host ?? null
  if (wantOperator && row.operator_id !== wantOperator) {
    throw new Error(
      `Fixture listing for "${name}" is owned by operator ${row.operator_id}, not ${wantOperator}. ` +
      `Booking it would put this suite on somebody else's vehicle.`,
    )
  }
  if (wantHost && row.host_id !== wantHost) {
    throw new Error(
      `Fixture listing for "${name}" is owned by host ${row.host_id}, not ${wantHost}. ` +
      `Booking it would put this suite on somebody else's vehicle.`,
    )
  }
  if (requireAvailable && row.available !== true) {
    throw new Error(`Fixture listing for "${name}" is paused; a previous run left it unavailable.`)
  }
  return { ...fixture, row }
}
