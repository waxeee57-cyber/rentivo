import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

export interface PricingSuggestion {
  suggested_min: number
  suggested_avg: number
  suggested_max: number
  current_price: number
  comparable_count: number
  insight: string
}

const MOCK_SUGGESTION: PricingSuggestion = {
  suggested_min: 45,
  suggested_avg: 68,
  suggested_max: 95,
  current_price: 60,
  comparable_count: 12,
  insight: 'Your price is slightly below market average. Consider raising to €70-75/day for peak season to maximize revenue while staying competitive.',
}

export async function getPricingSuggestions(
  listing_id: string,
  city: string,
  category: string,
  current_price: number
): Promise<PricingSuggestion> {
  if (Config.useMock) return MOCK_SUGGESTION

  const { data, error } = await supabase.functions.invoke('pricing-suggestions', {
    body: { listing_id, city, category, current_price }
  })
  if (error) throw error
  return data as PricingSuggestion
}
