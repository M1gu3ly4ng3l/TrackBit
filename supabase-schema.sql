-- Correr esto una sola vez en Supabase: Project → SQL Editor → New query.

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  type text not null default 'binary',
  unit text,
  target numeric,
  frequency text not null default 'daily',
  category_id uuid references categories(id) on delete set null,
  reminder_time text,
  webhook_url text,
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  value jsonb,
  note text,
  logged_at timestamptz not null default now(),
  device_id text,
  deleted boolean not null default false
);

create table unlocked_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  habit_id uuid not null references habits(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique (habit_id, achievement_id)
);

-- La usa únicamente la Edge Function check-reminders (con la service
-- role key, que se salta RLS) para no avisar dos veces el mismo hábito
-- el mismo día. No necesita políticas: nadie más debería tocarla.
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  sent_at timestamptz not null default now(),
  unique (habit_id, date)
);
alter table reminder_log enable row level security;

-- Row Level Security: cada usuario solo ve (y solo puede escribir) sus
-- propias filas. Sin esto, cualquiera con la anon key vería todo.
alter table categories enable row level security;
alter table habits enable row level security;
alter table entries enable row level security;
alter table unlocked_achievements enable row level security;

create policy "own rows" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on unlocked_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Permiso a nivel de tabla (aparte de RLS). Sin esto da 403 aunque las
-- políticas de arriba estén bien.
grant usage on schema public to authenticated;
grant select, insert, update, delete on categories, habits, entries, unlocked_achievements to authenticated;

-- Igual para service_role: aunque se salta RLS, sigue necesitando el
-- permiso a nivel de tabla. Lo usa la Edge Function check-reminders.
grant usage on schema public to service_role;
grant select, insert, update, delete on categories, habits, entries, unlocked_achievements, reminder_log to service_role;

-- Bucket de Storage para las imágenes de hábitos. Lectura pública (para
-- que las imágenes carguen sin firmar URLs), escritura solo para el
-- usuario autenticado.
insert into storage.buckets (id, name, public)
values ('habit-images', 'habit-images', true)
on conflict (id) do nothing;

create policy "public read habit images"
on storage.objects for select
using (bucket_id = 'habit-images');

create policy "authenticated upload habit images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'habit-images');

create policy "authenticated update habit images"
on storage.objects for update
to authenticated
using (bucket_id = 'habit-images');

create policy "authenticated delete habit images"
on storage.objects for delete
to authenticated
using (bucket_id = 'habit-images');

-- Realtime: para que un cambio en un dispositivo se refleje en los
-- demás sin tener que refrescar a mano. RLS sigue aplicando también acá
-- — cada usuario solo recibe cambios de sus propias filas.
alter publication supabase_realtime add table habits, entries, categories, unlocked_achievements;

-- Por defecto, un evento DELETE solo trae el id de la fila borrada, no
-- el resto de columnas — y como el filtro de Realtime es por user_id,
-- sin esto los borrados no le llegan a nadie (el filtro no encuentra
-- user_id en el payload y lo descarta). REPLICA IDENTITY FULL hace que
-- el DELETE también incluya la fila completa.
alter table habits replica identity full;
alter table entries replica identity full;
alter table categories replica identity full;
alter table unlocked_achievements replica identity full;
