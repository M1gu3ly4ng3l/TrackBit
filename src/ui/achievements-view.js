import { buildHabitCard } from './habit-card.js';

export function renderAchievements(
  app,
  { habits, categories, defs, unlockedByHabit, expandedHabitId, onToggleHabit, onClose }
) {
  app.innerHTML = '';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-btn';
  back.textContent = '← Volver a hábitos';
  back.addEventListener('click', onClose);
  app.appendChild(back);

  const heading = document.createElement('h2');
  heading.className = 'analytics-heading';
  heading.textContent = 'Logros';
  app.appendChild(heading);

  if (habits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Agrega hábitos para empezar a desbloquear logros.';
    app.appendChild(empty);
    return;
  }

  const intro = document.createElement('p');
  intro.className = 'analytics-intro';
  intro.textContent = 'Toca un hábito para ver sus logros.';
  app.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'achievements-grid';
  for (const habit of habits) {
    grid.appendChild(buildHabitCard(habit, categories, habit.id === expandedHabitId, onToggleHabit));
  }
  app.appendChild(grid);

  if (expandedHabitId) {
    const habit = habits.find((h) => h.id === expandedHabitId);
    if (habit) {
      app.appendChild(buildDetailPanel(habit, defs, unlockedByHabit[habit.id]));
    }
  }
}

function buildDetailPanel(habit, defs, unlocked) {
  const panel = document.createElement('div');
  panel.className = 'achievement-detail-panel';

  if (!unlocked) {
    panel.innerHTML = '<p class="loading">Cargando…</p>';
    return panel;
  }

  const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

  const title = document.createElement('h4');
  title.className = 'heatmap-title';
  title.textContent = `${habit.name} — ${unlockedMap.size} de ${defs.length} desbloqueados`;
  panel.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'achievements-list';
  for (const def of defs) {
    list.appendChild(buildAchievementRow(def, unlockedMap.get(def.id)));
  }
  panel.appendChild(list);
  return panel;
}

function buildAchievementRow(def, unlockedAt) {
  const item = document.createElement('li');
  item.className = `achievement-row ${unlockedAt ? 'unlocked' : 'locked'}`;

  const marker = document.createElement('span');
  marker.className = 'achievement-marker';
  item.appendChild(marker);

  const name = document.createElement('span');
  name.className = 'achievement-name';
  name.textContent = def.name;
  item.appendChild(name);

  if (unlockedAt) {
    const date = document.createElement('span');
    date.className = 'achievement-date';
    date.textContent = formatShortDate(unlockedAt);
    item.appendChild(date);
  }

  return item;
}

function formatShortDate(iso) {
  const date = new Date(iso);
  const label = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
