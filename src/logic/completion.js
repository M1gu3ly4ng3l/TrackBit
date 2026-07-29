// Qué cuenta como "cumplido" depende del tipo de hábito. Vive aparte de
// streaks.js porque analíticas u otras vistas también lo van a necesitar.

export function isEntryCompleted(entry, habit) {
  if (entry.value === null || entry.value === undefined) return false;

  switch (habit.type) {
    case 'binary':
      return entry.value === true;
    case 'quantity':
    case 'duration':
      return habit.target != null ? entry.value >= habit.target : entry.value > 0;
    case 'scale':
      // Cualquier registro cuenta para la racha; el valor es informativo,
      // no un umbral de aprobado/reprobado.
      return true;
    default:
      return Boolean(entry.value);
  }
}

// Nivel de intensidad (0-3) para pintar el heatmap. Binario es todo o
// nada; cantidad/duración se gradúan según qué tan cerca de la meta
// quedó ese día; escala se gradúa según el valor mismo.
export function entryIntensity(entry, habit) {
  if (entry.value === null || entry.value === undefined) return 0;

  if (habit.type === 'binary') return entry.value === true ? 3 : 0;

  if (habit.type === 'scale') {
    const value = Number(entry.value);
    if (value <= 0) return 0;
    return Math.min(3, Math.ceil((value / 5) * 3));
  }

  if (habit.type === 'quantity' || habit.type === 'duration') {
    const value = Number(entry.value) || 0;
    if (value <= 0) return 0;
    if (!habit.target) return 2;
    const ratio = value / habit.target;
    if (ratio >= 1) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  }

  return entry.value ? 2 : 0;
}
