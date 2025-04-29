import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

// IDs de las hojas de cálculo
const SHEET_IDS = {
  GRUPO1: process.env.GOOGLE_SHEET_ID_GRUPO1,
  GRUPO2: process.env.GOOGLE_SHEET_ID_GRUPO2
};

const WORKSHEET_NAME = 'ASISTENCIA';

const auth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

export interface AttendanceRecord {
  documentId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
}

interface StudentLocation {
  sheetId: string;
  rowIndex: number;
  columnIndex: number;
  group: string;
}

// Dump all values to console for inspection
async function dumpSheetValues(sheetId: string) {
  try {
    console.log(`===== DUMPING SHEET DATA FOR ${sheetId} =====`);
    const metaResponse = await sheets.spreadsheets.get({
      spreadsheetId: sheetId
    });
    console.log('Sheets in workbook:', metaResponse.data.sheets?.map(s => s.properties?.title));

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'ASISTENCIA'
    });
    
    const values = response.data.values || [];
    console.log(`Total rows: ${values.length}`);
    
    // Print first rows for inspection
    console.log('First rows sample:');
    for (let i = 0; i < Math.min(10, values.length); i++) {
      console.log(`Row ${i+1}:`, values[i]);
    }
    
    // Print rows starting student data
    console.log('Student data sample:');
    for (let i = 6; i < Math.min(15, values.length); i++) {
      if (values[i] && values[i].length > 3) {
        console.log(`Row ${i+1}:`, {
          code: values[i][0],
          name: values[i][2],
          documentId: values[i][3]
        });
      } else {
        console.log(`Row ${i+1}: Incomplete data`, values[i]);
      }
    }
    
    return values;
  } catch (error) {
    console.error(`Error dumping sheet ${sheetId}:`, error);
    return null;
  }
}

async function findStudentInSheet(documentId: string, eventId: string, sheetId: string, groupName: string): Promise<StudentLocation | null> {
  try {
    console.log(`\n===== BUSCANDO ESTUDIANTE EN HOJA ${sheetId} (${groupName}) =====`);
    console.log('Parámetros de búsqueda:', { documentId, eventId });
    
    // Dump all sheet data for inspection
    const values = await dumpSheetValues(sheetId);
    if (!values) {
      console.error(`No se pudieron obtener datos de la hoja ${sheetId}`);
      return null;
    }

    // Buscar el título del evento
    console.log('\n----- BUSCANDO EVENTO -----');
    let eventColumnIndex = -1;
    let eventFoundInRow = -1;
    
    for (let row = 0; row < 6; row++) {
      const currentRow = values[row] || [];
      console.log(`Revisando fila ${row+1} para evento:`, currentRow);
      
      for (let col = 0; col < currentRow.length; col++) {
        const cellValue = String(currentRow[col] || '');
        console.log(`  Celda [${row+1},${String.fromCharCode(65+col)}]: "${cellValue}" - ¿Contiene "${eventId}"?`);
        
        if (cellValue && cellValue.includes(eventId)) {
          eventColumnIndex = col;
          eventFoundInRow = row + 1;
          console.log(`  ¡ENCONTRADO! Evento en [${eventFoundInRow},${String.fromCharCode(65+col)}]`);
          break;
        }
      }
      if (eventColumnIndex !== -1) break;
    }

    if (eventColumnIndex === -1) {
      console.log(`❌ Evento con ID "${eventId}" NO encontrado en ninguna celda de las primeras 6 filas`);
      return null;
    }

    // Encontrar la fila del estudiante
    console.log('\n----- BUSCANDO ESTUDIANTE -----');
    let studentRowIndex = -1;
    
    console.log(`Buscando documento "${documentId}" en columna D (índice 3)`);
    for (let i = 6; i < values.length; i++) {
      if (values[i] && values[i].length > 3) {
        const rowDocumentId = String(values[i][3] || '').trim();
        const searchDocumentId = String(documentId).trim();
        
        console.log(`  Fila ${i+1}: "${rowDocumentId}" vs "${searchDocumentId}" - ¿Coinciden?`, 
          rowDocumentId === searchDocumentId ? '✅ SÍ' : '❌ NO');
        
        if (rowDocumentId === searchDocumentId) {
          studentRowIndex = i + 1;
          console.log(`  ¡ENCONTRADO! Estudiante en fila ${studentRowIndex}`);
          break;
        }
      } else {
        console.log(`  Fila ${i+1}: Datos insuficientes`, values[i]);
      }
    }

    if (studentRowIndex === -1) {
      console.log(`❌ Estudiante con documento "${documentId}" NO encontrado`);
      return null;
    }

    return {
      sheetId,
      rowIndex: studentRowIndex,
      columnIndex: eventColumnIndex,
      group: groupName
    };
  } catch (error) {
    console.error(`Error buscando en hoja ${sheetId}:`, error);
    return null;
  }
}

