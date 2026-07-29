import { supabase } from './supabase-client.js';

export async function listHabits({ includeArchived = false } = {}) {
  let query = supabase.from('habits').select('*').order('created_at');
  if (!includeArchived) query = query.eq('archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(fromRow);
}

export async function getHabit(id) {
  const { data, error } = await supabase.from('habits').select('*').eq('id', id).single();
  if (error) throw error;
  return fromRow(data);
}

export async function createHabit({
  name,
  type = 'binary', // 'binary' | 'quantity' | 'duration' | 'scale'
  unit = null,
  target = null,
  frequency = 'daily', // 'daily' | 'days:mon,wed,fri' | 'times_per_week:3'
  categoryId = null,
  webhookUrl = null,
  reminderTime = null,
  imageUrl = null,
}) {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      name,
      type,
      unit,
      target,
      frequency,
      category_id: categoryId,
      webhook_url: webhookUrl,
      reminder_time: reminderTime,
      image_url: imageUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateHabit(id, patch) {
  const { data, error } = await supabase.from('habits').update(toRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function archiveHabit(id) {
  return updateHabit(id, { archived: true });
}

export async function restoreHabit(id) {
  return updateHabit(id, { archived: false });
}

export async function deleteHabit(id) {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) throw error;
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    unit: row.unit,
    target: row.target,
    frequency: row.frequency,
    categoryId: row.category_id,
    reminderTime: row.reminder_time,
    webhookUrl: row.webhook_url,
    imageUrl: row.image_url,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

function toRow(patch) {
  const row = {};
  if ('categoryId' in patch) row.category_id = patch.categoryId;
  if ('webhookUrl' in patch) row.webhook_url = patch.webhookUrl;
  if ('reminderTime' in patch) row.reminder_time = patch.reminderTime;
  if ('imageUrl' in patch) row.image_url = patch.imageUrl;
  for (const key of ['name', 'type', 'unit', 'target', 'frequency', 'archived']) {
    if (key in patch) row[key] = patch[key];
  }
  return row;
}
