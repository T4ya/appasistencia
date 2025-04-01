"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface Event {
  id: string;
  title: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  require_location: boolean;
  location_radius: number;
  current_pin: string | null;
  pin_expiry: string | null;
}

interface Student {
  id: string;
  code: string;
  full_name: string;
  document_id: string;
}

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export default function PublicAttendance() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [documentInput, setDocumentInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  useEffect(() => {
    loadEventAndPin();
  }, [params.id]);

  // Separate useEffect for requesting location to avoid infinite loop
  useEffect(() => {
    if (event?.require_location && 
        event.latitude && 
        event.longitude && 
        !userLocation && 
        !locationRequested) {
      setLocationRequested(true); // Mark that we've requested location
      requestUserLocation();
    }
  }, [event, userLocation, locationRequested]);

  // Update calculated distance when both event and user location are available
  useEffect(() => {
    if (event?.latitude && event?.longitude && userLocation) {
      const distance = calculateDistance(
        event.latitude,
        event.longitude,
        userLocation.latitude,
        userLocation.longitude
      );
      setCalculatedDistance(distance);
    }
  }, [event, userLocation]);

  const loadEventAndPin = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", params.id)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        router.push("/");
        return;
      }

      setEvent(eventData);
      await checkCurrentPin();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar el evento: " + error.message,
      });
      router.push("/");
    }
  };

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización. Usa el código PIN.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(newLocation);
        setLocationError(null);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError(
          "Error al obtener tu ubicación. Usa el código PIN: " +
            (error.code === 1
              ? "Por favor habilita la ubicación en tu navegador o usa el código PIN."
              : "Intenta nuevamente o usa el código PIN.")
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return Infinity;
    }

    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distancia en metros
    return distance;
  };

  const isWithinRadius = (): boolean => {
    if (!event || !event.latitude || !event.longitude || !userLocation || calculatedDistance === null) {
      return false;
    }

    // Añadir un margen de tolerancia de 1 metro para pequeñas variaciones del GPS
    const tolerance = 1; // 1 metro de tolerancia
    return calculatedDistance <= event.location_radius + tolerance;
  };

  const checkCurrentPin = async () => {
    if (!event) return;

    try {
      const { data, error } = await supabase
        .from("events")
        .select("current_pin, pin_expiry")
        .eq("id", event.id)
        .single();

      if (error) throw error;

      if (data.current_pin && data.pin_expiry) {
        const expiryDate = new Date(data.pin_expiry);
        if (expiryDate > new Date()) {
          setCurrentPin(data.current_pin);
          setPinExpiry(expiryDate);
        }
      }
    } catch (error: any) {
      console.error("Error checking PIN:", error);
    }
  };

  const handleRegisterByLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      if (!event?.require_location) {
        throw new Error("Este evento no requiere verificación por ubicación.");
      }
  
      if (!userLocation) {
        throw new Error("Debes permitir el acceso a tu ubicación o usar un código PIN.");
      }
  
      if (!event.latitude || !event.longitude) {
        throw new Error("El evento no tiene coordenadas definidas. Usa el código PIN.");
      }
  
      if (calculatedDistance === null || !isFinite(calculatedDistance)) {
        throw new Error(
          "No se pudo calcular la distancia. Verifica tu ubicación o usa el código PIN."
        );
      }
  
      if (!isWithinRadius()) {
        throw new Error(
          `Estás a ${calculatedDistance.toFixed(2)} metros del evento. Debes estar dentro de un radio de ${event.location_radius} metros. Usa el código PIN si estás autorizado.`
        );
      }
  
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("document_id", documentInput)
        .single();
  
      if (studentError || !student) {
        throw new Error("Estudiante no encontrado");
      }
  
      const { data: existingAttendance } = await supabase
        .from("attendances")
        .select("*")
        .eq("event_id", event.id)
        .eq("student_id", student.id)
        .single();
  
      if (existingAttendance) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Ya registraste tu asistencia",
        });
        return;
      }
  
      const { error: attendanceError } = await supabase
        .from("attendances")
        .insert([
          {
            event_id: event.id,
            student_id: student.id,
            user_latitude: userLocation.latitude,
            user_longitude: userLocation.longitude,
            distance_from: calculatedDistance, 
            verified_by: "location",
          },
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
            eventId: event.id,
            documentId: documentInput,
            studentName: student.full_name
          }),
        });
        
        const sheetsResult = await sheetsResponse.json();
        console.log("Resultado Google Sheets (Ubicación):", sheetsResult);
        
        if (!sheetsResponse.ok) {
          console.warn("Advertencia de Google Sheets:", sheetsResult.error);
        }
      } catch (sheetError) {
        console.error("Error con Google Sheets:", sheetError);
      }
  
      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${student.full_name}`,
      });
  
      setDocumentInput("");
      router.push("/");
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

  const handleRegisterByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      if (pinInput !== currentPin) {
        throw new Error("Código PIN incorrecto");
      }
  
      if (!pinExpiry || new Date() > pinExpiry) {
        throw new Error("El código PIN ha expirado");
      }
  
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("document_id", documentInput)
        .single();
  
      if (studentError || !student) {
        throw new Error("Estudiante no encontrado");
      }
  
      if (!event) {
        throw new Error("Evento no encontrado");
      }
  
      const { data: existingAttendance } = await supabase
        .from("attendances")
        .select("*")
        .eq("event_id", event.id)
        .eq("student_id", student.id)
        .single();
  
      if (existingAttendance) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Ya registraste tu asistencia",
        });
        return;
      }
  
      await supabase
        .from("event_pins")
        .update({ used: true })
        .eq("event_id", event.id)
        .eq("pin", currentPin);
  
      const { error: attendanceError } = await supabase
        .from("attendances")
        .insert([
          {
            event_id: event.id,
            student_id: student.id,
            user_latitude: userLocation?.latitude || null,
            user_longitude: userLocation?.longitude || null,
            distance_from: calculatedDistance, 
            verified_by: "pin",
            verified_by_pin: true,
            verification_method: "PIN",
          },
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
            eventId: event.id,
            documentId: documentInput,
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
  
      setDocumentInput("");
      setPinInput("");
      router.push("/");
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
            Fecha: {new Date(event.date).toLocaleDateString()}
          </p>

          {calculatedDistance !== null && (
            <p className="text-muted-foreground text-center mb-4">
              Distancia calculada: {calculatedDistance.toFixed(2)} metros
            </p>
          )}

          <div className="space-y-6">
            <form onSubmit={handleRegisterByLocation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document">Documento de Identidad</Label>
                <Input
                  id="document"
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  placeholder="Ingrese su documento de identidad"
                  required
                />
              </div>
              {event.require_location && (
                <>
                  {locationError && (
                    <Alert variant="destructive">
                      <AlertTitle>Atención</AlertTitle>
                      <AlertDescription>
                        {locationError}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setLocationRequested(true);
                            requestUserLocation();
                          }}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Activar ubicación
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || (event.require_location && !userLocation)}
                  >
                    Registrar con Ubicación
                  </Button>
                </>
              )}
            </form>

            {event.require_location &&
              !locationError &&
              userLocation &&
              calculatedDistance !== null &&
              !isWithinRadius() && (
                <Alert variant="destructive">
                  <AlertTitle>Atención</AlertTitle>
                  <AlertDescription>
                    Estás a {calculatedDistance.toFixed(2)} metros del evento. Debes
                    estar dentro de un radio de {event.location_radius} metros. Usa el
                    código PIN si estás autorizado.
                  </AlertDescription>
                </Alert>
              )}
          </div>
        </div>
      </main>
    </div>
  );
}