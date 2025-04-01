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
}

async function findStudentInSheet(documentId: string, eventId: string, sheetId: string): Promise<StudentLocation | null> {
  try {
    console.log(`Buscando estudiante en hoja ${sheetId}:`, { documentId, eventId });

    // Obtener todos los datos de la hoja
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'ASISTENCIA',
    });

    const values = response.data.values || [];
    console.log(`Datos obtenidos: ${values.length} filas`);

    // Buscar el título del evento
    let eventColumnIndex = -1;
    for (let row = 0; row < 10; row++) {
      const currentRow = values[row] || [];
      for (let col = 0; col < currentRow.length; col++) {
        const cellValue = String(currentRow[col] || '');
        if (cellValue && cellValue.includes(eventId)) {
          eventColumnIndex = col;
          console.log(`Evento encontrado en [${row},${col}]`);
          break;
        }
      }
      if (eventColumnIndex !== -1) break;
    }

    // Si no se encuentra el evento, crear una nueva columna
    if (eventColumnIndex === -1) {
      console.log(`Evento no encontrado, creando nueva columna...`);
      
      // Encontrar la primera columna disponible después de E (índice 5 = columna F)
      eventColumnIndex = 5;
      const headerRow = values[0] || [];
      for (let i = 5; i < headerRow.length + 1; i++) {
        if (!headerRow[i] || headerRow[i] === '') {
          eventColumnIndex = i;
          break;
        }
      }
      
      const colLetter = String.fromCharCode(65 + eventColumnIndex);
      console.log(`Usando columna ${colLetter} (índice ${eventColumnIndex})`);
      
      // Agregar el ID del evento en la primera fila
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${WORKSHEET_NAME}!${colLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[eventId]]
        }
      });
      
      console.log(`ID del evento agregado a la columna ${colLetter}`);
    }

    // Encontrar la fila del estudiante
    let studentRowIndex = -1;
    for (let i = 6; i < values.length; i++) {
      const rowDocId = values[i] && values[i][3] ? String(values[i][3]).trim() : '';
      const searchDocId = String(documentId).trim();
      
      if (rowDocId === searchDocId) {
        studentRowIndex = i + 1; // +1 porque las filas en Sheets empiezan en 1
        console.log(`Estudiante encontrado en fila ${studentRowIndex}`);
        break;
      }
    }

    if (studentRowIndex === -1) {
      console.log(`Estudiante no encontrado en hoja ${sheetId}`);
      return null;
    }

    return {
      sheetId,
      rowIndex: studentRowIndex,
      columnIndex: eventColumnIndex
    };
  } catch (error) {
    console.error(`Error buscando en hoja ${sheetId}:`, error);
    return null;
  }
}

async function updateAttendance(location: StudentLocation, data: AttendanceRecord) {
  const columnLetter = String.fromCharCode(65 + location.columnIndex);

  // Actualizar la asistencia
  await sheets.spreadsheets.values.update({
    spreadsheetId: location.sheetId,
    range: `${WORKSHEET_NAME}!${columnLetter}${location.rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [["1"]]
    }
  });

  // Actualizar la fecha en la fila 7
  await sheets.spreadsheets.values.update({
    spreadsheetId: location.sheetId,
    range: `${WORKSHEET_NAME}!${columnLetter}7`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[data.eventDate]]
    }
  });

  // Actualizar el total
  const rowResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: location.sheetId,
    range: `${WORKSHEET_NAME}!G${location.rowIndex}:T${location.rowIndex}`,
  });

  const attendanceValues = rowResponse.data.values?.[0] || [];
  const total = attendanceValues.filter(v => v === "1").length;

  await sheets.spreadsheets.values.update({
    spreadsheetId: location.sheetId,
    range: `${WORKSHEET_NAME}!U${location.rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[total]]
    }
  });
}

export async function appendToSheet(data: AttendanceRecord) {
  try {
    console.log('=== Iniciando registro de asistencia ===');
    console.log('Datos recibidos:', data);

    // Verificar presencia de IDs de hojas
    if (!SHEET_IDS.GRUPO1 || !SHEET_IDS.GRUPO2) {
      throw new Error('Faltan IDs de hojas de cálculo en la configuración');
    }

    // Buscar en Grupo 1
    const locationGrupo1 = await findStudentInSheet(data.documentId, data.eventId, SHEET_IDS.GRUPO1);
    if (locationGrupo1) {
      await updateAttendance(locationGrupo1, data);
      return { success: true, message: 'Asistencia registrada en Grupo 1' };
    }

    // Si no está en Grupo 1, buscar en Grupo 2
    const locationGrupo2 = await findStudentInSheet(data.documentId, data.eventId, SHEET_IDS.GRUPO2);
    if (locationGrupo2) {
      await updateAttendance(locationGrupo2, data);
      return { success: true, message: 'Asistencia registrada en Grupo 2' };
    }

    throw new Error('Estudiante no encontrado en ninguno de los grupos');

  } catch (error) {
    console.error('Error registrando asistencia:', error);
    throw error;
  }
}