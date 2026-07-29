import { currentEntries } from '../data/entries.js';
import { entryIntensity } from './completion.js';
import { toISODate, addDays } from './date-utils.js';

// Una celda por día de los últimos `days`, con un nivel de intensidad
// 0-3 listo para pintarse como el calendario de contribuciones de GitHub.
export async function heatmapData(habit, { days = 91 } = {}) {
  const entries = await currentEntries(habit.id);
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const today = new Date();
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const iso = toISODate(date);
    const entry = byDate.get(iso);
    cells.push({ date: iso, intensity: entry ? entryIntensity(entry, habit) : 0 });
  }
  return cells;
}

// ¿Cumplir habitId A hace más probable cumplir habitId B el mismo día?
export async function correlationBetween(habitIdA, habitIdB) {
  const [entriesA, entriesB] = await Promise.all([currentEntries(habitIdA), currentEntries(habitIdB)]);
  const datesA = new Set(entriesA.map((e) => e.date));
  const datesB = new Set(entriesB.map((e) => e.date));
  const both = [...datesA].filter((d) => datesB.has(d)).length;
  return { bothDays: both, onlyA: datesA.size - both, onlyB: datesB.size - both };
}

// Pendiente: probabilidad de mantener la racha como proceso de
// supervivencia (distribución exponencial sobre el histórico de rachas
// rotas), y mejor hora/día de la semana por hábito.
