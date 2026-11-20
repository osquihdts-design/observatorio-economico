// Efectos visuales: fondo de partículas, foco de luz e inclinación 3D de las tarjetas,
// apariciones al hacer scroll, números que cuentan, avisos flotantes y transiciones de página.
// Todo se desactiva si el sistema pide «reducir movimiento».

export const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- Fondo de partículas
export function iniciarFondo() {
  const lienzo = document.getElementById('fondo');
  const ctx = lienzo.getContext('2d');
  const raton = { x: -9999, y: -9999 };
  let puntos = [];
  let ancho = 0, alto = 0, ratio = 1;

  function medir() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    ancho = innerWidth;
    alto = innerHeight;
    lienzo.width = ancho * ratio;
    lienzo.height = alto * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cuantos = Math.round(Math.min(40, (ancho * alto) / 34000));
    puntos = Array.from({ length: cuantos }, () => ({
      x: Math.random() * ancho, y: Math.random() * alto,
      vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08, r: Math.random() * 1.2 + 0.5,
    }));
  }

  function color() {
    return getComputedStyle(document.documentElement).getPropertyValue('--particulas').trim() || '130, 174, 230';
  }

  let rgb = color();
  new MutationObserver(() => { rgb = color(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  function cuadro() {
    ctx.clearRect(0, 0, ancho, alto);
    const enlace = 130;
    for (const p of puntos) {
      // Deriva lenta y uniforme: un fondo tranquilo que no distrae de los datos.
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = ancho + 10; if (p.x > ancho + 10) p.x = -10;
      if (p.y < -10) p.y = alto + 10; if (p.y > alto + 10) p.y = -10;
    }
    for (let i = 0; i < puntos.length; i++) {
      const a = puntos[i];
      for (let j = i + 1; j < puntos.length; j++) {
        const b = puntos[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < enlace) {
          ctx.strokeStyle = `rgba(${rgb}, ${0.07 * (1 - d / enlace)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${rgb}, 0.28)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!document.hidden && !sinMovimiento) requestAnimationFrame(cuadro);
  }

  medir();
  addEventListener('resize', medir);
  addEventListener('pointermove', (e) => { raton.x = e.clientX; raton.y = e.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { raton.x = raton.y = -9999; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(cuadro); });
  requestAnimationFrame(cuadro);
}

// ---------------------------------------------------------------- Foco de luz e inclinación 3D
export function iniciarTarjetas() {
  let actual = null;
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('.card, .kpi');
    if (actual && actual !== t && actual.classList.contains('kpi')) actual.style.transform = '';
    actual = t;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    t.style.setProperty('--mx', `${x}px`);
    t.style.setProperty('--my', `${y}px`);
    if (t.classList.contains('kpi') && !sinMovimiento) {
      const rx = ((y / r.height) - 0.5) * -10, ry = ((x / r.width) - 0.5) * 12;
      t.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (actual?.classList.contains('kpi')) actual.style.transform = ''; });
}

// ---------------------------------------------------------------- Apariciones al hacer scroll
const observador = 'IntersectionObserver' in window && !sinMovimiento
  ? new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
  : null;

/** Marca los elementos para que aparezcan escalonados al entrar en pantalla. */
export function revelar(elementos) {
  [...elementos].forEach((el, i) => {
    el.classList.add('revelable');
    el.style.setProperty('--retraso', `${Math.min(i, 8) * 70}ms`);
    if (observador) observador.observe(el); else el.classList.add('visible');
  });
}

// ---------------------------------------------------------------- Números que cuentan
const formato = (v, d) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Anima los elementos con data-contar="valor" (y data-decimales) desde 0 hasta su valor. */
export function contar(raiz) {
  for (const el of raiz.querySelectorAll('[data-contar]')) {
    const final = Number(el.dataset.contar);
    const d = Number(el.dataset.decimales || 0);
    if (sinMovimiento || !Number.isFinite(final)) { el.textContent = formato(final, d); continue; }
    const inicio = performance.now(), dur = 1400;
    const paso = (t) => {
      const k = Math.min(1, (t - inicio) / dur);
      const e = 1 - Math.pow(2, -10 * k); // ease-out exponencial
      el.textContent = formato(final * (k === 1 ? 1 : e), d);
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
}

// ---------------------------------------------------------------- Avisos flotantes
export function avisar(texto, tipo = 'info', ms = 4200) {
  const caja = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = `aviso-flotante ${tipo}`;
  el.textContent = texto;
  caja.appendChild(el);
  setTimeout(() => { el.classList.add('saliendo'); setTimeout(() => el.remove(), 320); }, ms);
}

// ---------------------------------------------------------------- Transición entre páginas
export async function transicion(contenedor, nuevo) {
  if (sinMovimiento || !contenedor.firstChild) { contenedor.replaceChildren(nuevo); return; }
  await contenedor.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' },
    { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(6px)' }], { duration: 160, easing: 'ease-in' }).finished;
  contenedor.replaceChildren(nuevo);
  contenedor.animate([{ opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' },
    { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
