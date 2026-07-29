// OJO: se usan los componentes locales (getFullYear/getMonth/getDate), no
// toISOString(). toISOString() convierte a UTC, y para zonas como Bogotá
// (UTC-5) eso corre la fecha un día en las últimas horas de la noche.
export function toISODate(d) {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
