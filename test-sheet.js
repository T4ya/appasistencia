// Crea un archivo test-sheets.js en la raíz del proyecto
import { appendToSheet } from '@/lib/google-sheets';

async function testGoogleSheets() {
  try {
    console.log("INICIANDO PRUEBA DE GOOGLE SHEETS");
    
    const result = await appendToSheet({
      documentId: "1025537492", // Usa un ID que exista en tu hoja
      eventId: "3ae5a6cc-382c-44ef-8288-ba1d3f124ea1",
      eventTitle: "test",
      eventDate: new Date().toLocaleDateString('es-CO')
    });
    
    console.log("RESULTADO:", result);
  } catch (error) {
    console.error("ERROR EN PRUEBA:", error);
  }
}

testGoogleSheets();