// Se ejecuta por cron (ver README para la configuración). En cada corrida:
// 1. Busca hábitos con reminder_time ya vencido hoy, que tengan webhook.
// 2. Si ya se marcó hoy, no hace nada.
// 3. Si no, y no se le ha avisado hoy todavía (reminder_log), dispara el
//    webhook con event: 'reminder' — mismo webhookUrl que usa la app al
//    marcar, así que el mismo flujo de n8n/Zapier puede recibir ambos
//    tipos de evento y decidir qué hacer con cada uno.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIMEZONE = 'America/Bogota';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { today, currentTime } = nowInTimezone(TIMEZONE);

  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, name, type, webhook_url, reminder_time')
    .eq('archived', false)
    .not('reminder_time', 'is', null)
    .not('webhook_url', 'is', null)
    .lte('reminder_time', currentTime);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  for (const habit of habits ?? []) {
    const { data: entry } = await supabase
      .from('entries')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('date', today)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle();

    if (entry) continue; // ya se marcó hoy, no hace falta recordar

    // Si ya existe una fila para (habit_id, today), significa que ya se
    // avisó hoy — el unique constraint hace que este insert falle y se
    // salte, sin mandar el webhook de nuevo en la siguiente corrida.
    const { error: logError } = await supabase
      .from('reminder_log')
      .insert({ habit_id: habit.id, date: today });
    if (logError) continue;

    try {
      await fetch(habit.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'reminder',
          habitId: habit.id,
          habitName: habit.name,
          type: habit.type,
          date: today,
          reminderTime: habit.reminder_time,
        }),
      });
      sent++;
    } catch (err) {
      console.error(`No se pudo notificar el recordatorio de "${habit.name}"`, err);
    }
  }

  return new Response(JSON.stringify({ checked: habits?.length ?? 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function nowInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    currentTime: `${get('hour')}:${get('minute')}`,
  };
}
