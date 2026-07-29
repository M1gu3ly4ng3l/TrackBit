import { supabase } from './supabase-client.js';
import { getDeviceId } from './db.js';

// Mismo patrón append-only de siempre, ahora sobre una tabla de Postgres
// en vez de localStorage: nunca se actualiza ni se borra una fila, solo
// se insertan filas nuevas. El estado vigente se resuelve tomando, por
// fecha, la fila con logged_at más reciente. Fusionar dos dispositivos es
// literalmente traer todas las filas — Postgres ya resuelve el orden.

export async function logEntry({ habitId, date, value, note = null }) {
  return appendEvent({ habitId, date, value, note, deleted: false });
}

export async function deleteEntry({ habitId, date }) {
  return appendEvent({ habitId, date, value: null, note: null, deleted: true });
}

export async function currentEntries(habitId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('habit_id', habitId)
    .order('logged_at', { ascending: true });
  if (error) throw error;

  const latestByDate = new Map();
  for (const row of data) latestByDate.set(row.date, row);
  return [...latestByDate.values()].filter((row) => !row.deleted).map(fromRow);
}

async function appendEvent({ habitId, date, value, note, deleted }) {
  const { data, error } = await supabase
    .from('entries')
    .insert({ habit_id: habitId, date, value, note, deleted, device_id: getDeviceId() })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

function fromRow(row) {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    value: row.value,
    note: row.note,
    loggedAt: row.logged_at,
    deviceId: row.device_id,
    deleted: row.deleted,
  };
}
