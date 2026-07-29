export function renderLogin(app, { onSignIn }) {
  app.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'login-form';
  form.innerHTML = `
    <p class="login-copy">Ingresa tu correo para ver y guardar tus hábitos.</p>
    <input type="email" name="email" placeholder="tu@correo.com" required />
    <button type="submit">Enviar enlace</button>
  `;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = new FormData(form).get('email');
    if (email) onSignIn(String(email).trim());
  });
  app.appendChild(form);
}
