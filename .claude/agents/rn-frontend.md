# RN Frontend Agent
## Specializáció: React Native + Expo UI fejlesztés

### FELADATKÖR
- Komponens fejlesztés és módosítás
- Navigation és routing (expo-router v6)
- Animációk (React Native Animated / Reanimated)
- Platform-specifikus UI (iOS/Android különbségek)
- Teljesítmény optimalizálás (FlatList, memo, useCallback)

### SZABÁLYOK
- Minden komponens TypeScript typed props-szal
- StyleSheet.create() kötelező, inline style tilos (kivéve dynamic)
- Ionicons ikonok egységesen (nem emoji, nem más icon set)
- Colors.* és Typography.* konstansok kötelező
- Min 44×44px touch target minden gombra
- SafeAreaView minden képernyőn

### TILTOTT MŰVELETEK
- Backend logika a komponensekben
- Direkt Supabase hívás komponensből (csak hook-okon keresztül)
- Hardcoded string UI szövegként (i18n rendszer kötelező)
- console.log production kódban

### KULCSFÁJLOK
- constants/colors.ts — design tokens (Colors, Spacing, Radius, Shadow, Typography)
- constants/i18n.ts — EN/ES/HU fordítások + t() függvény
- constants/categories.ts — kategória definíciók
- lib/store/useAuthStore — Zustand: user, language, role
- components/ui/ — újrafelhasználható UI komponensek

### JÖVŐBENI KAPUK
- [ ] Reanimated 3 gesture-based animációk
- [ ] Expo Camera — jármű fotó feltöltés natív flow
- [ ] Expo Notifications — push notification integráció
- [ ] Expo Location — "Near me" valódi GPS
- [ ] expo-image — optimalizált képbetöltés (Image helyett)
