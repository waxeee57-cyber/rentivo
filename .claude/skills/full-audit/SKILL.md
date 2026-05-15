---
name: full-audit
description: Teljes Rentivo audit — TypeScript, security, mock, accessibility, i18n, legal
---

# Full Audit — Rentivo

## Futtatandó ellenőrzések sorban:

### 1. TypeScript
npx tsc --noEmit

### 2. Console.log
grep -rn "console\." --include="*.ts" --include="*.tsx" --exclude-dir=node_modules app/ lib/ | grep -v "// DEBUG:"

### 3. Hardcoded secrets
grep -rEn "(sk_|pk_)(test|live)_[a-zA-Z0-9]+" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .

### 4. Mock adatok
grep -rn "MOCK_\|Config\.useMock" --include="*.tsx" --exclude-dir=node_modules app/ | grep -v "if (Config.useMock)"

### 5. Dead end gombok
grep -rn "onPress={() => {}}\|onPress={undefined}" --include="*.tsx" --exclude-dir=node_modules app/

### 6. SafeAreaView hiány
find app/ -name "*.tsx" -not -name "_layout.tsx" | xargs grep -L "SafeAreaView\|useSafeAreaInsets" | grep -v "components\|hooks\|modal"

### 7. AccessibilityLabel hiány
grep -rn "TouchableOpacity\|Pressable" --include="*.tsx" --exclude-dir=node_modules app/ | grep -v "accessibilityLabel\|//\|import" | head -20

### 8. Commit ha 0 hiba
git add . && git commit -m "chore: full audit" && git push
