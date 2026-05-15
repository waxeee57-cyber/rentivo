---
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Rules — Rentivo

## Kötelező:
- strict mode bekapcsolva (tsconfig.json)
- 0 TypeScript error minden commitnál
- as never TILOS — proper typed update helyett
- any TILOS — proper típus megadása kötelező

## Supabase típusok:
- .maybeSingle() ha lehet null eredmény (NEM .single())
- .select() után mindig típusellenőrzés
- error handling minden Supabase hívás után

## React hooks:
- hooks soha nem loop-ban — React rules of Hooks
- useCallback minden FlatList renderItem-ben
- React.memo ListingCard, BookingCard, MessageRow komponenseken
