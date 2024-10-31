"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, UserPlus, QrCode, Share2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
}

interface Student {
  id: string;
  code: string;
  program: string;
  full_name: string;
  document_id: string;
  timestamp: string;
}

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attendances, setAttendances] = useState<Student[]>([]);

  useEffect(() => {
    checkUser();
    loadEventAndAttendances();
  }, [params.id]);

  const checkUser = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    }
  };

  const loadEventAndAttendances = async () => {
    try {
      // Cargar información del evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', params.id)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        router.push('/');
        return;
      }

      setEvent(eventData);

      // Cargar asistencias
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .select(`
          id,
          timestamp,
          students (
            id,
            code,
            program,
            full_name,
            document_id
          )
        `)
        .eq('event_id', params.id)
        .order('timestamp', { ascending: false });

      if (attendanceError) throw attendanceError;
      
      const formattedAttendances = attendanceData?.map((att: any) => ({
        ...att.students,
        timestamp: att.timestamp,
      })) || [];

      setAttendances(formattedAttendances);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar el evento: " + error.message,
      });
      router.push('/');
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Buscar estudiante por documento de identidad
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('document_id', scanInput)
        .single();

      if (studentError || !student) {
        throw new Error('Estudiante no encontrado');
      }

      // Verificar si ya existe la asistencia
      const { data: existingAttendance } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', event?.id)
        .eq('student_id', student.id)
        .single();

      if (existingAttendance) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "El estudiante ya registró asistencia",
        });
        return;
      }

      // Registrar asistencia
      const { error: attendanceError } = await supabase
        .from('attendances')
        .insert([
          {
            event_id: event?.id,
            student_id: student.id,
          }
        ]);

      if (attendanceError) throw attendanceError;

      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${student.full_name}`,
      });

      setScanInput("");
      loadEventAndAttendances();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAttendances = () => {
    if (attendances.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay asistencias para descargar",
      });
      return;
    }

    const csv = [
      ['Código', 'Nombre', 'Programa', 'Documento', 'Hora'].join(','),
      ...attendances.map((student) => [
        student.code,
        student.full_name,
        student.program,
        student.document_id,
        new Date(student.timestamp).toLocaleString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia_${event?.title}_${event?.date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const copyPublicLink = () => {
    const publicLink = `${window.location.origin}/public-attendance/${params.id}`;
    navigator.clipboard.writeText(publicLink);
    toast({
      title: "¡Enlace copiado!",
      description: "El enlace para registro de asistencia ha sido copiado al portapapeles",
    });
  };

  if (!event) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
          <p className="text-muted-foreground">
            Fecha: {new Date(event.date).toLocaleDateString()}
          </p>
          {event.description && (
            <p className="text-muted-foreground mt-2">{event.description}</p>
          )}

          <div className="mt-4 p-4 border rounded-lg bg-muted">
            <h3 className="font-medium mb-2">Enlace para registro de asistencia:</h3>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/public-attendance/${event.id}`}
                className="bg-background"
              />
              <Button variant="outline" onClick={copyPublicLink}>
                <Share2 className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Comparte este enlace con los estudiantes para que registren su asistencia directamente
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Registro de Asistencia</h2>
              <Button onClick={downloadAttendances} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Descargar CSV
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.code}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.program}</TableCell>
                      <TableCell>{student.document_id}</TableCell>
                      <TableCell>
                        {new Date(student.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No hay registros de asistencia
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border h-fit">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Registrar Asistencia</h2>
            </div>
            <form onSubmit={handleScan} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scan">Documento de Identidad</Label>
                <Input
                  id="scan"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Ingrese el documento de identidad"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <UserPlus className="h-4 w-4 mr-2" />
                {loading ? "Registrando..." : "Registrar Asistencia"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}