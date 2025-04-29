import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const SHEET_IDS = {
  GRUPO1: process.env.GOOGLE_SHEET_ID_GRUPO1,
  GRUPO2: process.env.GOOGLE_SHEET_ID_GRUPO2
};

export async function GET(request: Request) {
  try {
    console.log('=== INICIANDO PRUEBA DE CONEXIÓN GOOGLE SHEETS ===');
    console.log('Variables de entorno:');
    console.log('- GOOGLE_CLIENT_EMAIL:', GOOGLE_CLIENT_EMAIL ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
    console.log('- GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
    console.log('- GOOGLE_SHEET_ID_GRUPO1:', SHEET_IDS.GRUPO1);
    console.log('- GOOGLE_SHEET_ID_GRUPO2:', SHEET_IDS.GRUPO2);

    // Verificar presencia de IDs de hojas
    if (!SHEET_IDS.GRUPO1 || !SHEET_IDS.GRUPO2) {
      throw new Error('Faltan IDs de hojas de cálculo en la configuración');
    }

    // Crear cliente para verificar autenticación
    const auth = new JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Verificar acceso a la hoja del Grupo 1
    let grupo1Data;
    try {
      const res1 = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_IDS.GRUPO1
      });
      grupo1Data = {
        title: res1.data.properties?.title,
        sheets: res1.data.sheets?.map(s => s.properties?.title),
        access: true
      };
      console.log('✅ Acceso a GRUPO1 OK');
    } catch(e: any) {
      grupo1Data = {
        error: e.message,
        access: false
      };
      console.error('❌ Error accediendo a GRUPO1:', e.message);
    }

    // Verificar acceso a la hoja del Grupo 2
    let grupo2Data;
    try {
      const res2 = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_IDS.GRUPO2
      });
      grupo2Data = {
        title: res2.data.properties?.title,
        sheets: res2.data.sheets?.map(s => s.properties?.title),
        access: true
      };
      console.log('✅ Acceso a GRUPO2 OK');
    } catch(e: any) {
      grupo2Data = {
        error: e.message,
        access: false
      };
      console.error('❌ Error accediendo a GRUPO2:', e.message);
    }

    // Obtener las primeras filas de ASISTENCIA para verificar
    let estudiantes = [];
    
    if (grupo1Data.access) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_IDS.GRUPO1,
          range: 'ASISTENCIA!A7:D20', // Primeros estudiantes
        });
        
        const values = response.data.values || [];
        estudiantes.push({
          grupo: "GRUPO1",
          muestra: values.slice(0, 5).map(row => ({
            codigo: row[0],
            programa: row[1],
            nombre: row[2],
            documento: row[3]
          }))
        });
      } catch (e) {
        console.error('Error obteniendo estudiantes GRUPO1:', e);
      }
    }
    
    if (grupo2Data.access) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_IDS.GRUPO2,
          range: 'ASISTENCIA!A7:D20', // Primeros estudiantes
        });
        
        const values = response.data.values || [];
        estudiantes.push({
          grupo: "GRUPO2",
          muestra: values.slice(0, 5).map(row => ({
            codigo: row[0],
            programa: row[1],
            nombre: row[2],
            documento: row[3]
          }))
        });
      } catch (e) {
        console.error('Error obteniendo estudiantes GRUPO2:', e);
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      auth: {
        email: GOOGLE_CLIENT_EMAIL,
        privateKeyConfigured: !!GOOGLE_PRIVATE_KEY
      },
      sheets: {
        grupo1: grupo1Data,
        grupo2: grupo2Data
      },
      estudiantes: estudiantes
    });

  } catch (error: any) {
    console.error('Error completo en test:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}