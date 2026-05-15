#!/bin/bash
# Pre-commit hook — DomRol quality gate

echo "🔍 Running DomRol quality checks..."

# TypeScript check
echo "📝 TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Fix before committing."
  exit 1
fi

# Dangerous pattern check
echo "🔒 Security scan..."
if grep -r "service_role\|SUPABASE_SERVICE" --include="*.tsx" --include="*.ts" app/ components/ 2>/dev/null | grep -v "// SAFE:"; then
  echo "❌ Service role key detected in client code!"
  exit 1
fi

if grep -r "console\.log" --include="*.tsx" --include="*.ts" app/ components/ 2>/dev/null | grep -v "// DEBUG:"; then
  echo "⚠️  console.log found in production code. Remove before committing."
  exit 1
fi

# Check for hardcoded secrets
if grep -rE "(sk_live|sk_test|pk_live|pk_test)_[a-zA-Z0-9]+" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -v ".env"; then
  echo "❌ Hardcoded Stripe key detected!"
  exit 1
fi

echo "✅ All checks passed. Committing..."
exit 0
