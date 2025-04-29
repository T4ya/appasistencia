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
import { ArrowLeft, Download, UserPlus, QrCode, Share2, Key, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { QRCodeSVG } from 'qrcode.react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
  current_pin: string | null;
  pin_expiry: string | null;
}

interface Student {
  id: string;
  full_name: string;
  document_id: string;
  timestamp: string;
  group?: string; // Para identificar de qué grupo es el estudiante
}

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attendances, setAttendances] = useState<Student[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("00:30");
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  const attendanceUrl = `${window.location.origin}/public-attendance/${params.id}`;

  useEffect(() => {
    checkUser();
    loadEventAndAttendances();
  }, [params.id]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (!isRenewing && pinExpiry) {
        updateTimeRemaining();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [pinExpiry, isRenewing]);

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
      setRefreshing(true);
      
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

      // Verificar y actualizar PIN
      if (eventData.current_pin && eventData.pin_expiry) {
        const expiryDate = new Date(eventData.pin_expiry);
        const now = new Date();
        const diff = expiryDate.getTime() - now.getTime();
        if (diff > 0 && diff < 60000) { // less than 1 minute
          setCurrentPin(eventData.current_pin);
          setPinExpiry(expiryDate);
          updateTimeRemaining();
        } else {
          await generatePin();
        }
      } else {
        await generatePin();
      }

      // Cargar asistencias desde Supabase
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .select(`
          id,
          timestamp,
          students (
            id,
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
    } finally {
      setRefreshing(false);
    }
  };

  const generatePin = async () => {
    try {
      setIsRenewing(true);

      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + 30);

      if (event) {
        const { error } = await supabase
          .from('events')
          .update({
            current_pin: newPin,
            pin_expiry: expiryDate.toISOString()
          })
          .eq('id', event.id);

        if (error) {
          throw error;
        }

        await supabase
          .from('event_pins')
          .insert([
            {
              event_id: event.id,
              pin: newPin,
              expires_at: expiryDate.toISOString(),
              created_at: new Date().toISOString(),
              used: false
            }
          ]);

        setCurrentPin(newPin);
        setPinExpiry(expiryDate);
        setTimeRemaining("00:30");
      }
    } catch (error) {
      console.error('Error generando PIN:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el PIN. Por favor, intente nuevamente.",
      });
    } finally {
      setIsRenewing(false);
    }
  };

  const updateTimeRemaining = () => {
    if (!pinExpiry) return;

    const now = new Date().getTime();
    const diff = pinExpiry.getTime() - now;

    if (diff <= 0) {
      setTimeRemaining("00:00");
      if (!isRenewing) {
        generatePin();
      }
      return;
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const newTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    setTimeRemaining(newTimeStr);
  };

  const handleScanByDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Usar el endpoint de API para registrar en Supabase y Google Sheets
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event?.id,
          documentId: scanInput,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${data.student.full_name}`,
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

  const handleScanByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!currentPin) {
        throw new Error('No hay código PIN disponible');
      }

      if (pinInput !== currentPin) {
        throw new Error('Código PIN incorrecto');
      }

      if (!pinExpiry || new Date() > pinExpiry) {
        throw new Error('El código PIN ha expirado');
      }
      
      // Usar el endpoint de API para registrar en Supabase y Google Sheets
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event?.id,
          documentId: scanInput,
          verifiedBy: 'pin'
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }

      // Marcar PIN como usado
      await supabase
        .from('event_pins')
        .update({ used: true, verified_by: 'Profesor' })
        .eq('event_id', event?.id)
        .eq('pin', currentPin);

      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${data.student.full_name} (verificada por PIN)`,
      });

      setScanInput("");
      setPinInput("");
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

  const downloadGroupAttendances = async (group: string) => {
    try {
      setLoading(true);
      
      // Usar un endpoint específico para descargar asistencias de Google Sheets
      const response = await fetch(`/api/attendance/download?eventId=${event?.id}&group=${group}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al descargar las asistencias');
      }
      
      // Procesar la respuesta como un blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia_${event?.title}_${group}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Descarga completada",
        description: `Se ha descargado la lista de asistencia del grupo ${group}`,
      });
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
      ['Nombre', 'Documento', 'Hora'].join(','),
      ...attendances.map((student) => [
        student.full_name,
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

          <div className="mt-4 p-4 border rounded-lg bg-accent">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Código de verificación</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold tracking-widest">{currentPin || '----'}</div>
                <div className="text-sm">
                  Expira en: <span className="font-semibold">{timeRemaining}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={generatePin}
                disabled={isRenewing || loading}
              >
                Renovar código
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>IMPORTANTE:</strong> Este código de 4 dígitos se renueva automáticamente cada 30 segundos y debe ser compartido únicamente con los asistentes presentes.
            </p>
          </div>

          <div className="mt-4 p-4 border rounded-lg bg-primary/5">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Código QR para registro de asistencia
            </h3>

            <p className="text-sm text-muted-foreground mb-4">
              Muestra este código QR a los estudiantes. Deberán escanearlo y luego ingresar el código de 4 dígitos que se muestra arriba para verificar su asistencia.
            </p>

            <div className="flex justify-center mb-4">
              <Button
                variant={showQR ? "default" : "outline"}
                onClick={() => setShowQR(!showQR)}
                className="w-full md:w-auto"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {showQR ? 'Ocultar código QR' : 'Mostrar código QR'}
              </Button>
            </div>

            {showQR ? (
              <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={attendanceUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
                <p className="mt-2 text-sm text-center font-medium">
                  Escanea este código y luego ingresa el código de verificación: <strong>{currentPin || '----'}</strong>
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
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
            )}
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Registro de Asistencia</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={() => loadEventAndAttendances()} 
                  variant="outline" 
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Tabs defaultValue="local">
                  <TabsList>
                    <TabsTrigger value="local">CSV Local</TabsTrigger>
                    <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
                  </TabsList>
                  <TabsContent value="local" className="absolute">
                    <Button onClick={downloadAttendances} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </TabsContent>
                  <TabsContent value="sheets" className="absolute">
                    <div className="flex gap-2">
                      <Button onClick={() => downloadGroupAttendances('GRUPO1')} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Grupo 1
                      </Button>
                      <Button onClick={() => downloadGroupAttendances('GRUPO2')} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Grupo 2
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.full_name}</TableCell>
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
            <Tabs defaultValue="document">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="document">Por Documento</TabsTrigger>
                <TabsTrigger value="pin">Por PIN</TabsTrigger>
              </TabsList>

              <TabsContent value="document">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Registro por Documento</h2>
                </div>
                <form onSubmit={handleScanByDocument} className="space-y-4">
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
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {loading ? "Registrando..." : "Registrar Asistencia"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="pin">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Registro por PIN</h2>
                </div>
                <form onSubmit={handleScanByPin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scan-pin">Documento de Identidad</Label>
                    <Input
                      id="scan-pin"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Ingrese el documento de identidad"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin">Código PIN</Label>
                    <Input
                      id="pin"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Ingrese el código PIN"
                      required
                      maxLength={4}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <Key className="h-4 w-4 mr-2" />
                    {loading ? "Verificando..." : "Verificar Asistencia"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}