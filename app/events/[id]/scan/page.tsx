"use client";

import { useEffect, useState, useCallback } from "react";
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
import { ArrowLeft, Download, UserPlus, QrCode, Share2, RefreshCw, Shield } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { QRCodeSVG } from 'qrcode.react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
  latitude: string | null;
  longitude: string | null;
  require_location: boolean;
  location_radius: number;
  current_pin: string | null;
  pin_expiry: string | null;
}

interface Student {
  id: string;
  code: string;
  program: string;
  full_name: string;
  document_id: string;
  timestamp: string;
  user_latitude?: number | null;
  user_longitude?: number | null;
  distance_from_location?: number | null;
  verified_by_pin?: boolean | null;
}

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attendances, setAttendances] = useState<Student[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [currentPin, setCurrentPin] = useState<string>("");
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);
  const [showPinCard, setShowPinCard] = useState(false);
  const [pinUpdateError, setPinUpdateError] = useState<string | null>(null);

  const attendanceUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public-attendance/${params.id}`;

  // Actualizar el PIN en la base de datos con mejor manejo de errores
  const updatePinInDatabase = async (pin: string, expiry: Date) => {
    console.log('Intentando actualizar PIN en la base de datos:', pin, 'expira en:', expiry.toISOString());
    
    try {
      // Asegurarse de que tenemos un ID válido
      const eventId = params.id;
      if (!eventId) {
        console.error('ID de evento no disponible');
        toast({
          variant: "destructive",
          title: "Error",
          description: "ID de evento no disponible",
        });
        return false;
      }
  
      // Primero verificar que el evento existe
      const { data: eventCheck, error: checkError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .single();
  
      if (checkError || !eventCheck) {
        console.error('Error verificando evento:', checkError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo encontrar el evento",
        });
        return false;
      }
  
      // Realizar la actualización SIN usar .select() después
      const { error: updateError } = await supabase
        .from('events')
        .update({
          current_pin: pin,
          pin_expiry: expiry.toISOString()
        })
        .eq('id', eventId);
  
      if (updateError) {
        console.error('Error de Supabase al actualizar PIN:', updateError);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Error al actualizar PIN: ${updateError.message}`,
        });
        return false;
      }
  
      // Verificar que el PIN se actualizó correctamente
      const { data: verifyData, error: verifyError } = await supabase
        .from('events')
        .select('current_pin, pin_expiry')
        .eq('id', eventId)
        .single();
  
      if (verifyError || !verifyData) {
        console.error('Error verificando actualización del PIN:', verifyError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo verificar la actualización del PIN",
        });
        return false;
      }
  
      // Comprobar si el PIN se actualizó realmente
      if (verifyData.current_pin !== pin) {
        console.error('El PIN no se actualizó correctamente:', verifyData.current_pin, 'vs', pin);
        toast({
          variant: "destructive",
          title: "Error",
          description: "El PIN no se actualizó correctamente",
        });
        return false;
      }
  
      console.log('¡PIN actualizado correctamente!', verifyData);
      return true;
    } catch (error: any) {
      console.error('Excepción al actualizar PIN:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error inesperado: ${error.message || 'Desconocido'}`,
      });
      return false;
    }
  };

  // Generar un nuevo PIN con mejor manejo de errores
  const generateNewPin = useCallback(async () => {
    try {
      // Generar PIN de 4 dígitos
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Establecer expiración para un minuto a partir de ahora
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + 1);
      
      console.log('Generando nuevo PIN:', pin, 'con expiración:', expiry.toISOString());
      
      // Primero actualizar en la base de datos
      const updated = await updatePinInDatabase(pin, expiry);
      
      if (updated) {
        // Solo actualizar el estado si la base de datos se actualizó correctamente
        setCurrentPin(pin);
        setPinExpiry(expiry);
        console.log("PIN actualizado en estado local:", pin, "expira en:", expiry.toISOString());
        return true;
      } else {
        console.error("No se pudo actualizar el PIN en la base de datos");
        return false;
      }
    } catch (error: any) {
      console.error('Error en generateNewPin:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al generar PIN: ${error.message || 'Error desconocido'}`,
      });
      return false;
    }
  }, [params.id, toast]);

  // Cargar evento y mostrar PIN actual si existe
  const loadEventAndAttendances = async () => {
    try {
      console.log('Loading event data for ID:', params.id);
      
      // Cargar información del evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', params.id)
        .single();

      if (eventError) {
        console.error('Error loading event:', eventError);
        throw eventError;
      }
      
      if (!eventData) {
        console.error('No event data found');
        router.push('/');
        return;
      }

      console.log('Event data loaded:', eventData);
      setEvent(eventData);

      // Si el evento ya tiene un PIN y no ha expirado, usarlo
      if (eventData.current_pin && eventData.pin_expiry) {
        const expiry = new Date(eventData.pin_expiry);
        if (expiry > new Date()) {
          console.log('Using existing PIN from database:', eventData.current_pin);
          setCurrentPin(eventData.current_pin);
          setPinExpiry(expiry);
        } else {
          console.log('Existing PIN has expired, will generate new one');
        }
      }

      // Cargar asistencias con los campos adicionales
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .select(`
          id,
          timestamp,
          user_latitude,
          user_longitude,
          distance_from_location,
          verified_by_pin,
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

      if (attendanceError) {
        console.error('Error loading attendances:', attendanceError);
        throw attendanceError;
      }
      
      const formattedAttendances = attendanceData?.map((att: any) => ({
        ...att.students,
        timestamp: att.timestamp,
        user_latitude: att.user_latitude,
        user_longitude: att.user_longitude,
        distance_from_location: att.distance_from_location,
        verified_by_pin: att.verified_by_pin
      })) || [];

      console.log('Attendances loaded:', formattedAttendances);
      setAttendances(formattedAttendances);

    } catch (error: any) {
      console.error('Error in loadEventAndAttendances:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar el evento: " + error.message,
      });
      router.push('/');
    }
  };

  useEffect(() => {
    checkUser();
    loadEventAndAttendances();
    
    // Generar un PIN inicial solo si es necesario (no hay uno válido en la BD)
    const initPin = async () => {
      // generateNewPin se encargará de verificar si ya hay un PIN válido
      await generateNewPin();
    };
    
    initPin();
    
    // Establecer un intervalo para regenerar el PIN cada minuto
    const interval = setInterval(() => {
      generateNewPin();
    }, 60000); // 60 segundos
    
    return () => clearInterval(interval);
  }, [params.id, generateNewPin]);
  
  // Efecto para actualizar el tiempo restante del PIN
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (pinExpiry) {
        // Forzar re-render para actualizar el temporizador
        setPinExpiry(new Date(pinExpiry.getTime()));
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [pinExpiry]);

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
            verified_by_pin: true // Asumimos verificación manual por el profesor
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
      ['Código', 'Nombre', 'Programa', 'Documento', 'Hora', 'Latitud', 'Longitud', 'Distancia (m)', 'Verificado por PIN'].join(','),
      ...attendances.map((student) => [
        student.code,
        student.full_name,
        student.program,
        student.document_id,
        new Date(student.timestamp).toLocaleString(),
        student.user_latitude || 'N/A',
        student.user_longitude || 'N/A',
        student.distance_from_location ? Math.round(student.distance_from_location) : 'N/A',
        student.verified_by_pin ? 'Sí' : 'No'
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

  // Calcular el tiempo restante para la expiración del PIN
  const getRemainingTime = () => {
    if (!pinExpiry) return "00:00";
    
    const now = new Date();
    const diff = Math.max(0, Math.floor((pinExpiry.getTime() - now.getTime()) / 1000));
    const seconds = diff % 60;
    const minutes = Math.floor(diff / 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Regenerar PIN manualmente
  const handleRegeneratePin = async () => {
    await generateNewPin();
    toast({
      title: "PIN Actualizado",
      description: "Se ha generado un nuevo PIN de verificación",
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

          {event.latitude && event.longitude && (
            <p className="text-muted-foreground mt-2">
              Ubicación registrada: {event.latitude}, {event.longitude}
              {event.require_location && ` (Radio: ${event.location_radius}m)`}
            </p>
          )}

          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Enlace para registro de asistencia */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enlace para registro de asistencia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Comparte este enlace con los estudiantes para que registren su asistencia
                  </p>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowQR(!showQR)}
                      className="w-full"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      {showQR ? 'Ocultar QR' : 'Mostrar QR'}
                    </Button>
                  </div>

                  {showQR && (
                    <div className="flex justify-center p-4">
                      <QRCodeSVG
                        value={attendanceUrl}
                        size={200}
                        level="H"
                        includeMargin={true}
                        className="bg-white p-2 rounded-lg"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PIN de verificación */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-primary" />
                    PIN de verificación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant={showPinCard ? "default" : "outline"}
                    className="w-full mb-4"
                    onClick={() => setShowPinCard(!showPinCard)}
                  >
                    {showPinCard ? 'Ocultar PIN' : 'Mostrar PIN'}
                  </Button>
                  
                  {showPinCard && (
                    <div className="bg-muted p-6 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Muestra este PIN a los estudiantes. Expira en:
                      </p>
                      <div className="text-sm font-mono mb-2">
                        {getRemainingTime()}
                      </div>
                      <div className="text-4xl font-bold font-mono tracking-wider mb-4">
                        {currentPin}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRegeneratePin}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generar nuevo PIN
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Los estudiantes deberán ingresar este PIN para verificar su presencia
                      </p>
                      
                      {pinUpdateError && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs rounded">
                          Error: {pinUpdateError}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                    <TableHead>Documento</TableHead>
                    <TableHead>Distancia</TableHead>
                    <TableHead>Verificación</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.code}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.document_id}</TableCell>
                      <TableCell>
                        {student.distance_from_location 
                          ? `${Math.round(student.distance_from_location)}m` 
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {student.verified_by_pin 
                          ? 'PIN' 
                          : (student.distance_from_location !== null && student.distance_from_location <= (event.location_radius || 10)) 
                            ? 'Ubicación' 
                            : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(student.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
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