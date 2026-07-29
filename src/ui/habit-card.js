export function buildHabitCard(habit, categories, isExpanded, onClick) {
  const category = categories.find((c) => c.id === habit.categoryId);
  const color = category ? category.color : '#b9852c';

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `habit-card ${isExpanded ? 'expanded' : ''}`;

  if (habit.imageUrl) {
    const img = document.createElement('img');
    img.className = 'habit-card-image';
    img.src = habit.imageUrl;
    img.alt = habit.name;
    img.addEventListener('error', () => img.replaceWith(buildInitialSwatch(habit, color)), { once: true });
    card.appendChild(img);
  } else {
    card.appendChild(buildInitialSwatch(habit, color));
  }

  const name = document.createElement('span');
  name.className = 'habit-card-name';
  name.textContent = habit.name;
  card.appendChild(name);

  card.addEventListener('click', () => onClick(habit.id));
  return card;
}

function buildInitialSwatch(habit, color) {
  const swatch = document.createElement('span');
  swatch.className = 'habit-card-swatch';
  swatch.style.background = color;
  swatch.textContent = habit.name.trim().charAt(0).toUpperCase() || '?';
  return swatch;
}
