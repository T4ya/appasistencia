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
import { ArrowLeft, Download, UserPlus, QrCode, Share2, Key } from "lucide-react";
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
  latitude: number | null;
  longitude: number | null;
  require_location: boolean;
  location_radius: number;
  current_pin: string | null;
  pin_expiry: string | null;
}

interface Student {
  id: string;
  full_name: string;
  document_id: string;
  timestamp: string;
}

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attendances, setAttendances] = useState<Student[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const attendanceUrl = `${window.location.origin}/public-attendance/${params.id}`;

  useEffect(() => {
    checkUser();
    loadEventAndAttendances();
    const pinInterval = setInterval(generatePin, 30000); // Renovar PIN cada 30 segundos
    return () => clearInterval(pinInterval);
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

      if (eventData.latitude && eventData.longitude && eventData.require_location) {
        requestUserLocation();
      }

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

      await checkCurrentPin();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar el evento: " + error.message,
      });
      router.push('/');
    }
  };

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización. Usa el código PIN.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationError(null);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError("Error al obtener tu ubicación. Usa el código PIN: " + 
          (error.code === 1 
            ? "Por favor habilita la ubicación en tu navegador o usa el código PIN." 
            : "Intenta nuevamente o usa el código PIN."));
      },
      { enableHighAccuracy: true }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return Infinity; // Retornar infinito si alguna coordenada no es válida
    }

    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  };

  const isWithinRadius = (): boolean => {
    if (!event || !event.latitude || !event.longitude || !userLocation) {
      return false;
    }

    const distance = calculateDistance(
      event.latitude,
      event.longitude,
      userLocation.latitude,
      userLocation.longitude
    );

    return distance <= event.location_radius;
  };

  const generatePin = async () => {
    if (!event) return;
  
    try {
      // Generate a 4-digit PIN instead of 6
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + 30);
  
      const { error } = await supabase
        .from('events')
        .update({
          current_pin: newPin,
          pin_expiry: expiryDate.toISOString()
        })
        .eq('id', event.id);
  
      if (error) throw error;
  
      setCurrentPin(newPin);
      setPinExpiry(expiryDate);
  
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
  
    } catch (error: any) {
      console.error('Error generating PIN:', error);
    }
  };

  const checkCurrentPin = async () => {
    if (!event) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .select('current_pin, pin_expiry')
        .eq('id', event.id)
        .single();

      if (error) throw error;

      if (data.current_pin && data.pin_expiry) {
        const expiryDate = new Date(data.pin_expiry);
        if (expiryDate > new Date()) {
          setCurrentPin(data.current_pin);
          setPinExpiry(expiryDate);
        } else {
          await generatePin();
        }
      } else {
        await generatePin();
      }
    } catch (error: any) {
      console.error('Error checking PIN:', error);
    }
  };

  const handleScanByDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('document_id', scanInput)
        .single();
  
      if (studentError || !student) {
        throw new Error('Estudiante no encontrado');
      }
  
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
  
      const { error: attendanceError } = await supabase
        .from('attendances')
        .insert([
          {
            event_id: event?.id,
            student_id: student.id,
            verified_by: 'document'
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

  const handleScanByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      if (pinInput !== currentPin) {
        throw new Error('Código PIN incorrecto');
      }
  
      if (!pinExpiry || new Date() > pinExpiry) {
        throw new Error('El código PIN ha expirado');
      }
  
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('document_id', scanInput)
        .single();
  
      if (studentError || !student) {
        throw new Error('Estudiante no encontrado');
      }
  
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
  
      await supabase
        .from('event_pins')
        .update({ used: true, verified_by: 'Profesor' })
        .eq('event_id', event?.id)
        .eq('pin', currentPin);
  
      const { error: attendanceError } = await supabase
        .from('attendances')
        .insert([
          {
            event_id: event?.id,
            student_id: student.id,
            user_latitude: userLocation?.latitude || null,
            user_longitude: userLocation?.longitude || null,
            distance_from: userLocation && event?.latitude && event?.longitude
              ? calculateDistance(event.latitude, event.longitude, userLocation.latitude, userLocation.longitude)
              : null,
            verified_by: 'pin',
            verified_by_pin: true,
            verification_method: 'PIN'
          }
        ]);
  
      if (attendanceError) throw attendanceError;
  
      // NUEVO: Registrar en Google Sheets usando el endpoint directo
      try {
        const sheetsResponse = await fetch('/api/attendance-fix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: event?.id,
            documentId: scanInput,
            studentName: student.full_name
          }),
        });
        
        const sheetsResult = await sheetsResponse.json();
        console.log("Resultado Google Sheets (PIN):", sheetsResult);
        
        if (!sheetsResponse.ok) {
          console.warn("Advertencia de Google Sheets (PIN):", sheetsResult.error);
        }
      } catch (sheetError) {
        console.error("Error con Google Sheets (PIN):", sheetError);
      }
  
      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${student.full_name} (verificada por PIN)`,
      });
  
      setScanInput("");
      setPinInput("");
      generatePin();
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

  const updateEventLocation = async () => {
    if (!userLocation || !event) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('events')
        .update({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          require_location: true
        })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Ubicación actualizada",
        description: "La ubicación del evento ha sido actualizada correctamente",
      });

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

  const getTimeRemaining = (): string => {
    if (!pinExpiry) return "00:00";

    const now = new Date();
    const diff = pinExpiry.getTime() - now.getTime();

    if (diff <= 0) return "00:00";

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
                  Expira en: <span className="font-semibold">{getTimeRemaining()}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={generatePin}
                disabled={loading}
              >
                Renovar código
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>IMPORTANTE:</strong> Este código de 4 dígitos se renueva cada 30 segundos. Los estudiantes necesitarán escanear el código QR y luego ingresar este código para verificar su asistencia.
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
              <Button onClick={downloadAttendances} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Descargar CSV
              </Button>
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