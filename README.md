# App de hábitos

`npm install && npm run dev` para arrancar — pero antes hay que configurar
Supabase (ver abajo), o la app se queda pegada en la pantalla de login.

## Sincronización (Supabase)

Los datos ya no viven en `localStorage`: viven en una base de datos de
Supabase, así que el mismo usuario ve lo mismo en el computador y en el
celular.

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el proyecto: **SQL Editor** → pega el contenido de
   `supabase-schema.sql` (en la raíz de este repo) → Run. Eso crea las
   tablas (`categories`, `habits`, `entries`, `unlocked_achievements`) y
   las políticas de seguridad (cada usuario solo ve sus propias filas).
3. En **Authentication → Providers**, confirma que **Email** esté
   habilitado (viene así por defecto) — es lo que usa el login por enlace,
   no hace falta contraseña.
4. En **Authentication → URL Configuration**, pon como **Site URL** la
   URL real donde vas a usar la app (ej. `https://tu-app.vercel.app`), y
   agrega en **Redirect URLs**:
   ```
   https://tu-app.vercel.app/**
   http://localhost:5173/**
   ```
   Si dejas esto en `localhost` por defecto, el enlace del correo va a
   intentar abrir `localhost` incluso probando desde el celular.
5. En **Project Settings → API**, copia la **Project URL** y la
   **anon public key**.
6. Copia `.env.example` a `.env` y pega ahí esos dos valores:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
7. `npm install && npm run dev`. Al abrir la app pide un correo, envía un
   enlace mágico, y con eso quedas adentro — en cualquier dispositivo,
   mientras uses el mismo correo.

En Vercel: agrega las mismas dos variables en **Project Settings →
Environment Variables** y vuelve a desplegar (Vercel las necesita en el
build, no solo en tu máquina).

**Importante:** la app ahora necesita internet para funcionar — ya no hay
modo sin conexión, porque cada acción lee/escribe directo en Supabase.
Los datos sí se actualizan solos entre dispositivos (ver "Tiempo real"
más abajo) — si acabas de configurar el proyecto y todavía no corres esa
parte, cada dispositivo va a ver lo último recién al abrir o hacer algo
ahí, no al instante.

## Tiempo real

Cada dispositivo mantiene una conexión abierta (`data/realtime.js`,
Supabase Realtime) escuchando cambios en tus propias filas de `habits`,
`entries`, `categories` y `unlocked_achievements`. Si marcas algo en el
celular, el computador se entera solo, sin que tengas que refrescar —
con un pequeño colchón de 400ms para agrupar varios cambios seguidos en
un solo refresco en vez de uno por cada fila que cambia.

Si estás **editando** un hábito justo cuando llega un cambio remoto, no
te lo interrumpe — se pone al día apenas termines (al guardar o
cancelar). El formulario de crear uno nuevo no tiene esa protección
todavía: si algo remoto llega justo mientras estás llenándolo, se
reinicia. Es un caso raro (tendrías que estar creando un hábito en un
dispositivo justo cuando pasa algo en otro), pero vale la pena saberlo.

**Si ya tenías el proyecto configurado de antes**, esto necesita dos
líneas más de SQL — Realtime está apagado por tabla hasta que la agregas
explícitamente, y los borrados necesitan un ajuste aparte:
```sql
alter publication supabase_realtime add table habits, entries, categories, unlocked_achievements;

alter table habits replica identity full;
alter table entries replica identity full;
alter table categories replica identity full;
alter table unlocked_achievements replica identity full;
```
Lo segundo es porque, por defecto, un evento DELETE solo trae el `id` de
la fila borrada — y como el filtro de Realtime acá es por `user_id`, sin
esto los borrados nunca le llegan a nadie (Supabase no puede evaluar el
filtro si `user_id` no viene en el evento, así que lo descarta en
silencio, sin error). `REPLICA IDENTITY FULL` hace que el DELETE también
mande la fila completa.

## Estructura

- `src/data/` — capa de datos, ahora contra Supabase (`supabase-client.js`
  centraliza la conexión). `entries.js` sigue siendo append-only: nunca se
  sobreescribe una fila, solo se insertan filas nuevas, y el estado
  vigente se resuelve tomando la más reciente por fecha. Ese mismo patrón
  es lo que hace trivial fusionar cambios de varios dispositivos.
- `src/auth/` — login sin contraseña (magic link) con Supabase Auth.
- `src/logic/` — rachas, frecuencia y logros; todo async ahora porque leer
  de Supabase no es instantáneo como leer de memoria.
- `src/ui/` — renderizado (lista de hábitos, formulario, login), separado
  de datos y lógica.
- `supabase-schema.sql` — el SQL para crear todo del lado de Supabase.

