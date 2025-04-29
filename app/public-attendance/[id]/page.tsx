"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface Event {
  id: string;
  title: string;
  date: string;
  current_pin: string | null;
  pin_expiry: string | null;
}

export default function PublicAttendance() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [documentInput, setDocumentInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Referencias para valores actualizados - usar useState para UI y useRef para datos más recientes
  const [latestPin, setLatestPin] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  
  // Referencias que mantienen datos actualizados para validaciones
  const currentPinRef = useRef<string | null>(null);
  const pinExpiryRef = useRef<Date | null>(null);
  const checkPinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadEventAndPin();
    
    // Configurar intervalo de verificación cada 2 segundos para estar más actualizado
    checkPinIntervalRef.current = setInterval(checkCurrentPin, 2000);
    
    return () => {
      if (checkPinIntervalRef.current) {
        clearInterval(checkPinIntervalRef.current);
        checkPinIntervalRef.current = null;
      }
    };
  }, []);

  const loadEventAndPin = async () => {
    try {
      const { data: eventData, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error || !eventData) {
        throw new Error("Evento no encontrado");
      }

      setEvent(eventData);
      await checkCurrentPin(true); // Fuerza actualización inicial
    } catch (error: any) {
      handleError(error.message);
      router.push("/");
    }
  };

  const checkCurrentPin = async (forceUpdate = false) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("current_pin, pin_expiry")
        .eq("id", params.id)
        .single();

      if (error || !data) return;

      if (data.current_pin && data.pin_expiry) {
        const newExpiry = new Date(data.pin_expiry);
        const now = new Date();
        
        // Actualizar siempre si: es forzado, o el PIN cambió, o la fecha de expiración cambió
        if (forceUpdate || 
            data.current_pin !== currentPinRef.current || 
            (pinExpiryRef.current && newExpiry.getTime() !== pinExpiryRef.current.getTime())) {
          
          // Actualizar las referencias para validación
          currentPinRef.current = data.current_pin;
          pinExpiryRef.current = newExpiry;
          
          // Actualizar el estado para la UI
          setLatestPin(data.current_pin);
          setExpiryTime(newExpiry);
          
          console.log("PIN actualizado:", data.current_pin, "expira:", newExpiry);
        }
      }
    } catch (error) {
      console.error("Error actualizando PIN:", error);
    }
  };

  const handleRegisterAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Forzar una actualización inmediata del PIN antes de validar 
      await checkCurrentPin(true);
      
      // Validación de campos
      if (!documentInput.trim() || !pinInput.trim()) {
        throw new Error("Todos los campos son requeridos");
      }

      // Obtener valores actuales desde las referencias
      const currentPin = currentPinRef.current;
      const expiryDate = pinExpiryRef.current;

      if (!currentPin || !expiryDate) {
        throw new Error("Sistema de verificación no disponible");
      }

      // Validar coincidencia de PIN
      if (pinInput !== currentPin) {
        throw new Error("Código de verificación incorrecto");
      }

      // Validar que el PIN no haya expirado
      const now = new Date();
      if (now > expiryDate) {
        throw new Error("El código ha expirado. Solicita uno nuevo");
      }

      // Usar la API para registrar asistencia en Supabase y Google Sheets
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event?.id,
          documentId: documentInput,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }

      // Éxito
      toast({
        title: "Asistencia registrada",
        description: `Bienvenido ${data.student.full_name}`,
      });

      // Reiniciar formulario
      setDocumentInput("");
      setPinInput("");

      // Redirigir después de 2 segundos
      setTimeout(() => router.push("/"), 2000);

    } catch (error: any) {
      handleError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (message: string) => {
    toast({
      variant: "destructive",
      title: "Error",
      description: message,
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

        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-4 text-center">{event.title}</h1>
          <p className="text-muted-foreground text-center mb-6">
            {new Date(event.date).toLocaleDateString("es-ES", {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <form onSubmit={handleRegisterAttendance} className="space-y-6">
            <div className="space-y-3">
              <div>
                <Label htmlFor="document">Documento de Identidad</Label>
                <Input
                  id="document"
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  placeholder="Ej: 12345678A"
                  autoComplete="off"
                />
              </div>
              
              <div>
                <Label htmlFor="pin">Código de Acceso</Label>
                <Input
                  id="pin"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verificando..." : "Confirmar Asistencia"}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              Ingresa tu documento de identidad y el código de 4 dígitos
              proporcionado por el organizador del evento.
              El código se actualiza automáticamente cada 30 segundos.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}