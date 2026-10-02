/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - RECEPTOR DE EVALUACIONES CLÍNICAS (MEDEVAL PWA)
 * ============================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crea una hoja de cálculo nueva en Google Drive (ej. "Respuestas_Parcial_Medicina_Familiar").
 * 2. En el menú superior: Extensiones > Apps Script.
 * 3. Borra el código por defecto y pega este archivo completo.
 * 4. Ajusta la constante SALT_INTEGRITY para que coincida con la de tu frontend index.html.
 * 5. Haz clic en "Implementar" (Deploy) > "Nueva implementación" (New deployment).
 * 6. Tipo: "Aplicación web" (Web app).
 * 7. Ejecutar como: "Yo" (Tu cuenta de Google).
 * 8. Quién tiene acceso: "Cualquier usuario" (Anyone).
 * 9. Copia la "URL de la aplicación web" (termina en /exec) y pégala en CONFIG.WEBHOOK_URL de tu index.html.
 */

// Debe coincidir exactamente con CONFIG.SALT_INTEGRITY en index.html
const SALT_INTEGRITY = "MEDEVAL-FAMILIAR-HASH-2026-SECURE";

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Bloqueo de 30 segundos para evitar colisiones de concurrencia en aulas masivas
  lock.tryLock(30000);

  try {
    const rawData = e.postData.contents;
    const data = JSON.parse(rawData);

    const sheet = getOrCreateResponsesSheet();

    // 1. Validar duplicados por Carné
    const carnetColValues = sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    const isDuplicate = carnetColValues.some(row => row[0].toString().trim().toUpperCase() === data.carnet.toString().trim().toUpperCase());

    // 2. Validación de integridad criptográfica (Anti-Tampering)
    const isValidToken = verifyToken(data);

    // 3. Formatear tiempo empleado a mm:ss
    const totalSecs = data.tiempo_empleado_segundos || 0;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tiempoFormateado = `${mins}m ${secs}s`;

    // 4. Registrar fila
    const nuevaFila = [
      new Date(),                                     // A: Fecha y hora exacta
      data.carnet.toString().trim().toUpperCase(),    // B: Carné / Matrícula
      data.nombre,                                    // C: Nombre completo
      parseFloat(data.nota_final),                    // D: Nota Final (0 - 10)
      totalSecs,                                      // E: Tiempo (segundos)
      tiempoFormateado,                               // F: Tiempo Formateado
      parseInt(data.cambios_de_pestana, 10),          // G: Cambios de Pestaña (Incidencias)
      data.token_seguridad,                           // H: Token Hash Enviado
      isValidToken ? "VÁLIDO" : "POSIBLE ALTERACIÓN", // I: Auditoría de Integridad
      isDuplicate ? "DUPLICADO / REINTENTO" : "ORIGINAL", // J: Estado de Envío
      JSON.stringify(data.respuestas_detalle)         // K: Detalle JSON de Respuestas
    ];

    sheet.appendRow(nuevaFila);

    // Formato condicional / colores automáticos para alertas
    const lastRow = sheet.getLastRow();
    if (!isValidToken) {
      sheet.getRange(lastRow, 9).setBackground("#fecaca").setFontColor("#991b1b").setFontWeight("bold");
    }
    if (data.cambios_de_pestana > 0) {
      sheet.getRange(lastRow, 7).setBackground("#fef3c7").setFontColor("#92400e").setFontWeight("bold");
    }
    if (data.nota_final >= 6.0) {
      sheet.getRange(lastRow, 4).setFontColor("#166534").setFontWeight("bold");
    } else {
      sheet.getRange(lastRow, 4).setFontColor("#991b1b").setFontWeight("bold");
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Examen recibido y auditado correctamente",
      carnet: data.carnet,
      nota_final: data.nota_final,
      integridad: isValidToken ? "valido" : "invalido"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "MedEval PWA Webhook Receiver",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Inicializa o busca la pestaña con los encabezados adecuados
function getOrCreateResponsesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Respuestas_Evaluacion");
  
  if (!sheet) {
    sheet = ss.insertSheet("Respuestas_Evaluacion");
    const headers = [
      "Marca Temporal",
      "Carné / Matrícula",
      "Nombre del Estudiante",
      "Nota Final (0-10)",
      "Tiempo (seg)",
      "Tiempo Empleado",
      "Incidencias (Foco/Pestaña)",
      "Token Criptográfico",
      "Auditoría Integridad",
      "Estado Registro",
      "JSON Respuestas y Telemetría"
    ];
    
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0d9488")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

// Verifica la firma SHA-256 generada en el frontend
function verifyToken(data) {
  try {
    const rawString = `${data.carnet}|${data.nota_final}|${data.tiempo_empleado_segundos}|${data.cambios_de_pestana}|${SALT_INTEGRITY}`;
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawString, Utilities.Charset.UTF_8);
    
    let expectedHex = "";
    for (let i = 0; i < rawHash.length; i++) {
      let byteVal = rawHash[i];
      if (byteVal < 0) byteVal += 256;
      let byteStr = byteVal.toString(16);
      if (byteStr.length === 1) byteStr = "0" + byteStr;
      expectedHex += byteStr;
    }
    expectedHex = expectedHex.substring(0, 32);

    // Compara el hash generado
    return expectedHex.toLowerCase() === (data.token_seguridad || "").toLowerCase();
  } catch (err) {
    // Si el cliente usó el fallback determinista en navegadores antiguos
    return (data.token_seguridad || "").startsWith("HASH-");
  }
}
