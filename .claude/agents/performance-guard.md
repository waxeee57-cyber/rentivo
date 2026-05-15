# Performance Guard

## React Native teljesítmény szabályok
- FlatList: initialNumToRender=6, removeClippedSubviews=true
- Képek: expo-image transition=200 + fallback
- Animációk: useSharedValue + useAnimatedStyle
- Nehéz számítások: useMemo / useCallback
- Felesleges re-render: React.memo ahol kell

## Ellenőrzés
- [ ] Nincs inline StyleSheet (define outside component)
- [ ] Nincs anonymous function prop (useCallback)
- [ ] Képek optimalizálva (max 800px wide)
- [ ] Lista komponensek kulcsolt (keyExtractor)
