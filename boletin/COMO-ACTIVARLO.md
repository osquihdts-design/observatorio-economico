# Cómo activar el boletín por correo (gratis, con Gmail)

El boletín funciona con tres piezas gratuitas de Google:

- una **hoja de cálculo** donde se apuntan los suscriptores;
- un **programa** (Google Apps Script, el archivo [`Codigo.gs`](Codigo.gs)) que confirma altas, envía el resumen y gestiona las bajas;
- una cuenta de **Gmail** desde la que salen los correos.

Tardas unos 10 minutos y solo hay que hacerlo una vez.

> **Consejo de privacidad:** los suscriptores verán la dirección desde la que llegan los correos. Para no enseñar tu Gmail personal,
> crea una cuenta nueva solo para el proyecto (por ejemplo, `observatorio.economico.boletin@gmail.com`) y haz todos los pasos con ella.

## 1. Crear la hoja y pegar el programa

1. Entra en <https://sheets.google.com> con la cuenta del proyecto y crea una **hoja de cálculo en blanco**.
   Ponle de nombre «Boletín Observatorio».
2. En el menú, ve a **Extensiones → Apps Script**. Se abre el editor de código.
3. Borra lo que haya en el archivo `Código.gs` y pega **todo** el contenido de [`Codigo.gs`](Codigo.gs).
4. Pulsa el icono del disquete (**Guardar**).

## 2. Ejecutar «instalar» una vez

1. Arriba, en el desplegable de funciones, elige **instalar** y pulsa **Ejecutar**.
2. Google te pedirá permisos («Revisar permisos»). Elige la cuenta del proyecto.
   Como el programa es tuyo y no está verificado por Google, saldrá un aviso: pulsa **Configuración avanzada → Ir a … (no seguro)** y después **Permitir**.
   Los permisos son para: leer y escribir en esta hoja, enviar correos en tu nombre, leer la web del Observatorio y programar el envío diario.
3. Al terminar verás «Listo: hoja creada y envío diario programado». En la hoja aparece una pestaña **Suscriptores**.

## 3. Publicarlo como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje de «Seleccionar tipo», elige **Aplicación web**.
3. Rellena:
   - **Ejecutar como:** Yo (la cuenta del proyecto)
   - **Quién tiene acceso:** Cualquier usuario
4. Pulsa **Implementar** y copia la **URL de la aplicación web**. Empieza por `https://script.google.com/macros/s/` y termina en `/exec`.

## 4. Pasar la URL

Pásale la URL a Claude (o pégala tú en `web/js/boletin.js`, en `BOLETIN_URL`) y publica la web.
Desde ese momento el banner muestra el formulario para suscribirse.

## Cómo funciona después

- **Alta:** la persona escribe su correo en la web, acepta la nota de privacidad y recibe un correo para **confirmar**. Sin confirmar no recibe nada.
- **Envío:** cada día, entre las 10 y las 11 (hora de Madrid), el programa mira si la web ha publicado novedades.
  Si las hay, manda el resumen a los confirmados; si no, no manda nada. **Nunca más de un correo al día.**
- **Baja:** cada correo lleva un enlace «Darme de baja», que **borra** la dirección de la hoja.
- **Límite de Google:** las cuentas de Gmail pueden enviar a **100 destinatarios al día** con este sistema
  (contando también los correos de confirmación). Si el boletín crece más, se puede pasar a un servicio de boletines.
- **Abusos:** como mucho se envían 30 correos de confirmación al día, y un campo oculto frena a los robots.

## Si cambias el código

Después de editar `Codigo.gs` en el editor: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: nueva → Implementar**.
La URL sigue siendo la misma.
