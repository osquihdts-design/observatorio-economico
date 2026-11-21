/**
 * Boletín de novedades del Observatorio económico (Google Apps Script, gratis).
 *
 * Qué hace:
 *  - Recibe las suscripciones del banner de la web (doPost) y las guarda en esta hoja de cálculo.
 *  - Manda un correo de confirmación: nadie recibe nada si no confirma (doble confirmación).
 *  - Una vez al día (como mucho) lee las novedades publicadas por la web y las envía a los confirmados.
 *  - Cada correo lleva un enlace para darse de baja: borra la dirección de la hoja.
 *
 * Instalación: sigue boletin/COMO-ACTIVARLO.md. Después de pegar este código, ejecuta una vez «instalar».
 * Límite de Google para cuentas de Gmail: 100 destinatarios al día (contando confirmaciones y envíos).
 */

const WEB = 'https://osquihdts-design.github.io/observatorio-economico/';
const HOJA = 'Suscriptores';
const CABECERAS = ['email', 'token', 'estado', 'alta', 'confirmado'];
const MAX_CONFIRMACIONES_DIA = 30; // freno contra abusos: el resto del cupo queda para el boletín
const NOMBRE = 'Observatorio económico';

// ---------------------------------------------------------------- Hoja de suscriptores
function hoja_() {
  const libro = SpreadsheetApp.getActive();
  let h = libro.getSheetByName(HOJA);
  if (!h) {
    h = libro.insertSheet(HOJA);
    h.appendRow(CABECERAS);
    h.setFrozenRows(1);
  }
  return h;
}

function filas_() {
  const valores = hoja_().getDataRange().getValues();
  return valores.slice(1).map((v, i) => ({ fila: i + 2, email: v[0], token: v[1], estado: v[2] }));
}

const escapar_ = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina_(titulo, texto) {
  return HtmlService.createHtmlOutput(
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#1a2433;line-height:1.55">
      <h2 style="color:#1f4f8f">${escapar_(titulo)}</h2><p>${texto}</p>
      <p><a href="${WEB}" style="color:#1f4f8f">Volver al Observatorio económico</a></p></div>`)
    .setTitle(titulo);
}

// ---------------------------------------------------------------- Alta (desde el formulario de la web)
function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.web) return pagina_('Gracias', 'Hemos recibido tu solicitud.'); // campo trampa: solo lo rellenan los robots
  const email = String(p.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return pagina_('Correo no válido', 'Revisa la dirección e inténtalo de nuevo desde la web.');
  }
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    const existente = filas_().find((f) => f.email === email);
    if (existente && existente.estado === 'confirmado') {
      return pagina_('Ya estás suscrito', 'Esta dirección ya recibe el boletín.');
    }
    const props = PropertiesService.getScriptProperties();
    const hoy = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
    const enviadas = props.getProperty('confirmaciones_' + hoy) || '0';
    if (Number(enviadas) >= MAX_CONFIRMACIONES_DIA) {
      return pagina_('Inténtalo mañana', 'Hoy ya se han recibido muchas solicitudes. Vuelve a intentarlo mañana, por favor.');
    }
    const token = Utilities.getUuid();
    if (existente) hoja_().getRange(existente.fila, 2, 1, 3).setValues([[token, 'pendiente', new Date()]]);
    else hoja_().appendRow([email, token, 'pendiente', new Date(), '']);
    const url = ScriptApp.getService().getUrl();
    MailApp.sendEmail({
      to: email, name: NOMBRE, subject: 'Confirma tu suscripción al boletín del Observatorio económico',
      htmlBody: `<p>Hola:</p><p>Alguien (seguramente tú) ha pedido recibir el boletín de novedades del Observatorio económico:
        un resumen con los datos oficiales nuevos del INE, Eurostat y el BCE, <strong>como mucho un correo al día</strong>.</p>
        <p><a href="${url}?accion=confirmar&t=${token}">Confirmar la suscripción</a></p>
        <p>Si no lo has pedido tú, ignora este correo: no volverás a recibir nada.</p>`,
    });
    props.setProperty('confirmaciones_' + hoy, String(Number(enviadas) + 1));
    return pagina_('¡Casi listo!', 'Te hemos enviado un correo. Pulsa el enlace de confirmación para empezar a recibir el boletín.');
  } finally {
    candado.releaseLock();
  }
}

// ---------------------------------------------------------------- Confirmar y darse de baja (enlaces de los correos)
function doGet(e) {
  const p = (e && e.parameter) || {};
  const token = String(p.t || '');
  if (!token) return pagina_('Observatorio económico', 'Este enlace sirve para gestionar el boletín de novedades.');
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    const fila = filas_().find((f) => f.token === token);
    if (!fila) return pagina_('Enlace no válido', 'Puede que ya te hayas dado de baja o que el enlace haya caducado.');
    if (p.accion === 'confirmar') {
      hoja_().getRange(fila.fila, 3, 1, 3).setValues([['confirmado', hoja_().getRange(fila.fila, 4).getValue(), new Date()]]);
      return pagina_('Suscripción confirmada', 'A partir de ahora recibirás el resumen los días en que haya datos oficiales nuevos (como mucho, uno al día).');
    }
    if (p.accion === 'baja') {
      hoja_().deleteRow(fila.fila); // se borra la dirección por completo
      return pagina_('Te has dado de baja', 'Hemos borrado tu dirección. No recibirás más correos.');
    }
    return pagina_('Observatorio económico', 'Acción no reconocida.');
  } finally {
    candado.releaseLock();
  }
}

// ---------------------------------------------------------------- Envío diario
function enviarNovedades() {
  const respuesta = UrlFetchApp.fetch(WEB + 'api/novedades.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (respuesta.getResponseCode() !== 200) return;
  const entrada = (JSON.parse(respuesta.getContentText()).entradas || [])[0];
  if (!entrada) return;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ultimo_enviado') === entrada.id) return; // una sola vez por entrada (y como mucho una al día)
  const ayer = Utilities.formatDate(new Date(Date.now() - 86400000), 'Europe/Madrid', 'yyyy-MM-dd');
  if (entrada.id < ayer) return; // nunca se reenvían novedades antiguas
  const url = ScriptApp.getService().getUrl();
  const confirmados = filas_().filter((f) => f.estado === 'confirmado');
  let enviados = 0;
  for (const s of confirmados) {
    if (MailApp.getRemainingDailyQuota() < 1) break; // límite diario de Google
    MailApp.sendEmail({
      to: s.email, name: NOMBRE, subject: entrada.titulo,
      htmlBody: entrada.html + `<hr><p style="font-size:12px;color:#536070">Recibes este correo porque te suscribiste al boletín del
        Observatorio económico. <a href="${url}?accion=baja&t=${s.token}">Darme de baja</a> (se borra tu dirección).</p>`,
    });
    enviados++;
  }
  props.setProperty('ultimo_enviado', entrada.id);
  console.log(`Boletín ${entrada.id}: ${enviados} de ${confirmados.length} enviados.`);
}

// ---------------------------------------------------------------- Instalación (ejecutar una vez)
function instalar() {
  hoja_();
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'enviarNovedades').forEach((t) => ScriptApp.deleteTrigger(t));
  // La web se actualiza a las 07:30 UTC; el boletín sale después, entre las 10 y las 11 (hora de Madrid).
  ScriptApp.newTrigger('enviarNovedades').timeBased().everyDays(1).atHour(10).inTimezone('Europe/Madrid').create();
  console.log('Listo: hoja creada y envío diario programado entre las 10 y las 11.');
}
