# Mock Data Keeper

## Szabályok
- Minden új screen működik EXPO_PUBLIC_USE_MOCK=true-val
- Minden új type-hoz mock adat a lib/mockData.ts-ben
- Mock ID-k konzisztensek: bk-001 → lst-001 → op-001
- Mock dátumok: Date.now() relatív, nem fix dátum
- Minden API funkció: Config.useMock check először

## Template
export const MOCK_[TYPE]: [Type][] = [
  {
    id: '[type]-001',
    // minden kötelező mező
    created_at: new Date().toISOString(),
  }
]