async function updateAttendance(location: StudentLocation, data: AttendanceRecord) {
  try {
    console.log(`\n===== ACTUALIZANDO ASISTENCIA EN ${location.group} =====`);
    console.log('Ubicación:', location);
    
    const columnLetter = String.fromCharCode(65 + location.columnIndex);
    const attendanceCell = `${columnLetter}${location.rowIndex}`;
    const dateCell = `${columnLetter}7`;
    
    console.log(`Marcando asistencia en celda ${attendanceCell}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: location.sheetId,
      range: `${WORKSHEET_NAME}!${attendanceCell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [["1"]]
      }
    });
    console.log(`✅ Asistencia registrada en celda ${attendanceCell}`);

    console.log(`Actualizando fecha en celda ${dateCell}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: location.sheetId,
      range: `${WORKSHEET_NAME}!${dateCell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[data.eventDate]]
      }
    });
    console.log(`✅ Fecha actualizada en celda ${dateCell}`);

    // Actualizar el total
    const totalRange = `${WORKSHEET_NAME}!G${location.rowIndex}:T${location.rowIndex}`;
    console.log(`Obteniendo valores para calcular total: ${totalRange}`);
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: location.sheetId,
      range: totalRange,
    });

    const attendanceValues = rowResponse.data.values?.[0] || [];
    console.log('Valores de asistencia:', attendanceValues);
    const total = attendanceValues.filter(v => v === "1").length;

    console.log(`Actualizando total en celda U${location.rowIndex} con valor ${total}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: location.sheetId,
      range: `${WORKSHEET_NAME}!U${location.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[total]]
      }
    });
    console.log(`✅ Total actualizado en celda U${location.rowIndex}`);
    
    return true;
  } catch (error) {
    console.error('Error al actualizar asistencia:', error);
    return false;
  }
}

export async function appendToSheet(data: AttendanceRecord) {
  try {
    console.log('\n\n======================================================');
    console.log('===== INICIANDO REGISTRO DE ASISTENCIA =====');
    console.log('======================================================');
    console.log('Datos recibidos:', data);
    console.log('Variables de entorno:');
    console.log('- GOOGLE_CLIENT_EMAIL:', GOOGLE_CLIENT_EMAIL ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
    console.log('- GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
    console.log('- GOOGLE_SHEET_ID_GRUPO1:', SHEET_IDS.GRUPO1);
    console.log('- GOOGLE_SHEET_ID_GRUPO2:', SHEET_IDS.GRUPO2);

    // Verificar presencia de IDs de hojas
    if (!SHEET_IDS.GRUPO1 || !SHEET_IDS.GRUPO2) {
      throw new Error('Faltan IDs de hojas de cálculo en la configuración');
    }

    // Intentar buscar en ambos grupos
    let successDetails = null;
    
    // Buscar en Grupo 1
    console.log('\n----- BÚSQUEDA EN GRUPO 1 -----');
    const locationGrupo1 = await findStudentInSheet(data.documentId, data.eventId, SHEET_IDS.GRUPO1, 'GRUPO1');
    if (locationGrupo1) {
      console.log('✅ Estudiante encontrado en Grupo 1');
      const result = await updateAttendance(locationGrupo1, data);
      if (result) {
        successDetails = { success: true, message: 'Asistencia registrada en Grupo 1', location: locationGrupo1 };
        // NO RETORNAMOS AQUÍ - Seguimos buscando en Grupo 2 para depuración
      }
    } else {
      console.log('❌ Estudiante NO encontrado en Grupo 1');
    }

    // Buscar en Grupo 2 (siempre intentamos, incluso si ya tuvimos éxito en Grupo 1)
    console.log('\n----- BÚSQUEDA EN GRUPO 2 -----');
    const locationGrupo2 = await findStudentInSheet(data.documentId, data.eventId, SHEET_IDS.GRUPO2, 'GRUPO2');
    if (locationGrupo2) {
      console.log('✅ Estudiante encontrado en Grupo 2');
      // Solo actualizamos si no hemos tenido éxito en Grupo 1
      if (!successDetails) {
        const result = await updateAttendance(locationGrupo2, data);
        if (result) {
          successDetails = { success: true, message: 'Asistencia registrada en Grupo 2', location: locationGrupo2 };
        }
      } else {
        console.log('⚠️ ATENCIÓN: Estudiante encontrado en ambos grupos. Se registró en Grupo 1.');
      }
    } else {
      console.log('❌ Estudiante NO encontrado en Grupo 2');
    }

    // Verificar resultado final
    if (successDetails) {
      console.log('✅ RESULTADO FINAL: Asistencia registrada exitosamente en:', successDetails.location.group);
      return successDetails;
    }

    console.error('❌ RESULTADO FINAL: Estudiante no encontrado en ninguno de los grupos');
    throw new Error('Estudiante no encontrado en ninguno de los grupos');

  } catch (error) {
    console.error('Error registrando asistencia:', error);
    throw error;
  }
}