Los hábitos soportan 4 tipos (`binary`, `quantity`, `duration`, `scale`).
Qué cuenta como "cumplido" para la racha vive en `logic/completion.js`:
binario es sí/no, cantidad y duración comparan contra `target`, y escala
cuenta cualquier registro (el valor es informativo, no un umbral).

La frecuencia vive en `logic/frequency.js` como un string plano
(`daily`, `days:mon,wed,fri`, `times_per_week:3`) y `logic/streaks.js` la
usa para calcular la racha correctamente: en días específicos, los días
no programados no cuentan ni rompen la racha; en "X veces por semana", la
racha se cuenta en semanas consecutivas que cumplen la meta, no en días.

Las categorías (`data/categories.js`) son simples: nombre + color, tomado
automáticamente de una paleta fija. La lista de hábitos se agrupa por
categoría, con "Sin categoría" al final. Se pueden crear al vuelo desde el
mismo formulario de un hábito nuevo.

Cada hábito puede tener una imagen que lo represente — se sube el
archivo directo (no un link externo) a Supabase Storage
(`data/storage.js`), y se guarda la URL pública resultante en
`imageUrl`. Límite de 5MB del lado del cliente. Se usa en las tarjetas de
"Ver logros" y "Ver analíticas"; si no tiene imagen, se ve un círculo con
la inicial del nombre y el color de su categoría. Si subes una nueva
imagen al editar, reemplaza la anterior; si no tocas el campo, la que ya
tenía se queda igual (no se borra el archivo viejo del bucket, solo deja
de estar enlazado — no hay limpieza automática todavía).

**Si ya tenías el proyecto de Supabase configurado de antes**, esto
necesita dos cosas que no estaban:
```sql
alter table habits add column image_url text;
```
y el bloque del bucket `habit-images` que está al final de
`supabase-schema.sql` (la parte de `storage.buckets` y las policies de
`storage.objects`) — cópialo y córrelo tal cual, es la única parte del
schema que sí puedes volver a correr sin que truene por "ya existe",
gracias al `on conflict (id) do nothing`.

Cada hábito se puede **editar** (el mismo formulario de crear, pero
precargado) y **archivar** — archivar no borra nada, solo lo saca de la
lista activa; "Ver archivados" los muestra aparte con un botón
**Restaurar**. Para borrarlo de verdad (incluyendo su historial de
entradas y logros, por el `on delete cascade` del schema) hay que
archivarlo primero y luego usar **Eliminar** desde ahí — a propósito es
un paso extra sobre algo irreversible, con confirmación antes de hacerlo
(`ui/confirm-dialog.js` reemplaza el `confirm()` nativo del navegador, con
la estética del resto de la app).

Cada entrada admite una nota corta y opcional (campo `note`, ya estaba en
el modelo de datos desde el principio). El input de nota vive junto a
cada hábito; el botón "Guardar" solo queda activo si ya hay un valor
registrado ese día — así evita que guardar una nota reabra o cambie sin
querer un hábito binario que ya estaba marcado.

Los logros (`data/achievements.js` + `logic/achievements-engine.js`) se
revisan después de cada `logEntry`: si la racha o el total de registros de
un hábito alcanza la condición de un logro no desbloqueado todavía, se
desbloquea y aparece un aviso. Una vez desbloqueado queda así aunque la
racha se rompa después. Agregar un logro nuevo es solo una entrada más en
`DEFAULT_ACHIEVEMENTS`, no hay que tocar la lógica. "Ver logros"
(`ui/achievements-view.js`) muestra una grilla con una tarjeta por
hábito (imagen o inicial); tocar una trae y muestra el catálogo completo
de esa tarjeta, con fecha de cuándo se desbloqueó cada logro — nada se
pide a Supabase hasta que tocas una tarjeta, así no importa cuántos
hábitos tengas.

Cada hábito puede tener un `webhookUrl` opcional. Al registrarlo
(`automation/webhook.js`) se hace un POST con:

```json
{
  "habitId": "...",
  "habitName": "Leer",
  "type": "duration",
  "date": "2026-07-24",
  "value": 20,
  "loggedAt": "2026-07-24T23:10:00.000Z"
}
```

Es "fire and forget": si falla, no bloquea el registro, solo avisa en
consola. Sirve para conectar con n8n, Zapier o Make y armar lo que quieras
del otro lado (Telegram, Notion, lo que sea).

Nota: esto solo cubre "se marcó un hábito". Un recordatorio de "no lo has
marcado hoy" necesitaría algo con reloj propio del lado del automation
(por ejemplo, n8n consultando la tabla `entries` en Supabase directamente,
con la anon key y las mismas políticas de seguridad).

