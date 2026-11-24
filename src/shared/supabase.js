import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://nxklefifotgvwasnqdxq.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_IoM7aaQvmgDettdIekhV6w_nCoMDiO_'

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
})

export function subscribeSeatLocks(tripId, onChange) {
  const channel = supabase
    .channel(`seat-locks-${tripId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'seat_locks',
      filter: `id_viaje=eq.${tripId}`,
    }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
