import './styles/main.css';
import { listHabits, createHabit, updateHabit, archiveHabit, restoreHabit, deleteHabit, getHabit } from './data/habits.js';
import { logEntry, currentEntries } from './data/entries.js';
import { listCategories, createCategory } from './data/categories.js';
import { uploadHabitImage } from './data/storage.js';
import { listAchievementDefs, listUnlocked } from './data/achievements.js';
import { currentStreak, longestStreak } from './logic/streaks.js';
import { checkAchievements } from './logic/achievements-engine.js';
import { heatmapData, correlationBetween } from './logic/stats.js';
import { toISODate } from './logic/date-utils.js';
import { notifyWebhook } from './automation/webhook.js';
import { render } from './ui/render.js';
import { renderLogin } from './ui/login.js';
import { renderAnalytics } from './ui/analytics.js';
import { renderAchievements } from './ui/achievements-view.js';
import { showToast } from './ui/toast.js';
import { showConfirm } from './ui/confirm-dialog.js';
import { getSession, onAuthChange, signInWithEmail, signOut } from './auth/auth.js';
import { subscribeToChanges, unsubscribeFromChanges } from './data/realtime.js';

let session = null;
let editingHabitId = null;
let showArchived = false;
let cachedHabits = null;
let cachedCategories = null;
let selectedDate = todayISO();
let subscribedUserId = null;
let realtimeDebounce = null;

let showAnalytics = false;
let cachedHeatmaps = {};
let expandedAnalyticsHabitId = null;
let correlationSelection = null;
let correlationResult = null;

let showAchievements = false;
let cachedUnlocked = {};
let expandedAchievementHabitId = null;

async function boot() {
  setTodayLabel();
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      message: '¿Cerrar sesión? Vas a tener que volver a pedir el enlace por correo para entrar de nuevo.',
      confirmLabel: 'Cerrar sesión',
    });
    if (confirmed) signOut();
  });

  session = await getSession();
  applyRealtimeSubscription();
  onAuthChange((newSession) => {
    const wasLoggedIn = Boolean(session);
    session = newSession;
    applyRealtimeSubscription();
    if (Boolean(newSession) !== wasLoggedIn) refresh();
  });
  refresh();
}

function applyRealtimeSubscription() {
  const userId = session?.user?.id ?? null;
  if (userId === subscribedUserId) return; // ya suscrito al mismo usuario, no recrear el canal
  subscribedUserId = userId;
  if (userId) {
    subscribeToChanges(userId, handleRemoteChange);
  } else {
    unsubscribeFromChanges();
  }
}

// Un cambio remoto (otro dispositivo) dispara esto. Si estás editando un
// hábito ahora mismo, no lo interrumpe — se pondrá al día en el próximo
// refresh natural (al guardar, cancelar, o cualquier otra acción).
function handleRemoteChange() {
  if (editingHabitId !== null) return;
  clearTimeout(realtimeDebounce);
  realtimeDebounce = setTimeout(refresh, 400);
}

async function refresh() {
  const app = document.getElementById('app');
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) signOutBtn.hidden = !session;

  if (!session) {
    cachedHabits = null;
    cachedCategories = null;
    renderLogin(app, { onSignIn: handleSignIn });
    return;
  }

  // Solo se muestra "Cargando…" cuando todavía no hay nada en pantalla
  // (justo después de iniciar sesión). En los refrescos siguientes, lo
  // que ya estaba se queda visible hasta que llega lo nuevo — nada de
  // pantallazo en blanco por cada acción.
  if (cachedHabits === null) {
    app.innerHTML = '<p class="loading">Cargando…</p>';
  }

  try {
    const [rawHabits, categories] = await Promise.all([listHabits({ includeArchived: true }), listCategories()]);
    const achievementDefs = listAchievementDefs();

    const habits = await Promise.all(
      rawHabits.map(async (h) => {
        if (h.archived) return { ...h, streak: 0, longestStreak: 0, entryValue: null, entryNote: null, achievements: [] };
        const [entries, unlocked, streak, best] = await Promise.all([
          currentEntries(h.id),
          listUnlocked(h.id),
          currentStreak(h),
          longestStreak(h),
        ]);
        const entryForDate = entries.find((e) => e.date === selectedDate) ?? null;
        const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
        return {
          ...h,
          streak,
          longestStreak: best,
          entryValue: entryForDate ? entryForDate.value : null,
          entryNote: entryForDate ? entryForDate.note : null,
          achievements: achievementDefs.filter((d) => unlockedIds.has(d.id)),
        };
      })
    );

    cachedHabits = habits;
    cachedCategories = categories;
    renderCurrent();
  } catch (err) {
    console.error('Error cargando datos de Supabase:', err);
    app.innerHTML = `
      <p class="error-state">
        No se pudo conectar con Supabase.
        <span class="error-detail">${(err && err.message) || String(err)}</span>
      </p>
    `;
  }
}