"Ver analíticas" (`logic/stats.js` + `ui/analytics.js`) usa la misma
grilla de tarjetas que "Ver logros" (`ui/habit-card.js` es el componente
compartido entre las dos vistas): tocar un hábito trae y muestra su
heatmap de los últimos ~91 días (`entryIntensity` en
`logic/completion.js` decide qué tan "lleno" se pinta cada día — binario
es todo o nada, cantidad/duración se gradúan según qué tan cerca de la
meta quedó, escala según el valor). Debajo queda el comparador de
correlación entre dos hábitos (cuántos días coinciden, cuántos solo uno
de los dos), que tampoco calcula nada hasta que eliges los dos hábitos a
comparar.

Arriba de la lista hay un navegador de fecha (← Hoy →) para registrar un
día que no sea hoy — útil si un día no abriste la app y quieres rellenarlo
después. Todo lo demás (streak, analíticas) sigue calculado sobre la
fecha real de hoy; solo lo que marcas/registras se guarda en la fecha que
estés viendo. No deja avanzar a fechas futuras.

Nota técnica: `logic/date-utils.js` arma las fechas con los componentes
locales del `Date` (año/mes/día), no con `toISOString()` — esta última
convierte a UTC, lo que en Bogotá (UTC-5) corría la fecha un día durante
las últimas horas de la noche. Vale la pena tenerlo en cuenta si en algún
momento se agrega otra conversión de fecha en el proyecto.

## Recordatorios

Cada hábito puede tener una hora de recordatorio (`reminderTime`, campo
`type="time"` en el formulario). A diferencia de todo lo demás, esto **no
corre en el navegador** — nadie deja la pestaña abierta todo el día —
sino en una Edge Function de Supabase (`supabase/functions/check-reminders`)
que corre por cron y, si a un hábito ya se le pasó la hora y no se ha
marcado hoy, dispara su mismo `webhookUrl` con `event: "reminder"` (en vez
de `event: "logged"`, que es lo que manda la app al marcar algo) — así tu
automatización en n8n/Zapier puede distinguir los dos casos y reaccionar
distinto a cada uno. Un hábito necesita **tanto** `reminderTime` como
`webhookUrl` configurados para que esto le aplique; si no tiene webhook,
no hay a dónde avisar.

Esta parte no la puedo probar en este entorno (necesita el CLI de
Supabase y tu proyecto real), así que ve con calma la primera vez:

1. Instala el CLI de Supabase si no lo tienes: `npm install -g supabase`.
2. `supabase login`, y luego, parado en la carpeta del proyecto:
   `supabase link --project-ref TU_PROJECT_REF` (el ref sale en la URL
   de tu proyecto o en Project Settings → General).
3. `supabase functions deploy check-reminders`. `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase solo, no hay que
   configurarlos a mano.
4. Corre el bloque de `reminder_log` de `supabase-schema.sql` si todavía
   no lo has hecho (ya viene incluido ahí), y también el `grant` para
   `service_role` que está justo debajo de los de `authenticated` — sin
   eso, la función da "permission denied for table habits" aunque todo
   lo demás esté bien.
5. Prográmala para que corra periódicamente — la forma más simple es
   desde el dashboard: **Integrations → Cron Jobs → Create a new cron
   job**, tipo "Supabase Edge Function", eliges `check-reminders`, y una
   expresión tipo `*/15 * * * *` (cada 15 minutos). Si prefieres hacerlo
   por SQL en vez del dashboard:
   ```sql
   select cron.schedule(
     'check-reminders-15min',
     '*/15 * * * *',
     $$
     select net.http_post(
       url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/check-reminders',
       headers := jsonb_build_object(
         'Authorization', 'Bearer TU_SERVICE_ROLE_KEY',
         'Content-Type', 'application/json'
       )
     );
     $$
   );
   ```
   (esto último requiere las extensiones `pg_cron` y `pg_net`, activables
   en Database → Extensions).

El horario está fijo en `America/Bogota` dentro de la función — si algún
día usas la app desde otro huso horario, hay que cambiar esa constante.

## Próximos pasos

- Proteger el formulario de crear hábito de que un cambio remoto lo
  reinicie mientras lo estás llenando (ver nota en "Tiempo real").
- El proveedor de correo por defecto de Supabase tiene un límite bajo de
  envíos por hora (útil saberlo si estás probando el login seguido y de
  repente deja de llegar el enlace — no es un bug, es ese límite).

## Diseño

Paleta tipo cuaderno de campo: papel verde-grisáceo (`--color-bg`), tinta
casi negra (`--color-ink`) y un dorado envejecido (`--color-accent`) para
lo que se va acumulando (racha, logros). Fraunces para nombres y
encabezados, IBM Plex Mono para todo lo que es dato — números, fechas,
frecuencia, el formulario entero — como si fuera la letra con la que se
llenan las líneas de un registro. La racha se muestra como un sello
cuadrado que cambia de tono según qué tan larga es (`streak-active` →
`streak-warm` → `streak-hot` a partir de 30 días), en vez de un simple
número de texto suelto.
