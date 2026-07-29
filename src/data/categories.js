import { supabase } from './supabase-client.js';

const PALETTE = ['#e07a5f', '#3d5a80', '#81b29a', '#f2cc8f', '#9d8189', '#606c38'];

export async function listCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data.map(fromRow);
}

export async function createCategory({ name, color = null }) {
  const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, color: color ?? PALETTE[(count ?? 0) % PALETTE.length] })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

function fromRow(row) {
  return { id: row.id, name: row.name, color: row.color };
}
