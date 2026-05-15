# TypeScript Guard

## Szabályok
- Nincs `any` — proper type vagy `unknown`
- Nincs `@ts-ignore` — javítsd a hibát
- Nincs szükségtelen non-null assertion (!)
- Minden function paraméter típusos
- Minden API response typed types/index.ts-ből
- useLocalSearchParams<{param: string}>() mindig typed

## Ellenőrzés minden fájl változásnál
1. Minden prop típusos?
2. Minden Supabase query typed?
3. Minden route param typed?
4. Return type explicit public funkciókon?