// Vuelve a pintar con lo que ya está en caché, sin ir a Supabase. Para
// cosas que son puro estado de la interfaz (editar, cancelar, mostrar u
// ocultar archivados) y no necesitan traer nada de nuevo.
function renderCurrent() {
  if (showAnalytics) {
    renderAnalyticsPage();
    return;
  }
  if (showAchievements) {
    renderAchievementsPage();
    return;
  }
  render(cachedHabits, cachedCategories, {
    onLog: handleLog,
    onCreate: handleCreate,
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onEditSubmit: handleEditSubmit,
    onArchive: handleArchive,
    onRestore: handleRestore,
    onDeleteHabit: handleDeleteHabit,
    onToggleArchived: handleToggleArchived,
    onShowAnalytics: openAnalytics,
    onShowAchievements: openAchievements,
    onPrevDay: handlePrevDay,
    onNextDay: handleNextDay,
    onGoToday: handleGoToday,
    editingHabitId,
    showArchived,
    selectedDate,
    isToday: selectedDate === todayISO(),
  });
}

function activeHabits() {
  return (cachedHabits || []).filter((h) => !h.archived);
}

async function handleLog(habitId, value, note = null) {
  const entry = await logEntry({ habitId, date: selectedDate, value, note });
  const habit = await getHabit(habitId);
  notifyWebhook(habit, entry);
  for (const achievement of await checkAchievements(habit)) {
    showToast(`Logro desbloqueado: ${achievement.name}`);
  }
  refresh();
}

async function handleCreate(fields) {
  const categoryId = await resolveCategoryId(fields);
  const imageUrl = await tryUploadImage(fields.imageFile);
  await createHabit({ ...withoutFormOnlyFields(fields), categoryId, imageUrl });
  refresh();
}

function handleStartEdit(habitId) {
  editingHabitId = habitId;
  renderCurrent();
}

function handleCancelEdit() {
  editingHabitId = null;
  renderCurrent();
}

async function handleEditSubmit(habitId, fields) {
  const categoryId = await resolveCategoryId(fields);
  const patch = { ...withoutFormOnlyFields(fields), categoryId };
  if (fields.imageFile) {
    const imageUrl = await tryUploadImage(fields.imageFile);
    if (imageUrl) patch.imageUrl = imageUrl; // si falló la subida, se deja la imagen que ya tenía
  }
  await updateHabit(habitId, patch);
  editingHabitId = null;
  refresh();
}

async function handleArchive(habitId) {
  await archiveHabit(habitId);
  refresh();
}

async function handleRestore(habitId) {
  await restoreHabit(habitId);
  refresh();
}

async function handleDeleteHabit(habitId) {
  await deleteHabit(habitId);
  refresh();
}

function handleToggleArchived() {
  showArchived = !showArchived;
  renderCurrent();
}

function handlePrevDay() {
  selectedDate = shiftDate(selectedDate, -1);
  refresh();
}

function handleNextDay() {
  if (selectedDate === todayISO()) return;
  selectedDate = shiftDate(selectedDate, 1);
  refresh();
}

