import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { eventId, documentId } = await request.json();

    // 1. Obtener información del evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    // 2. Buscar estudiante por documento
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Estudiante no encontrado' },
        { status: 404 }
      );
    }

    // 3. Verificar si ya existe la asistencia
    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('*')
      .eq('event_id', eventId)
      .eq('student_id', student.id)
      .single();

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Ya registraste tu asistencia para este evento' },
        { status: 400 }
      );
    }

    // 4. Registrar asistencia en Supabase
    const { error: attendanceError } = await supabase
      .from('attendances')
      .insert([
        {
          event_id: eventId,
          student_id: student.id,
        }
      ]);

    if (attendanceError) throw attendanceError;

    // 5. Registrar asistencia en Google Sheets (usando el endpoint directo)
    try {
      const sheetsResponse = await fetch(new URL('/api/attendance-fix', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          documentId: student.document_id,
          studentName: student.full_name
        }),
      });
      
      const sheetsResult = await sheetsResponse.json();
      console.log('Resultado Google Sheets (API):', sheetsResult);
    } catch (sheetError) {
      console.error('Error registrando en Google Sheets:', sheetError);
      // Continuamos con la ejecución aunque falle Google Sheets
    }

    return NextResponse.json({
      message: 'Asistencia registrada correctamente',
      student: {
        full_name: student.full_name,
        document_id: student.document_id,
      }
    });

  } catch (error: any) {
    console.error('Error registrando asistencia:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}