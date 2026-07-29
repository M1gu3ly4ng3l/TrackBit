import { DAY_ORDER, dayLabel, serializeFrequency, parseFrequency, frequencyLabel } from '../logic/frequency.js';
import { showConfirm } from './confirm-dialog.js';

export function render(
  habits,
  categories,
  {
    onLog,
    onCreate,
    onStartEdit,
    onCancelEdit,
    onEditSubmit,
    onArchive,
    onRestore,
    onDeleteHabit,
    onToggleArchived,
    onShowAnalytics,
    onShowAchievements,
    onPrevDay,
    onNextDay,
    onGoToday,
    editingHabitId,
    showArchived,
    selectedDate,
    isToday,
  }
) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(buildHabitForm(categories, { onSubmit: onCreate }));

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  const secondaryActions = document.createElement('div');
  secondaryActions.className = 'secondary-actions';

  const archivedToggle = document.createElement('button');
  archivedToggle.type = 'button';
  archivedToggle.className = 'secondary-btn';
  archivedToggle.textContent = showArchived ? 'Ocultar archivados' : `Ver archivados (${archived.length})`;
  archivedToggle.addEventListener('click', onToggleArchived);
  secondaryActions.appendChild(archivedToggle);

  const analyticsBtn = document.createElement('button');
  analyticsBtn.type = 'button';
  analyticsBtn.className = 'secondary-btn';
  analyticsBtn.textContent = 'Ver analíticas';
  analyticsBtn.addEventListener('click', onShowAnalytics);
  secondaryActions.appendChild(analyticsBtn);

  const achievementsBtn = document.createElement('button');
  achievementsBtn.type = 'button';
  achievementsBtn.className = 'secondary-btn';
  achievementsBtn.textContent = 'Ver logros';
  achievementsBtn.addEventListener('click', onShowAchievements);
  secondaryActions.appendChild(achievementsBtn);

  app.appendChild(secondaryActions);

  if (showArchived) {
    if (archived.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No hay hábitos archivados.';
      app.appendChild(p);
    } else {
      const list = document.createElement('ul');
      list.className = 'habit-list archived-list';
      for (const habit of archived) list.appendChild(buildArchivedItem(habit, onRestore, onDeleteHabit));
      app.appendChild(list);
    }
  }

  app.appendChild(buildDateNav({ selectedDate, isToday, onPrevDay, onNextDay, onGoToday }));

  if (active.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no tienes hábitos. Agrega el primero arriba.';
    app.appendChild(empty);
  } else {
    for (const group of groupByCategory(active, categories)) {
      const heading = document.createElement('h3');
      heading.className = 'category-heading';
      heading.innerHTML = `<span class="category-dot" style="background:${group.color}"></span>${group.name}`;
      app.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'habit-list';
      for (const habit of group.habits) {
        if (habit.id === editingHabitId) {
          const li = document.createElement('li');
          li.className = 'habit-item habit-item--editing';
          li.appendChild(
            buildHabitForm(categories, {
              initial: habit,
              onSubmit: (fields) => onEditSubmit(habit.id, fields),
              onCancel: onCancelEdit,
            })
          );
          list.appendChild(li);
        } else {
          list.appendChild(buildHabitItem(habit, onLog, onStartEdit, onArchive));
        }
      }
      app.appendChild(list);
    }
  }
}

// --- navegación de fecha (para registrar un día que no es hoy) ---

function buildDateNav({ selectedDate, isToday, onPrevDay, onNextDay, onGoToday }) {
  const nav = document.createElement('div');
  nav.className = 'date-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'date-nav-btn';
  prevBtn.textContent = '←';
  prevBtn.title = 'Día anterior';
  prevBtn.addEventListener('click', onPrevDay);
  nav.appendChild(prevBtn);

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'date-nav-label';
  label.textContent = isToday ? 'Hoy' : formatDateEs(selectedDate);
  if (isToday) {
    label.disabled = true;
  } else {
    label.title = 'Volver a hoy';
    label.addEventListener('click', onGoToday);
  }
  nav.appendChild(label);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'date-nav-btn';
  nextBtn.textContent = '→';
  nextBtn.title = 'Día siguiente';
  nextBtn.disabled = isToday;
  nextBtn.addEventListener('click', onNextDay);
  nav.appendChild(nextBtn);

  return nav;
}

