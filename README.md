# ⚕️ MedEval PWA - Evaluaciones Clínicas Simultáneas en Medicina Familiar

PWA móvil de alto rendimiento, **offline-first**, ligera (< 150 KB) y **100% autocalificable** diseñada para reemplazar formularios estáticos (Google Forms) mediante mecánicas interactivas táctiles que evalúan juicio clínico real sin preguntas de texto libre.

---

## 🚀 Arquitectura y Características Principales

### 1. Pantalla de Bienvenida y Sincronización Simultánea (Lobby)
- **Formulario inicial:** Nombre completo, Carné / Matrícula estudiantil y PIN de 4 dígitos.
- **Sincronización en aula:** El botón *"Iniciar Evaluación"* permanece inhabilitado hasta que el estudiante introduce el PIN dictado por el docente en el aula (`SESSION_PIN`).
- **Iniciación:** Registro de hora exacta de arranque, temporizador regresivo global con alerta visual al restar 1 minuto y solicitud opcional de pantalla completa (`Fullscreen API`).

### 2. Seguridad Anti-Colusión y Telemetría Forense
- **Barajado Pseudoaleatorio Determinista (`Mulberry32 PRNG`):** 
  El Carné del alumno actúa como semilla (`seed`). Genera un orden de preguntas y de opciones completamente único para cada estudiante. Dos alumnos sentados juntos verán pantallas y opciones distintas, pero el docente puede reproducir con exactitud la prueba a partir del carné.
- **Detector de Foco y Visibilidad (`blur` / `visibilitychange`):**
  Monitorea en tiempo real si el estudiante minimiza la app, cambia de pestaña o abre mensajería (WhatsApp/Telegram). Muestra una alerta intrusiva en pantalla y contabiliza las incidencias (`cambios_de_pestana`) en la entrega final.
- **Flujo Progresivo Bloqueante (*Gated Steps*):**
  Al pulsar *"Confirmar y Avanzar"*, un modal advierte: *"Esta etapa quedará bloqueada definitivamente"*. Al confirmar, el paso se sella en la máquina de estados; no existe botón de retroceso ni modificación de respuestas previas.

### 3. Motor de Componentes Interactivos (5 Widgets Clínicos)
| Widget | Mecánica Táctil | Criterio de Juicio Clínico Evaluado | Modelo de Calificación |
|---|---|---|---|
| **`semaforo_evidencia`** | Clasificación 1-tap en 3 columnas: [Fuerte], [Selectiva], [Iatrogénica] | Manejo de evidencia preventiva (USPSTF / PAPPS) y no maleficencia | Suma por aciertos y **penaliza con resta de puntos** clasificar prácticas iatrogénicas como "Recomendación Fuerte". |
| **`decision_binaria`** | Tarjetas grandes tipo Toggle: [PROCEDER] vs [DIFERIR] | Oportunidad vacunal y descarte de falsas contraindicaciones | Todo o nada (1 punto / 0 puntos). |
| **`presupuesto_restringido`** | Pick-N con bloqueo estricto (ej. "Exactamente 2 estudios") | Uso racional de recursos y costo-efectividad diagnóstica | Ponderación diferencial (+5 por pertinente, -2 por innecesario). Bloqueo visual ante intento de exceso. |
| **`umbral_slider`** | Control deslizante (`<input type="range">`) con lectura en vivo | Conocimiento de puntos de corte clínicos y guías de práctica clínica | Ventana paramétrica: 100% acierto exacto ($\pm \text{margen}$), 50% en rango cercano. |
| **`script_concordance`** | Matriz SCT táctil de 5 niveles: `[-2]` a `[+2]` | Concordancia de guiones cognitivos ante nuevos hallazgos | Ponderación por panel de expertos (ej. 1.0, 0.6, 0.0) según consenso de la literatura médica. |

---

## 📊 Integración con Google Sheets (Apps Script Webhook)

La aplicación envía un único `POST` al finalizar la evaluación con la siguiente estructura:

