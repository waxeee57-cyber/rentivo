/**
 * Deliberately empty.
 *
 * `saveContractSignature` lived here, had zero callers, and wrote a DIFFERENT
 * pair of columns from the ones the live signature flow uses: it set
 * `consumer_signature` / `operator_signature` / `contract_signed_at`, while both
 * signing screens write `guest_signature` / `operator_signature_data` plus
 * `contract_status`. Wiring it in would have written the wrong columns and never
 * moved `contract_status`, breaking the handoff between the two parties.
 *
 * Deleting it rather than adding a caller: two competing signature schemas on
 * the same table is how a rental contract ends up with a signature nobody can
 * find. The live path is the two sign screens plus `lib/api/finalizeContract.ts`,
 * which renders and stores the document once both signatures exist.
 */
export {}
