import { supabase } from './supabase-client.js';

let channel = null;

// Un solo canal escuchando las 4 tablas, filtrado por user_id (RLS ya
// filtra del lado del servidor, esto es nada más para no pedir de más).
export function subscribeToChanges(userId, onChange) {
  unsubscribeFromChanges();
  channel = supabase
    .channel(`app-habitos-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` }, onChange)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'unlocked_achievements', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
  return channel;
}

export function unsubscribeFromChanges() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
