import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

type SupportedLanguage = 'en' | 'es' | 'hu' | 'de' | 'fr' | 'pt'

export async function translateMessage(text: string, targetLanguage: SupportedLanguage): Promise<string> {
  if (Config.useMock) {
    return `[Translated to ${targetLanguage}] ${text}`
  }

  const { data, error } = await supabase.functions.invoke('translate-message', {
    body: { text, target_language: targetLanguage }
  })
  if (error) throw error
  return (data as { translated: string }).translated
}
