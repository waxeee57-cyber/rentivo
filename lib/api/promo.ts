import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import type { PromoCode } from '@/types'

export interface PromoValidationResult {
  valid: boolean
  code: PromoCode | null
  discount: number
  error?: string
}

const MOCK_PROMOS: PromoCode[] = [
  {
    id: 'promo-001',
    code: 'WELCOME10',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 1000,
    current_uses: 0,
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: null,
    min_booking_value: 0,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'promo-002',
    code: 'MARBELLA20',
    discount_type: 'percent',
    discount_value: 20,
    max_uses: 500,
    current_uses: 0,
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: null,
    min_booking_value: 100,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'promo-003',
    code: 'SUMMER50',
    discount_type: 'fixed',
    discount_value: 50,
    max_uses: 200,
    current_uses: 0,
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: null,
    min_booking_value: 200,
    created_at: '2026-01-01T00:00:00Z',
  },
]

export async function validatePromoCode(
  code: string,
  bookingTotal: number,
): Promise<PromoValidationResult> {
  if (Config.useMock) {
    const promo = MOCK_PROMOS.find(p => p.code === code.toUpperCase().trim())
    if (!promo) return { valid: false, code: null, discount: 0, error: 'Invalid promo code' }
    if (bookingTotal < promo.min_booking_value) {
      return {
        valid: false,
        code: null,
        discount: 0,
        error: `Minimum booking value: €${promo.min_booking_value}`,
      }
    }
    const discount =
      promo.discount_type === 'percent'
        ? Math.round((bookingTotal * promo.discount_value) / 100 * 100) / 100
        : Math.min(promo.discount_value, bookingTotal)
    return { valid: true, code: promo, discount }
  }

  const { data, error } = await supabase
    .from('rentivo_promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (error || !data) return { valid: false, code: null, discount: 0, error: 'Invalid promo code' }

  const promo = data as PromoCode

  if (promo.current_uses >= promo.max_uses) {
    return { valid: false, code: null, discount: 0, error: 'Promo code has expired' }
  }
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
    return { valid: false, code: null, discount: 0, error: 'Promo code has expired' }
  }
  if (bookingTotal < promo.min_booking_value) {
    return {
      valid: false,
      code: null,
      discount: 0,
      error: `Minimum booking value: €${promo.min_booking_value}`,
    }
  }

  const discount =
    promo.discount_type === 'percent'
      ? Math.round((bookingTotal * promo.discount_value) / 100 * 100) / 100
      : Math.min(promo.discount_value, bookingTotal)

  return { valid: true, code: promo, discount }
}
