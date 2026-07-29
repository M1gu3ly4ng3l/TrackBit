import { currentEntries } from '../data/entries.js';
import { isEntryCompleted } from './completion.js';
import { parseFrequency, isScheduledDay } from './frequency.js';
import { toISODate, addDays } from './date-utils.js';

// La racha nunca se guarda como campo aparte: se calcula siempre a partir
// de los eventos + la frecuencia del hábito. Guardarla como estado propio
// es otra fuente de bugs de sync, el mismo patrón que ya se vivió en la
// bitácora. Ahora currentEntries es async (viene de Supabase), así que
// todo lo que depende de ella también lo es.

export async function currentStreak(habit, { today = new Date() } = {}) {
  const frequency = parseFrequency(habit.frequency);
  return frequency.kind === 'times_per_week'
    ? currentWeeklyStreak(habit, frequency, today)
    : currentDailyStreak(habit, frequency, today);
}

export async function longestStreak(habit) {
  const frequency = parseFrequency(habit.frequency);
  return frequency.kind === 'times_per_week'
    ? longestWeeklyStreak(habit, frequency)
    : longestDailyStreak(habit, frequency);
}

async function completedDateSet(habit) {
  const entries = await currentEntries(habit.id);
  return new Set(entries.filter((e) => isEntryCompleted(e, habit)).map((e) => e.date));
}

// --- diario / días específicos ---

async function currentDailyStreak(habit, frequency, today) {
  const done = await completedDateSet(habit);
  const todayISO = toISODate(today);
  let streak = 0;
  let cursor = new Date(today);
  let first = true;
  while (streak <= 3650) {
    const iso = toISODate(cursor);
    if (isScheduledDay(frequency, cursor)) {
      if (done.has(iso)) {
        streak++;
      } else if (first && iso === todayISO) {
        // hoy toca pero todavía no se marca: no rompe la racha todavía
      } else {
        break;
      }
    }
    first = false;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

async function longestDailyStreak(habit, frequency) {
  const done = await completedDateSet(habit);
  const doneDates = [...done].sort();
  let longest = 0;
  let current = 0;
  let prevDate = null;
  for (const dateStr of doneDates) {
    const date = new Date(dateStr);
    current = prevDate && toISODate(previousScheduledDay(frequency, date)) === prevDate ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevDate = dateStr;
  }
  return longest;
}

function previousScheduledDay(frequency, date) {
  let cursor = addDays(date, -1);
  let guard = 0;
  while (!isScheduledDay(frequency, cursor) && guard < 7) {
    cursor = addDays(cursor, -1);
    guard++;
  }
  return cursor;
}

// --- X veces por semana ---

function weekStart(date) {
  const d = new Date(date);
  const isoDay = (d.getDay() + 6) % 7; // lunes = 0
  d.setHours(0, 0, 0, 0);
  return addDays(d, -isoDay);
}

async function completionsInWeek(habit, weekStartDate) {
  const start = toISODate(weekStartDate);
  const end = toISODate(addDays(weekStartDate, 6));
  const entries = await currentEntries(habit.id);
  return entries.filter((e) => isEntryCompleted(e, habit)).filter((e) => e.date >= start && e.date <= end).length;
}

async function currentWeeklyStreak(habit, frequency, today) {
  let streak = 0;
  let cursor = weekStart(today);
  const currentWeekISO = toISODate(cursor);
  let first = true;
  while (streak <= 520) {
    const count = await completionsInWeek(habit, cursor);
    if (count >= frequency.times) {
      streak++;
    } else if (first && toISODate(cursor) === currentWeekISO) {
      // semana en curso: todavía se puede completar
    } else {
      break;
    }
    first = false;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

async function longestWeeklyStreak(habit, frequency) {
  const done = await completedDateSet(habit);
  if (done.size === 0) return 0;

  const counts = new Map();
  for (const dateStr of done) {
    const ws = toISODate(weekStart(new Date(dateStr)));
    counts.set(ws, (counts.get(ws) || 0) + 1);
  }
  const qualifyingWeeks = [...counts.entries()]
    .filter(([, count]) => count >= frequency.times)
    .map(([ws]) => ws)
    .sort();

  let longest = 0;
  let current = 0;
  let prevWeek = null;
  for (const ws of qualifyingWeeks) {
    current = prevWeek && toISODate(addDays(new Date(prevWeek), 7)) === ws ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevWeek = ws;
  }
  return longest;
}