function handleGoToday() {
  selectedDate = todayISO();
  refresh();
}

async function resolveCategoryId(fields) {
  if (fields.newCategoryName) {
    return (await createCategory({ name: fields.newCategoryName })).id;
  }
  return fields.categoryId;
}

async function tryUploadImage(file) {
  if (!file) return null;
  try {
    return await uploadHabitImage(file);
  } catch (err) {
    console.error('No se pudo subir la imagen del hábito', err);
    showToast('No se pudo subir la imagen — el hábito se guardó sin ella');
    return null;
  }
}

function withoutFormOnlyFields({ newCategoryName, imageFile, ...rest }) {
  return rest;
}

async function handleSignIn(email) {
  await signInWithEmail(email);
  showToast('Revisa tu correo para el enlace de acceso');
}

// --- analíticas ---

function openAnalytics() {
  showAnalytics = true;
  expandedAnalyticsHabitId = null;
  renderAnalyticsPage();
}

async function handleToggleAnalyticsHabit(habitId) {
  if (expandedAnalyticsHabitId === habitId) {
    expandedAnalyticsHabitId = null;
    renderAnalyticsPage();
    return;
  }
  expandedAnalyticsHabitId = habitId;
  renderAnalyticsPage(); // muestra "Cargando…" para ese hábito mientras llega

  if (!cachedHeatmaps[habitId]) {
    const habit = activeHabits().find((h) => h.id === habitId);
    cachedHeatmaps[habitId] = await heatmapData(habit, { days: 91 });
    renderAnalyticsPage();
  }
}

async function refreshCorrelation() {
  if (!correlationSelection?.a || !correlationSelection?.b || correlationSelection.a === correlationSelection.b) {
    correlationResult = null;
    return;
  }
  correlationResult = await correlationBetween(correlationSelection.a, correlationSelection.b);
}

async function handleCorrelationChange(a, b) {
  correlationSelection = { a, b };
  correlationResult = null;
  renderAnalyticsPage(); // muestra "Cargando…" en el panel de correlación mientras llega
  await refreshCorrelation();
  renderAnalyticsPage();
}

function closeAnalytics() {
  showAnalytics = false;
  renderCurrent();
}

function renderAnalyticsPage() {
  const app = document.getElementById('app');
  renderAnalytics(app, {
    habits: activeHabits(),
    categories: cachedCategories || [],
    heatmapsByHabit: cachedHeatmaps,
    expandedHabitId: expandedAnalyticsHabitId,
    onToggleHabit: handleToggleAnalyticsHabit,
    correlation: correlationResult,
    correlationSelection,
    onCorrelationChange: handleCorrelationChange,
    onClose: closeAnalytics,
  });
}

// --- logros ---

async function openAchievements() {
  showAchievements = true;
  expandedAchievementHabitId = null;
  renderAchievementsPage();
}

async function handleToggleAchievementHabit(habitId) {
  if (expandedAchievementHabitId === habitId) {
    expandedAchievementHabitId = null;
    renderAchievementsPage();
    return;
  }
  expandedAchievementHabitId = habitId;
  renderAchievementsPage(); // muestra "Cargando…" para ese hábito mientras llega

  if (!cachedUnlocked[habitId]) {
    cachedUnlocked[habitId] = await listUnlocked(habitId);
    renderAchievementsPage();
  }
}

function closeAchievements() {
  showAchievements = false;
  renderCurrent();
}

function renderAchievementsPage() {
  const app = document.getElementById('app');
  renderAchievements(app, {
    habits: activeHabits(),
    categories: cachedCategories || [],
    defs: listAchievementDefs(),
    unlockedByHabit: cachedUnlocked,
    expandedHabitId: expandedAchievementHabitId,
    onToggleHabit: handleToggleAchievementHabit,
    onClose: closeAchievements,
  });
}

// --- fechas ---

function todayISO() {
  return toISODate(new Date());
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function setTodayLabel() {
  const el = document.getElementById('today-date');
  if (!el) return;
  const label = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  el.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

boot();
