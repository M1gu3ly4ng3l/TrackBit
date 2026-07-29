import { buildHabitCard } from './habit-card.js';

export function renderAnalytics(
  app,
  { habits, categories, heatmapsByHabit, expandedHabitId, onToggleHabit, correlation, correlationSelection, onCorrelationChange, onClose }
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
  heading.textContent = 'Analíticas';
  app.appendChild(heading);

  if (habits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Agrega hábitos para empezar a ver sus gráficas.';
    app.appendChild(empty);
    return;
  }

  const intro = document.createElement('p');
  intro.className = 'analytics-intro';
  intro.textContent = 'Toca un hábito para ver su consistencia de los últimos ~91 días.';
  app.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'achievements-grid';
  for (const habit of habits) {
    grid.appendChild(buildHabitCard(habit, categories, habit.id === expandedHabitId, onToggleHabit));
  }
  app.appendChild(grid);

  if (expandedHabitId) {
    const habit = habits.find((h) => h.id === expandedHabitId);
    if (habit) app.appendChild(buildHeatmapPanel(habit, heatmapsByHabit[habit.id]));
  }

  app.appendChild(buildCorrelationPanel(habits, correlation, correlationSelection, onCorrelationChange));
}

function buildHeatmapPanel(habit, cells) {
  const panel = document.createElement('div');
  panel.className = 'achievement-detail-panel';

  if (!cells) {
    panel.innerHTML = '<p class="loading">Cargando…</p>';
    return panel;
  }

  const title = document.createElement('h4');
  title.className = 'heatmap-title';
  title.textContent = habit.name;
  panel.appendChild(title);
  panel.appendChild(buildHeatmapGrid(cells));
  return panel;
}

function buildHeatmapGrid(cells) {
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  for (const cell of cells) {
    const square = document.createElement('span');
    square.className = `heatmap-cell heatmap-cell--${cell.intensity}`;
    square.title = cell.date;
    grid.appendChild(square);
  }
  return grid;
}

function buildCorrelationPanel(habits, correlation, selection, onChange) {
  const panel = document.createElement('div');
  panel.className = 'correlation-panel';

  const title = document.createElement('h4');
  title.textContent = 'Correlación entre hábitos';
  panel.appendChild(title);

  if (habits.length < 2) {
    const note = document.createElement('p');
    note.className = 'correlation-note';
    note.textContent = 'Necesitas al menos 2 hábitos activos para comparar.';
    panel.appendChild(note);
    return panel;
  }

  const selectors = document.createElement('div');
  selectors.className = 'correlation-selectors';
  const options = habits.map((h) => `<option value="${h.id}">${h.name}</option>`).join('');
  selectors.innerHTML = `
    <select name="habitA"><option value="">Elige un hábito…</option>${options}</select>
    <span>vs</span>
    <select name="habitB"><option value="">Elige un hábito…</option>${options}</select>
  `;
  const selectA = selectors.querySelector('[name="habitA"]');
  const selectB = selectors.querySelector('[name="habitB"]');
  if (selection?.a) selectA.value = selection.a;
  if (selection?.b) selectB.value = selection.b;

  const emitChange = () => onChange(selectA.value || null, selectB.value || null);
  selectA.addEventListener('change', emitChange);
  selectB.addEventListener('change', emitChange);
  panel.appendChild(selectors);

  if (selection?.a && selection?.b && !correlation) {
    const loading = document.createElement('p');
    loading.className = 'correlation-note loading';
    loading.textContent = 'Cargando…';
    panel.appendChild(loading);
  } else if (correlation) {
    const result = document.createElement('p');
    result.className = 'correlation-result';
    result.textContent = `Mismo día: ${correlation.bothDays} · solo el primero: ${correlation.onlyA} · solo el segundo: ${correlation.onlyB}`;
    panel.appendChild(result);
  }

  return panel;
}
