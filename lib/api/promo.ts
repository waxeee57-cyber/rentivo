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
    is_active: true,
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
    is_active: true,
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
    is_active: true,
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

  // Through the lookup function, NOT the table.
  //
  // Selecting from rentivo_promo_codes used to work for anyone, filter or no
  // filter, so `select *` handed a stranger every live campaign — code, percent,
  // cap and uses remaining. A promo code is worth exactly as much as the fact
  // that only its recipient knows it, so the table is no longer readable and
  // rentivo_lookup_promo answers for ONE code you already have.
  //
  // It returns the row raw and leaves the verdict here on purpose: the three
  // checks below mirror create-booking, and pushing them into SQL would let the
  // client's "Promo applied" and the server's actual charge drift apart again.
  const { data: found, error } = await supabase
    .rpc('rentivo_lookup_promo', { p_code: code.toUpperCase().trim() })
  const data = Array.isArray(found) ? found[0] ?? null : (found ?? null)

  // An infrastructure failure (network drop, RLS denial) is NOT a wrong code. Telling
  // the guest "Invalid promo code" makes them give up on a discount that is actually
  // valid; the distinct message invites a retry instead.
  if (error) {
    return {
      valid: false,
      code: null,
      discount: 0,
      error: "Couldn't check the code right now — please try again",
    }
  }
  if (!data) return { valid: false, code: null, discount: 0, error: 'Invalid promo code' }

  const promo = data as PromoCode

  // These three checks MIRROR create-booking. They were missing here, so the
  // screen showed "Promo applied: -€49.50" and a Pay button with the discounted
  // total, while the server dropped the code and charged the full price. The
  // renter paid more than the button they tapped said — the worst kind of
  // pricing bug, because it looks like a bait and switch rather than an error.
  //
  // `is_active` was added in migration 20260805004 and nothing read it here.
  if (promo.is_active === false) {
    return { valid: false, code: null, discount: 0, error: 'Invalid promo code' }
  }
  if (promo.valid_from && new Date(promo.valid_from) > new Date()) {
    return { valid: false, code: null, discount: 0, error: 'Promo code is not active yet' }
  }
  // `max_uses` NULL means unlimited. `0 >= null` coerces to `0 >= 0` = true, so
  // an unlimited code used to read as exhausted on its very first use.
  if (promo.max_uses != null && promo.current_uses >= promo.max_uses) {
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
