// Template: új API funkció
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import type { YourType } from '@/types'

export async function fetchYourData(
  id: string
): Promise<YourType | null> {
  if (Config.useMock) {
    // return MOCK_YOUR_DATA.find(item => item.id === id) ?? null
    return null
  }

  const { data, error } = await supabase
    .from('rentivo_your_table')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('fetchYourData:', error.message)
    return null
  }

  return data as YourType
}
