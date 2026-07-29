import { supabase } from './supabase-client.js';

// Las definiciones son fijas en código (no dependen del usuario ni
// cambian con frecuencia); solo lo que se desbloquea vive en la base de
// datos, ligado al usuario por RLS.
const DEFAULT_ACHIEVEMENTS = [
  { id: 'streak-3', name: 'Vas arrancando · 3 días seguidos', conditionType: 'streak', conditionValue: 3 },
  { id: 'streak-7', name: 'Una semana seguida', conditionType: 'streak', conditionValue: 7 },
  { id: 'streak-30', name: 'Un mes de racha', conditionType: 'streak', conditionValue: 30 },
  { id: 'streak-100', name: '100 días seguidos', conditionType: 'streak', conditionValue: 100 },
  { id: 'streak-365', name: 'Un año completo', conditionType: 'streak', conditionValue: 365 },
  { id: 'entries-10', name: 'Primeros 10 registros', conditionType: 'total_entries', conditionValue: 10 },
  { id: 'entries-50', name: '50 registros', conditionType: 'total_entries', conditionValue: 50 },
  { id: 'entries-200', name: '200 registros', conditionType: 'total_entries', conditionValue: 200 },
];

export function listAchievementDefs() {
  return DEFAULT_ACHIEVEMENTS;
}

export async function listUnlocked(habitId) {
  const { data, error } = await supabase.from('unlocked_achievements').select('*').eq('habit_id', habitId);
  if (error) throw error;
  return data.map(fromRow);
}

export async function unlock({ habitId, achievementId }) {
  const { data, error } = await supabase
    .from('unlocked_achievements')
    .insert({ habit_id: habitId, achievement_id: achievementId })
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return null; // ya estaba desbloqueado (unique constraint)
    throw error;
  }
  return data ? fromRow(data) : null;
}

function fromRow(row) {
  return { id: row.id, habitId: row.habit_id, achievementId: row.achievement_id, unlockedAt: row.unlocked_at };
}
