// Reemplaza al confirm() nativo del navegador para que las acciones
// destructivas (como eliminar un hábito) se vean consistentes con el
// resto de la app en vez del cuadro genérico del sistema operativo.
export function showConfirm({ message, confirmLabel = 'Eliminar', cancelLabel = 'Cancelar' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const card = document.createElement('div');
    card.className = 'confirm-card';

    const messageEl = document.createElement('p');
    messageEl.className = 'confirm-message';
    messageEl.textContent = message;
    card.appendChild(messageEl);

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'confirm-cancel';
    cancelBtn.textContent = cancelLabel;
    actions.appendChild(cancelBtn);

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'confirm-accept';
    acceptBtn.textContent = confirmLabel;
    actions.appendChild(acceptBtn);

    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    function finish(result) {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') finish(false);
    }

    cancelBtn.addEventListener('click', () => finish(false));
    acceptBtn.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKeydown);
    acceptBtn.focus();
  });
}
