---
name: webapp-testing
description: Protocolo para probar la web del Observatorio (servidor.py + web/) en un navegador real con Playwright. Úsalo siempre que construyas o cambies algo visible en web/ o en la API de servidor.py, o al depurar un fallo de la interfaz: arranca el servidor real, recorre el flujo, revisa la consola y toma capturas de los estados vacío, cargado y de error antes de dar la tarea por terminada.
---

# Protocolo de pruebas de la web

Cuando construyas una función de la interfaz o arregles un fallo visual, sigue este ciclo.
No des la tarea por terminada sin haberlo completado.

## Reglas
1. **Nada de simulaciones:** prueba contra el `servidor.py` real con la base SQLite real, no con
   HTML suelto ni respuestas inventadas (salvo que el usuario lo pida). Los tests de `tests/` ya
   cubren la API con una base temporal; esto es la prueba de punta a punta en el navegador.
2. **Pruebas visuales:** captura los estados clave de lo que cambiaste — vacío (antes de elegir
   datos, sin resultados), cargado y error — en tema claro y oscuro si tocaste estilos, y a ancho
   de móvil (375 px) si tocaste la maquetación.

## Diferencias con el protocolo genérico (por este Windows)
- **Sin venv ni `pip install`:** Smart App Control bloquea las DLL sin firmar, y el proyecto usa
  solo la biblioteca estándar. El Python es `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`.
- **Sin script de Playwright propio:** no añadas `playwright` como dependencia (ni de Python ni de
  npm). Usa el servidor MCP de Playwright (`mcp__playwright__*`, cárgalas con ToolSearch). Para un
  flujo largo con guion, `browser_run_code_unsafe` ejecuta código de Playwright (`page.goto`,
  `page.waitForLoadState('networkidle')`, `page.click`…) en una sola llamada. El navegador
  integrado (`mcp__Claude_Browser__*`) vale como alternativa.

## Pasos

### 1. Preparar y arrancar el servidor
- En un worktree, `data/processed/` está vacío y el servidor descargaría todo de internet al
  arrancar. Copia antes la base del repositorio principal (no se versiona):
  `cp <repo principal>/data/processed/observatorio.sqlite data/processed/`.
- Arráncalo en segundo plano (Bash con `run_in_background`):
  `python -u servidor.py --sin-abrir` (`-u` para que la salida no se quede en el búfer). Si el
  8501 está ocupado (otro servidor, p. ej. el del repositorio principal) elige el siguiente puerto
  libre: lee la línea «Observatorio económico en http://localhost:…» de su salida, o búscalo con
  `netstat -ano | grep ":850[0-9] .*LISTEN"`.
- Si cambias Python, para y vuelve a arrancar el servidor; los cambios en `web/` basta con recargar.

### 2. Reconocer y actuar
- Navega a `http://localhost:<puerto>/#/<pagina>` y espera a `networkidle`.
- Lee la estructura con `browser_snapshot` antes de hacer clic: saca los selectores del estado
  real, no los adivines.
- Recorre el flujo del usuario (clics, campos, atajos como Ctrl+K o `L`).
- Comprueba los datos con JavaScript (`browser_evaluate`), no solo con capturas: que los gráficos
  de Plotly tengan trazas (`document.querySelectorAll('.js-plotly-plot')` y su `.data`), que las
  cifras no salgan `NaN`/`undefined`, que los ejes tengan título y unidad.
- Las tarjetas `.revelable` solo aparecen al entrar en pantalla: antes de una captura de página
  completa añade la clase `visible` a todas
  (`document.querySelectorAll('.revelable').forEach(e => e.classList.add('visible'))`).
- Tema: cámbialo como el usuario, con la tecla `t` (o el botón), no tocando `data-tema` a mano:
  así los gráficos de Plotly se redibujan con los colores del tema (si no, quedan los del otro
  tema y parecerá un fallo de contraste que no existe).
- Estado de error: con `page.route('**/api/series**', r => r.fulfill({status: 500, …}))` y
  recargando, la página debe mostrar «No se pudo cargar la página: …» sin romperse. Quita la ruta
  (`page.unroute`) en cuanto tengas la captura; el error de consola de esa petición es esperado.

### 3. Depurar
- Si algo falla: lee la consola (`browser_console_messages`, nivel error), las peticiones fallidas
  (`browser_network_requests`) y la salida del servidor; toma una captura; corrige el código y
  repite el paso 2 hasta que no haya errores.
- Ejecuta `python -m unittest` si tocaste Python: debe pasar entero.

### 4. Demostración final
- Presenta la prueba: las capturas de los estados (guárdalas en el scratchpad, no en el
  repositorio) y un resumen de la verificación — páginas recorridas, errores de consola (deben ser
  0), peticiones fallidas y resultado de los tests.
- Al terminar, para el servidor que arrancaste y cierra el navegador (`browser_close`).
