// Banner para recibir las novedades por correo (como mucho un correo al día).
// La web no guarda ningún correo: el formulario lo envía al programa de Google Apps Script del proyecto
// (boletin/Codigo.gs), que lo apunta en una hoja de cálculo, pide confirmación por correo (doble opt-in)
// y pone un enlace de baja en cada envío. El contenido sale de api/novedades.json, que genera
// scripts/publicar_web.py cada día (también como RSS en novedades.xml).
import { ESTATICO, WEB_PUBLICA } from './api.js';

// Dirección de la aplicación web de Apps Script (https://script.google.com/macros/s/…/exec).
// Mientras esté vacía, el banner ofrece solo el RSS. Ver boletin/COMO-ACTIVARLO.md.
export const BOLETIN_URL = '';

export const RSS = ESTATICO ? 'novedades.xml' : `${WEB_PUBLICA}novedades.xml`;
const CLAVE = 'observatorio:boletin';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

function formulario() {
  if (!BOLETIN_URL) {
    return `<p class="boletin-nota">La suscripción por correo estará disponible muy pronto. Mientras tanto, puedes seguir las
      novedades con cualquier lector <a href="${RSS}" target="_blank" rel="noopener">RSS</a>.</p>`;
  }
  return `<form class="boletin-form" action="${BOLETIN_URL}" method="post" target="_blank">
      <label class="sr-only" for="boletin-email">Tu correo electrónico</label>
      <input type="email" name="email" id="boletin-email" placeholder="tu@correo.com" autocomplete="email" required />
      <input type="text" name="web" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button type="submit" class="btn primario">Suscribirme</button>
      <label class="boletin-consentimiento"><input type="checkbox" required />
        <span>Acepto recibir el resumen y he leído la <a href="#/sobre?ir=privacidad">nota de privacidad</a>.</span></label>
    </form>`;
}

/** Muestra el banner (si no se ha cerrado antes). `forzar` lo abre siempre (desde la barra lateral). */
export function mostrarBoletin(forzar = false) {
  const estado = leer();
  if (!forzar && (estado.cerrado || estado.suscrito)) return;
  document.querySelector('.boletin')?.remove();
  const caja = document.createElement('aside');
  caja.className = 'boletin';
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-label', 'Recibir novedades por correo');
  caja.innerHTML = `<button class="cerrar" aria-label="Cerrar">✕</button>
    <div class="boletin-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></div>
    <div class="boletin-cuerpo">
      <h2>Novedades en tu correo</h2>
      <p>Un resumen con los datos oficiales nuevos del INE, Eurostat y el BCE: <strong>como mucho, un correo al día</strong>
      y solo los días con datos nuevos. Sin cuenta ni contraseña: confirmas desde tu correo y te das de baja con un clic.</p>
      ${formulario()}
    </div>`;
  document.body.appendChild(caja);
  requestAnimationFrame(() => caja.classList.add('visible'));
  const cerrar = () => { caja.classList.remove('visible'); setTimeout(() => caja.remove(), 300); };
  caja.querySelector('.cerrar').addEventListener('click', () => { guardar({ ...leer(), cerrado: true }); cerrar(); });
  caja.querySelector('form')?.addEventListener('submit', () => {
    guardar({ ...leer(), suscrito: true });
    caja.querySelector('.boletin-cuerpo').insertAdjacentHTML('beforeend',
      '<p class="boletin-nota"><strong>¡Casi listo!</strong> Revisa tu correo y pulsa el enlace de confirmación.</p>');
    setTimeout(cerrar, 6000);
  });
}

/** Primera visita: el banner aparece a los pocos segundos, sin tapar la carga de la página. */
export function iniciarBoletin() {
  setTimeout(() => mostrarBoletin(false), 8000);
  document.getElementById('abrir-boletin')?.addEventListener('click', () => mostrarBoletin(true));
}