function formatDateEs(iso) {
  const date = new Date(`${iso}T00:00:00`);
  const label = date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByCategory(habits, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map();
  for (const habit of habits) {
    const cat = byId.get(habit.categoryId);
    const key = cat ? cat.id : 'none';
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: cat ? cat.name : 'Sin categoría',
        color: cat ? cat.color : '#999999',
        habits: [],
      });
    }
    groups.get(key).habits.push(habit);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.id === 'none') return 1;
    if (b.id === 'none') return -1;
    return a.name.localeCompare(b.name);
  });
}

// --- formulario (compartido entre crear y editar) ---

function buildHabitForm(categories, { initial = null, onSubmit, onCancel } = {}) {
  const isEdit = Boolean(initial);
  const form = document.createElement('form');
  form.className = isEdit ? 'edit-habit-form' : 'new-habit-form';
  form.innerHTML = `
    <input type="text" name="name" placeholder="Nombre del hábito" required value="${escapeAttr(initial?.name)}" />

    <select name="type">
      <option value="binary">Sí / no</option>
      <option value="quantity">Cantidad</option>
      <option value="duration">Duración (min)</option>
      <option value="scale">Escala 1-5</option>
    </select>
    <input type="text" name="unit" placeholder="Unidad (ej. vasos)" class="type-extra" value="${escapeAttr(initial?.unit)}" />
    <input type="number" name="target" placeholder="Meta" class="type-extra" min="0" step="1" value="${escapeAttr(initial?.target)}" />

    <select name="frequencyKind">
      <option value="daily">Diario</option>
      <option value="days">Días específicos</option>
      <option value="times_per_week">X veces por semana</option>
    </select>
    <div class="image-field">
      <img class="image-preview" src="${escapeAttr(initial?.imageUrl)}" alt="" ${initial?.imageUrl ? '' : 'hidden'} />
      <label class="image-upload-btn">
        Imagen
        <input type="file" name="imageFile" accept="image/*" class="image-input visually-hidden-file" />
      </label>
    </div>
    <span class="freq-days">
      ${DAY_ORDER.map(
        (d) => `
        <label class="day-checkbox">
          <input type="checkbox" name="days" value="${d}" /> ${dayLabel(d)}
        </label>`
      ).join('')}
    </span>
    <input type="number" name="times" class="freq-times" placeholder="veces / semana" min="1" step="1" value="3" />

    <select name="categoryId">
      <option value="">Sin categoría</option>
      ${categories.map((c) => `<option value="${c.id}">${escapeAttr(c.name)}</option>`).join('')}
      <option value="__new__">+ Nueva categoría…</option>
    </select>
    <input type="text" name="newCategoryName" placeholder="Nombre de la categoría" class="category-extra" />

    <input type="url" name="webhookUrl" placeholder="Webhook (opcional)" class="webhook-input" value="${escapeAttr(initial?.webhookUrl)}" />

    <label class="reminder-field">
      Recordatorio
      <input type="time" name="reminderTime" value="${escapeAttr(initial?.reminderTime)}" />
    </label>

    <div class="form-actions">
      <button type="submit">${isEdit ? 'Guardar' : 'Agregar'}</button>
      ${isEdit ? '<button type="button" class="cancel-btn">Cancelar</button>' : ''}
    </div>
  `;

  if (isEdit) {
    form.querySelector('select[name="type"]').value = initial.type;
    const frequency = parseFrequency(initial.frequency);
    form.querySelector('select[name="frequencyKind"]').value = frequency.kind;
    if (frequency.kind === 'days') {
      form.querySelectorAll('input[name="days"]').forEach((cb) => {
        cb.checked = frequency.days.includes(cb.value);
      });
    }
    if (frequency.kind === 'times_per_week') {
      form.querySelector('input[name="times"]').value = frequency.times;
    }
    form.querySelector('select[name="categoryId"]').value = initial.categoryId ?? '';
  }

  const typeSelect = form.querySelector('select[name="type"]');
  const typeExtras = form.querySelectorAll('.type-extra');
  const syncType = () => {
    const needsExtras = typeSelect.value === 'quantity' || typeSelect.value === 'duration';
    typeExtras.forEach((el) => (el.style.display = needsExtras ? '' : 'none'));
  };
  typeSelect.addEventListener('change', syncType);
  syncType();

  const freqSelect = form.querySelector('select[name="frequencyKind"]');
  const freqDays = form.querySelector('.freq-days');
  const freqTimes = form.querySelector('.freq-times');
  const syncFrequency = () => {
    freqDays.style.display = freqSelect.value === 'days' ? '' : 'none';
    freqTimes.style.display = freqSelect.value === 'times_per_week' ? '' : 'none';
  };
  freqSelect.addEventListener('change', syncFrequency);
  syncFrequency();

  const categorySelect = form.querySelector('select[name="categoryId"]');
  const categoryExtra = form.querySelector('.category-extra');
  const syncCategory = () => {
    categoryExtra.style.display = categorySelect.value === '__new__' ? '' : 'none';
  };
  categorySelect.addEventListener('change', syncCategory);
  syncCategory();

  const imageInput = form.querySelector('.image-input');
  const imagePreview = form.querySelector('.image-preview');
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert('Esa imagen pesa más de 5MB. Elige una más liviana.');
      imageInput.value = '';
      return;
    }
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.hidden = false;
  });

  form.querySelector('.cancel-btn')?.addEventListener('click', () => onCancel?.());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const type = data.get('type');
    const needsExtras = type === 'quantity' || type === 'duration';
    const categoryValue = data.get('categoryId');
    const isNewCategory = categoryValue === '__new__';

    onSubmit({
      name: String(data.get('name') || '').trim(),
      type,
      unit: needsExtras ? String(data.get('unit') || '').trim() || null : null,
      target: needsExtras && data.get('target') ? Number(data.get('target')) : null,
      frequency: serializeFrequency(data.get('frequencyKind'), {
        days: data.getAll('days'),
        times: Number(data.get('times')) || 1,
      }),
      categoryId: isNewCategory ? null : categoryValue || null,
      newCategoryName: isNewCategory ? String(data.get('newCategoryName') || '').trim() : null,
      webhookUrl: String(data.get('webhookUrl') || '').trim() || null,
      imageFile: imageInput.files[0] || null,
      reminderTime: String(data.get('reminderTime') || '').trim() || null,
    });

    if (!isEdit) {
      form.reset();
      syncType();
      syncFrequency();
      syncCategory();
      imagePreview.hidden = true;
      imagePreview.src = '';
    }
  });

  return form;
}

