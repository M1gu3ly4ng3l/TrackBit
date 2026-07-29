// frequency se guarda como string plano en el hábito:
//   'daily'                -> todos los días
//   'days:mon,wed,fri'     -> solo esos días de la semana
//   'times_per_week:3'     -> N veces por semana, sin días fijos

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS = { mon: 'lun', tue: 'mar', wed: 'mié', thu: 'jue', fri: 'vie', sat: 'sáb', sun: 'dom' };

export function dayLabel(code) {
  return DAY_LABELS[code] ?? code;
}

export function parseFrequency(raw) {
  if (!raw || raw === 'daily') return { kind: 'daily' };
  if (raw.startsWith('days:')) {
    const days = raw.slice(5).split(',').map((d) => d.trim()).filter(Boolean);
    return days.length ? { kind: 'days', days } : { kind: 'daily' };
  }
  if (raw.startsWith('times_per_week:')) {
    const times = Number(raw.slice('times_per_week:'.length));
    return { kind: 'times_per_week', times: times > 0 ? times : 1 };
  }
  return { kind: 'daily' };
}

export function serializeFrequency(kind, { days = [], times = 1 } = {}) {
  if (kind === 'days') return days.length ? `days:${days.join(',')}` : 'daily';
  if (kind === 'times_per_week') return `times_per_week:${times}`;
  return 'daily';
}

export function isScheduledDay(frequency, date) {
  if (frequency.kind === 'days') {
    return frequency.days.includes(DAY_CODES[date.getDay()]);
  }
  return true; // 'daily' y 'times_per_week': cualquier día es válido para marcar
}

export function frequencyLabel(frequency) {
  if (frequency.kind === 'days') return frequency.days.map(dayLabel).join(', ');
  if (frequency.kind === 'times_per_week') return `${frequency.times}x por semana`;
  return 'diario';
}
