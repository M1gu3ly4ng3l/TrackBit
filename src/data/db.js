// Lo único que sigue siendo local es el id de dispositivo: identifica
// desde qué navegador se hizo un registro, no tiene sentido que viva en
// la base de datos.
const KEY = 'app-habitos:deviceId';

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