```json
{
  "carnet": "MED-2023-908",
  "nombre": "Carlos Méndez",
  "nota_final": 8.50,
  "tiempo_empleado_segundos": 420,
  "cambios_de_pestana": 0,
  "token_seguridad": "c8a413d969eb2e0b503e9105cb9b52a7",
  "respuestas_detalle": {
    "desglose_calificacion": { ... },
    "telemetria_cambios": [ ... ],
    "tiempos_por_etapa": { ... },
    "respuestas_brutas": { ... }
  }
}
```

### Pasos para configurar el Backend en Google Sheets:
1. Crea una hoja de cálculo en blanco en [Google Drive](https://drive.google.com).
2. Ve a **Extensiones > Apps Script**.
3. Pega el código que se encuentra en [`google-apps-script.js`](file:///f:/Documentos/Examenes_parciales/google-apps-script.js).
4. Haz clic en **Implementar > Nueva implementación**.
5. Selecciona tipo **Aplicación web**:
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** *Cualquier usuario* (Anyone).
6. Tu URL de Webhook ya ha sido vinculada y probada exitosamente en `CONFIG.WEBHOOK_URL` dentro de [`index.html`](file:///f:/Documentos/Examenes_parciales/index.html#L213):
   `https://script.google.com/macros/s/AKfycbzxtS26_PqR-ONHTWL6qEYEhHQOUwBNc4-YGhLGpzE3pwELqiE8yLbkHqyT0OfCmdLCkw/exec`

---

## 📶 Estrategia Offline-First y Resiliencia en el Aula

En aulas universitarias con 50-100 estudiantes simultáneos, el colapso del WiFi o de los datos móviles es común:

1. **Service Worker (`sw.js`):** El navegador guarda en caché el HTML, el manifest y el CDN de Tailwind tras la primera apertura, permitiendo abrir la prueba en modo avión.
2. **Auto-guardado en `localStorage`:** Cada cambio de slider, selección de botón o segundo transcurrido persiste en el teléfono. Si el navegador se cierra o el teléfono se apaga, la prueba se restaura automáticamente en la misma etapa.
3. **Mecanismo de Respaldo Físico / Digital:**
   - Si no hay red al finalizar, la pantalla de resultados permanece activa con la nota matemática calculada.
   - El estudiante dispone de botones para **Copiar Comprobante** o **Descargar JSON** con el hash criptográfico anti-fraude.
   - La firma criptográfica SHA-256 (`token_seguridad`) imposibilita que el alumno altere su nota manualmente.

---

## 💡 Sugerencias y Mejoras de Arquitectura EdTech

Como desarrollador Senior y especialista EdTech médico, se recomiendan las siguientes mejoras evolutivas:

1. **Generador de Código QR de Entrega sin Internet (Proctor QR Scan):**
   - *Concepto:* Al terminar el examen, la PWA puede codificar el JSON comprimido en un código QR dinámico en pantalla.
   - *Beneficio:* El docente camina por el aula y escanea con su propia cámara los teléfonos de los estudiantes sin que ellos necesiten internet, registrando la nota instantáneamente en su propio dispositivo.
2. **Penalización Diagnóstica por Cascada Iatrogénica:**
   - En el widget `presupuesto_restringido`, solicitar pruebas invasivas (ej. endoscopia innecesaria) no solo debe restar puntos, sino que puede activar un modal de "Evento Adverso" o "Complicación Iatrogénica" en la retroalimentación formativa.
3. **Inyección Dinámica de Exámenes vía URL:**
   - Permitir cargar bancos de preguntas mediante un parámetro URL (ej. `index.html?eval=parcial_cardiologia.json`). De este modo, un único frontend sirve para todas las rotaciones clínicas sin modificar código.
4. **Monitor de Batería y Red (Network Information API):**
   - Advertir al estudiante si su batería está por debajo del 15% o si la conexión es intermitente antes de desbloquear el botón de inicio.
5. **Rúbrica de Concordancia SCT Multicéntrica:**
   - Permitir que las ponderaciones del Script Concordance Test se calculen importando directamente los juicios de un panel de 5 a 10 docentes de medicina familiar.
