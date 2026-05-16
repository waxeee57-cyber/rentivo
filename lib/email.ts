import { supabase } from '@/lib/supabase'

type EmailTemplate =
  | 'operator_welcome'
  | 'booking_confirmed_guest'
  | 'booking_confirmed_operator'
  | 'booking_cancelled_guest'
  | 'booking_cancelled_operator'
  | 'identity_verified'

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, string | number>
): Promise<void> {
  await supabase.functions.invoke('send-email', {
    body: { to, template, data }
  })
}
