import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Configuración de Google Sheets
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const SHEET_ID_GRUPO1 = process.env.GOOGLE_SHEET_ID_GRUPO1;
const SHEET_ID_GRUPO2 = process.env.GOOGLE_SHEET_ID_GRUPO2;

const auth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

export async function POST(request: Request) {
  try {
    // Obtener datos de la solicitud
    const data = await request.json();
    const { eventId, documentId, studentName } = data;
    
    console.log('=== REGISTRO DIRECTO EN GOOGLE SHEETS ===');
    console.log('Datos recibidos:', { eventId, documentId, studentName });
    
    // Obtener todos los datos de la hoja del Grupo 1
    console.log(`Accediendo a hoja ${SHEET_ID_GRUPO1}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_GRUPO1,
      range: 'ASISTENCIA',
    });
    
    const values = response.data.values || [];
    console.log(`Se encontraron ${values.length} filas en la hoja`);
    
    // Buscar la columna del evento o crear una nueva
    let eventColumnIndex = -1;
    
    // Buscar en las primeras 10 filas (ampliado de 6)
    for (let row = 0; row < 10; row++) {
      const currentRow = values[row] || [];
      for (let col = 0; col < currentRow.length; col++) {
        const cellValue = currentRow[col] || '';
        console.log(`Revisando celda [${row},${col}]: "${cellValue}"`);
        if (cellValue && String(cellValue).includes(eventId)) {
          eventColumnIndex = col;
          console.log(`Evento encontrado en [${row},${col}]`);
          break;
        }
      }
      if (eventColumnIndex !== -1) break;
    }
    
    if (eventColumnIndex === -1) {
      console.log('Evento no encontrado, creando nueva columna...');
      
      // Encontrar primera columna disponible después de la E
      eventColumnIndex = 5; // Columna F por defecto
      
      // Verificar si ya hay columnas ocupadas
      const headerRow = values[1] || [];
      for (let i = 5; i < headerRow.length + 1; i++) {
        if (!headerRow[i] || headerRow[i] === '') {
          eventColumnIndex = i;
          break;
        }
      }
      
      const colLetter = String.fromCharCode(65 + eventColumnIndex);
      console.log(`Usando columna ${colLetter} (índice ${eventColumnIndex})`);
      
      // Actualizar la columna con el ID del evento
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID_GRUPO1,
        range: `ASISTENCIA!${colLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[eventId]]
        }
      });
      
      console.log(`ID del evento agregado a la columna ${colLetter}1`);
    }
    
    // Buscar la fila del estudiante
    let studentRowIndex = -1;
    
    for (let i = 7; i < values.length; i++) {
      // El documento de identidad está en la columna D (índice 3)
      const rowDocId = values[i] && values[i][3] ? String(values[i][3]).trim() : '';
      const searchDocId = String(documentId).trim();
      
      console.log(`Comparando: "${rowDocId}" con "${searchDocId}"`);
      
      if (rowDocId === searchDocId) {
        studentRowIndex = i + 1; // +1 porque las filas en Sheets empiezan en 1
        console.log(`Estudiante encontrado en fila ${studentRowIndex}`);
        break;
      }
    }
    
    if (studentRowIndex === -1) {
      // Si no se encontró en Grupo 1, intentar con Grupo 2
      if (SHEET_ID_GRUPO2) {
        console.log(`Estudiante no encontrado en Grupo 1, buscando en Grupo 2...`);
        
        const response2 = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID_GRUPO2,
          range: 'ASISTENCIA',
        });
        
        const values2 = response2.data.values || [];
        
        for (let i = 7; i < values2.length; i++) {
          const rowDocId = values2[i] && values2[i][3] ? String(values2[i][3]).trim() : '';
          const searchDocId = String(documentId).trim();
          
          if (rowDocId === searchDocId) {
            // Si se encuentra en Grupo 2, repetir el proceso con esa hoja
            let eventColumnIndex2 = -1;
            
            for (let row = 0; row < 10; row++) {
              const currentRow = values2[row] || [];
              for (let col = 0; col < currentRow.length; col++) {
                if (currentRow[col] && String(currentRow[col]).includes(eventId)) {
                  eventColumnIndex2 = col;
                  break;
                }
              }
              if (eventColumnIndex2 !== -1) break;
            }
            
            if (eventColumnIndex2 === -1) {
              eventColumnIndex2 = 5;
              const headerRow = values2[1] || [];
              for (let j = 5; j < headerRow.length + 1; j++) {
                if (!headerRow[j] || headerRow[j] === '') {
                  eventColumnIndex2 = j;
                  break;
                }
              }
              
              const colLetter = String.fromCharCode(65 + eventColumnIndex2);
              
              await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID_GRUPO2,
                range: `ASISTENCIA!${colLetter}1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                  values: [[eventId]]
                }
              });
            }
            
            const columnLetter = String.fromCharCode(65 + eventColumnIndex2);
            await sheets.spreadsheets.values.update({
              spreadsheetId: SHEET_ID_GRUPO2,
              range: `ASISTENCIA!${columnLetter}${i+1}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [["1"]]
              }
            });
            
            await sheets.spreadsheets.values.update({
              spreadsheetId: SHEET_ID_GRUPO2,
              range: `ASISTENCIA!${columnLetter}7`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[new Date().toLocaleDateString('es-CO')]]
              }
            });
            
            return NextResponse.json({
              success: true,
              message: `Asistencia registrada para ${studentName || 'estudiante'} en Google Sheets (Grupo 2)`,
              location: `Grupo 2, Celda ${columnLetter}${i+1}`
            });
          }
        }
      }
      
      return NextResponse.json(
        { error: `Estudiante con documento ${documentId} no encontrado en ninguna hoja` },
        { status: 404 }
      );
    }
    
    // Actualizar la asistencia
    const columnLetter = String.fromCharCode(65 + eventColumnIndex);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID_GRUPO1,
      range: `ASISTENCIA!${columnLetter}${studentRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [["1"]]
      }
    });
    
    console.log(`Asistencia actualizada en celda ${columnLetter}${studentRowIndex}`);
    
    // Actualizar la fecha en la fila 7
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID_GRUPO1,
      range: `ASISTENCIA!${columnLetter}7`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toLocaleDateString('es-CO')]]
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Asistencia registrada para ${studentName || 'estudiante'} en Google Sheets`,
      location: `Celda ${columnLetter}${studentRowIndex}`
    });

  } catch (error: any) {
    console.error('Error en la API de asistencia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}