// --- filas de la lista ---

function buildHabitItem(habit, onLog, onStartEdit, onArchive) {
  const item = document.createElement('li');
  item.className = 'habit-item';

  const stampWrap = document.createElement('div');
  stampWrap.className = 'streak-wrap';
  const stamp = document.createElement('div');
  stamp.className = `streak-stamp ${streakTier(habit.streak)}`;
  stamp.textContent = String(habit.streak);
  stampWrap.appendChild(stamp);
  if (habit.longestStreak > habit.streak) {
    const record = document.createElement('span');
    record.className = 'streak-record';
    record.textContent = `máx ${habit.longestStreak}`;
    stampWrap.appendChild(record);
  }
  item.appendChild(stampWrap);

  const info = document.createElement('div');
  info.className = 'habit-info';
  info.innerHTML = `
    <span class="habit-name">${habit.name}${habit.webhookUrl ? ' <span class="webhook-dot" title="Webhook conectado"></span>' : ''}</span>
    <span class="habit-meta">${frequencyLabel(parseFrequency(habit.frequency))}</span>
  `;
  if (habit.achievements?.length) {
    const badges = document.createElement('div');
    badges.className = 'achievement-badges';
    badges.innerHTML = habit.achievements.map((a) => `<span class="badge" title="${a.name}"></span>`).join('');
    info.appendChild(badges);
  }

  const noteRow = document.createElement('div');
  noteRow.className = 'note-row';
  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.className = 'note-input';
  noteInput.placeholder = 'Nota (opcional)';
  noteInput.value = habit.entryNote ?? '';
  const hasEntryValue = habit.entryValue !== null && habit.entryValue !== undefined;

  const saveNote = () => onLog(habit.id, habit.entryValue, noteInput.value.trim() || null);
  const noteSaveBtn = document.createElement('button');
  noteSaveBtn.type = 'button';
  noteSaveBtn.className = 'note-save-btn';
  noteSaveBtn.textContent = 'Guardar';
  noteSaveBtn.disabled = !hasEntryValue;
  noteSaveBtn.title = hasEntryValue ? '' : 'Marca el hábito para poder guardar una nota';
  noteSaveBtn.addEventListener('click', saveNote);
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && hasEntryValue) {
      e.preventDefault();
      saveNote();
    }
  });

  noteRow.appendChild(noteInput);
  noteRow.appendChild(noteSaveBtn);
  info.appendChild(noteRow);

  item.appendChild(info);
  item.appendChild(buildControl(habit, onLog, () => noteInput.value.trim() || null));

  const actions = document.createElement('div');
  actions.className = 'habit-actions';
  actions.innerHTML = `<button type="button" class="edit-btn">Editar</button><button type="button" class="archive-btn">Archivar</button>`;
  actions.querySelector('.edit-btn').addEventListener('click', () => onStartEdit(habit.id));
  actions.querySelector('.archive-btn').addEventListener('click', () => onArchive(habit.id));
  item.appendChild(actions);

  return item;
}

