---
paths: ["supabase/functions/delete-account/**", "app/**/privacy*", "app/**/consent*", "app/**/delete*"]
---

# EU Legal Compliance Rules — Rentivo

## GDPR Article 17 (delete-account):
1. push_token nullázás: .eq('auth_id', userId) MINDKÉT táblán
2. Listingek: available=false (NEM törölve — orphan elkerülés)
3. Foglalások: guest_name='[DELETED]', user_id (NEM traveler_id)
4. Reviews: user_id = DELETED_USER_ID (NEM null — FK constraint)
5. Audit log minden lépésnél
6. Auth user törlés: UTOLSÓ lépés

## Consent Screen:
- router.replace('/onboarding') NEM '/' (infinite loop)
- marketing_push=false → push_token nullázás
- maybeSingle() NEM single()

## DELETED_USER_ID = '00000000-0000-0000-0000-000000000001'
