import { currentEntries } from '../data/entries.js';
import { listAchievementDefs, listUnlocked, unlock } from '../data/achievements.js';
import { currentStreak } from './streaks.js';

// Se llama después de cada logEntry. Revisa las condiciones de todos los
// logros para ese hábito y desbloquea los que se acaben de cumplir.
// Una vez desbloqueado, queda desbloqueado aunque la racha se rompa después.
export async function checkAchievements(habit) {
  const defs = listAchievementDefs();
  const [unlockedRows, streak, entries] = await Promise.all([
    listUnlocked(habit.id),
    currentStreak(habit),
    currentEntries(habit.id),
  ]);
  const alreadyUnlocked = new Set(unlockedRows.map((u) => u.achievementId));
  const totalEntries = entries.length;

  const newlyUnlocked = [];
  for (const def of defs) {
    if (alreadyUnlocked.has(def.id)) continue;
    if (!conditionMet(def, { streak, totalEntries })) continue;
    const record = await unlock({ habitId: habit.id, achievementId: def.id });
    if (record) newlyUnlocked.push(def);
  }
  return newlyUnlocked;
}

function conditionMet(def, { streak, totalEntries }) {
  if (def.conditionType === 'streak') return streak >= def.conditionValue;
  if (def.conditionType === 'total_entries') return totalEntries >= def.conditionValue;
  return false;
}
