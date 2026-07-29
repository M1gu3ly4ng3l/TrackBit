// "Fire and forget": si el webhook falla, no bloquea ni revierte el
// registro, solo queda un warning en consola. El payload trae lo mínimo
// para que una automatización (n8n, Zapier, Make...) decida qué hacer.
export async function notifyWebhook(habit, entry) {
  if (!habit.webhookUrl) return;
  try {
    await fetch(habit.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'logged',
        habitId: habit.id,
        habitName: habit.name,
        type: habit.type,
        date: entry.date,
        value: entry.value,
        loggedAt: entry.loggedAt,
      }),
    });
  } catch (err) {
    console.warn(`No se pudo notificar el webhook de "${habit.name}"`, err);
  }
}