function buildArchivedItem(habit, onRestore, onDeleteHabit) {
  const item = document.createElement('li');
  item.className = 'habit-item habit-item--archived';

  const info = document.createElement('div');
  info.className = 'habit-info';
  info.innerHTML = `<span class="habit-name">${habit.name}</span>`;
  item.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'habit-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'restore-btn';
  restoreBtn.textContent = 'Restaurar';
  restoreBtn.addEventListener('click', () => onRestore(habit.id));
  actions.appendChild(restoreBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      message: `¿Eliminar "${habit.name}" para siempre? Se borra también su historial de registros y logros — no se puede deshacer.`,
    });
    if (confirmed) onDeleteHabit(habit.id);
  });
  actions.appendChild(deleteBtn);

  item.appendChild(actions);
  return item;
}

function streakTier(streak) {
  if (streak >= 30) return 'streak-hot';
  if (streak >= 7) return 'streak-warm';
  if (streak > 0) return 'streak-active';
  return '';
}

function buildControl(habit, onLog, getNote) {
  const wrap = document.createElement('div');
  wrap.className = 'habit-control';

  if (habit.type === 'quantity' || habit.type === 'duration') {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.className = 'amount-input';
    input.value = habit.entryValue ?? 0;

    const button = document.createElement('button');
    button.textContent = 'Registrar';
    button.addEventListener('click', () => onLog(habit.id, Number(input.value) || 0, getNote()));

    wrap.appendChild(input);
    if (habit.target) {
      const goal = document.createElement('span');
      goal.className = 'habit-goal';
      goal.textContent = `/ ${habit.target}${habit.unit ? ' ' + habit.unit : ''}`;
      wrap.appendChild(goal);
    }
    wrap.appendChild(button);
    return wrap;
  }

  if (habit.type === 'scale') {
    const select = document.createElement('select');
    select.className = 'scale-input';
    select.innerHTML = ['', 1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v || '—'}</option>`).join('');
    select.value = habit.entryValue ?? '';
    select.addEventListener('change', () => {
      if (select.value) onLog(habit.id, Number(select.value), getNote());
    });
    wrap.appendChild(select);
    return wrap;
  }

  const done = habit.entryValue === true;
  const button = document.createElement('button');
  button.textContent = done ? 'Hecho' : 'Marcar';
  button.className = done ? 'done' : '';
  button.addEventListener('click', () => onLog(habit.id, !done, getNote()));
  wrap.appendChild(button);
  return wrap;
}

function escapeAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
