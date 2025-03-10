"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, UserPlus, Shield, Map, AlertCircle, Check, X, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

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

export default function PublicAttendancePage() {
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [pin, setPin] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied' | 'unsupported' | 'unavailable'>('pending');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  useEffect(() => {
    loadEvent();
  }, []);

  const loadEvent = async () => {
    try {
      setPageLoading(true);
      setError(null);

      console.log("Loading event with ID:", params.id);
      
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', params.id)
        .single();

      if (eventError) {
        console.error("Event loading error:", eventError);
        if (eventError.code === 'PGRST116') {
          throw new Error('Evento no encontrado');
        }
        throw eventError;
      }

      if (!eventData) {
        console.error("No event data found");
        throw new Error('Evento no encontrado');
      }

      console.log("Event data loaded:", eventData);
      setEvent(eventData);
      
      // Si el evento requiere ubicación, solicitarla automáticamente
      if (eventData.require_location && eventData.latitude && eventData.longitude) {
        console.log("Event requires location verification, requesting...");
        requestLocation();
      } else {
        console.log("Event does not require location verification");
        setLocationStatus('granted'); // No se requiere ubicación, considerar como concedida
      }
      
    } catch (error: any) {
      console.error('Error loading event:', error);
      setError(error.message);
    } finally {
      setPageLoading(false);
    }
  };

  const requestLocation = () => {
    console.log("Requesting location access...");
    
    if (!navigator.geolocation) {
      console.error("Geolocation not supported by browser");
      setLocationStatus('unsupported');
      setLocationError('Tu dispositivo no soporta geolocalización');
      return;
    }

    setLocationStatus('pending');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location access granted:", position.coords);
        setLocationStatus('granted');
        
        // Captura las coordenadas del usuario
        const userLatitude = position.coords.latitude;
        const userLongitude = position.coords.longitude;
        
        setUserCoords({
          latitude: userLatitude,
          longitude: userLongitude
        });
        
        // Calcular distancia si tenemos datos del evento
        if (event && 'latitude' in event && 'longitude' in event && 
          event.latitude !== null && event.longitude !== null) {
          
          try {
              // Usar parseFloat solo si son strings
              const eventLatitude = typeof event.latitude === 'string' 
                  ? parseFloat(event.latitude) 
                  : event.latitude;
                  
              const eventLongitude = typeof event.longitude === 'string' 
                  ? parseFloat(event.longitude) 
                  : event.longitude;
              
              console.log("User coordinates:", userLatitude, userLongitude);
              console.log("Event coordinates:", eventLatitude, eventLongitude);
              
              // Verificar que son números válidos explícitamente
              if (!isNaN(eventLatitude) && !isNaN(eventLongitude)) {
                  // Código para cálculo de distancia...
              }
          } catch (error) {
              console.error("Error processing coordinates:", error);
          }
      }
      },
      (positionError) => {
        console.error("Geolocation error:", positionError);
        setLocationStatus('denied');
        
        switch (positionError.code) {
          case 1: // PERMISSION_DENIED
            setLocationError('Has denegado el acceso a tu ubicación. Por favor, permite el acceso o usa el PIN alternativo.');
            break;
          case 2: // POSITION_UNAVAILABLE
            setLocationStatus('unavailable');
            setLocationError('Tu ubicación no está disponible en este momento.');
            break;
          case 3: // TIMEOUT
            setLocationStatus('unavailable');
            setLocationError('Se agotó el tiempo para obtener tu ubicación.');
            break;
          default:
            setLocationError('Error al obtener tu ubicación.');
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    try {
      console.log("Calculating distance between:", 
        "point1 (", lat1, lon1, ") and",
        "point2 (", lat2, lon2, ")");
      
      // Si las coordenadas son exactamente iguales
      if (lat1 === lat2 && lon1 === lon2) {
        console.log("Exact same coordinates - distance is 0");
        return 0;
      }
      
      // Fórmula de Haversine
      const R = 6371e3; // Radio de la tierra en metros
      const φ1 = lat1 * Math.PI / 180; // Convertir a radianes
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;
      
      console.log("Values in radians:", { φ1, φ2, Δφ, Δλ });
      
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      console.log("Haversine formula intermediate values:", { a, c });
      
      const distance = R * c; // Distancia en metros
      
      console.log("Final calculated distance:", distance, "meters");
      
      return Math.max(0, distance); // Asegurar que nunca es negativo
    } catch (error) {
      console.error("Exception in distance calculation:", error);
      return 0; // Valor por defecto seguro
    }
  };

  const verifyPin = async (inputPin: string): Promise<boolean> => {
    console.log("Verifying PIN:", inputPin);
    
    try {
      // Obtener evento actualizado para verificar el PIN
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('current_pin, pin_expiry')
        .eq('id', params.id)
        .single();
        
      if (eventError || !eventData) {
        console.error("Error fetching event for PIN verification:", eventError);
        return false;
      }
      
      console.log("Event data for PIN verification:", eventData);
      
      if (!eventData.current_pin) {
        console.error("No PIN set for this event");
        return false;
      }
      
      // Verificar si el PIN es correcto
      if (inputPin !== eventData.current_pin) {
        console.error("PIN mismatch:", inputPin, "vs", eventData.current_pin);
        return false;
      }
      
      // Verificar si el PIN ha expirado
      if (eventData.pin_expiry) {
        const expiry = new Date(eventData.pin_expiry);
        const now = new Date();
        if (now > expiry) {
          console.error("PIN expired at:", expiry, "current time:", now);
          return false;
        }
      }
      
      console.log("PIN verification successful");
      return true;
    } catch (error) {
      console.error("Exception in verifyPin:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("Starting attendance submission process...");
      console.log("Document ID:", documentId);
      console.log("PIN:", pin);
      console.log("Location status:", locationStatus);
      console.log("User coordinates:", userCoords);
      console.log("Distance:", distance);
      
      let usePin = false;
      let withinRadius = false;
      
      // Verificar si se requiere ubicación pero no se ha concedido permiso
      if (event?.require_location && event.latitude && event.longitude) {
        if (locationStatus === 'pending') {
          // Intentar obtener la ubicación de nuevo
          requestLocation();
          throw new Error('Es necesario verificar tu ubicación para registrar asistencia');
        }
        
        if (locationStatus === 'denied' || locationStatus === 'unavailable' || locationStatus === 'unsupported') {
          // Verificar el PIN como alternativa
          if (!pin) {
            throw new Error('Se requiere el PIN de verificación ya que no se puede acceder a tu ubicación');
          }
          
          const isPinValid = await verifyPin(pin);
          if (!isPinValid) {
            throw new Error('El PIN de verificación es incorrecto o ha expirado');
          }
          
          usePin = true; // PIN verificado, continuar con el registro
          console.log("Attendance will be verified by PIN");
        } else if (locationStatus === 'granted' && distance !== null) {
          // Verificar si el estudiante está dentro del radio permitido
          withinRadius = distance <= (event.location_radius || 10);
          
          if (!withinRadius) {
            // Si está fuera del radio pero proporciona un PIN, permitir registro
            if (pin) {
              const isPinValid = await verifyPin(pin);
              if (isPinValid) {
                usePin = true; // PIN válido, continuar con el registro
                console.log("Outside radius but PIN is valid");
              } else {
                const distanceInMeters = Math.round(distance);
                throw new Error(`Estás demasiado lejos del aula (${distanceInMeters}m). Distancia máxima permitida: ${event.location_radius}m. El PIN proporcionado es incorrecto o ha expirado.`);
              }
            } else {
              const distanceInMeters = Math.round(distance);
              throw new Error(`Estás demasiado lejos del aula (${distanceInMeters}m). Distancia máxima permitida: ${event.location_radius}m. Ingresa el PIN de verificación para registrar asistencia.`);
            }
          } else {
            console.log("User is within allowed radius");
          }
        }
      }

      // Buscar estudiante por documento
      console.log("Looking up student with document ID:", documentId);
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('document_id', documentId)
        .single();

      if (studentError || !student) {
        console.error("Student lookup error:", studentError);
        throw new Error('Estudiante no encontrado');
      }

      console.log("Student found:", student);

      // Verificar si ya existe la asistencia
      const { data: existingAttendance, error: existingAttendanceError } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', event?.id)
        .eq('student_id', student.id)
        .single();

      if (existingAttendanceError && existingAttendanceError.code !== 'PGRST116') {
        console.error("Error checking existing attendance:", existingAttendanceError);
      }

      if (existingAttendance) {
        console.log("Attendance already exists:", existingAttendance);
        throw new Error('Ya registraste tu asistencia para este evento');
      }

      // Registrar asistencia con información de ubicación si está disponible
      const attendanceRecord: any = {
        event_id: event?.id,
        student_id: student.id,
      };
      
      // Añadir información de ubicación si está disponible
      if (userCoords) {
        attendanceRecord.user_latitude = userCoords.latitude;
        attendanceRecord.user_longitude = userCoords.longitude;
        
        if (distance !== null) {
          attendanceRecord.distance_from_location = distance;
        }
      }
      
      // Registrar si se usó PIN para verificación
      if (usePin) {
        attendanceRecord.verified_by_pin = true;
      }

      console.log("Inserting attendance record:", attendanceRecord);
      
      // Insertar el registro de asistencia
      const { data: insertedData, error: attendanceError } = await supabase
        .from('attendances')
        .insert([attendanceRecord])
        .select();

      if (attendanceError) {
        console.error("Error inserting attendance:", attendanceError);
        throw attendanceError;
      }

      console.log("Attendance inserted successfully:", insertedData);

      toast({
        title: "¡Asistencia registrada!",
        description: `La asistencia de ${student.full_name} ha sido registrada correctamente.`,
      });

      setDocumentId("");
      setPin("");

    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryLocation = () => {
    setLocationStatus('pending');
    setLocationError(null);
    requestLocation();
  };

  // Función para obtener un color basado en la distancia
  const getColorForDistance = (distance: number, radius: number) => {
    if (distance <= radius * 0.3) return "bg-green-500";
    if (distance <= radius * 0.6) return "bg-green-400";
    if (distance <= radius * 0.8) return "bg-yellow-400";
    if (distance <= radius) return "bg-orange-400";
    return "bg-red-500";
  };

  // Calcular el porcentaje para la barra de progreso
  const getDistancePercentage = (distance: number, radius: number) => {
    return Math.min(100, (distance / radius) * 100);
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p>Cargando evento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Evento no encontrado</h2>
            <p className="text-muted-foreground">El evento que buscas no existe o ha sido eliminado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Registro de Asistencia</CardTitle>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">{event.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(event.date).toLocaleDateString()}
            </p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {event.description}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mostrar estado de la ubicación si se requiere */}
          {event.require_location && event.latitude && event.longitude && (
            <div className="mb-4">
              {locationStatus === 'granted' ? (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center mb-3">
                    <Map className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-semibold text-lg">Ubicación verificada</h3>
                  </div>
                  
                  {distance !== null ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Distancia al aula:</span>
                        <span className={`px-2 py-1 rounded-full text-white font-semibold ${getColorForDistance(distance, event.location_radius)}`}>
                          {Math.round(distance)} metros
                        </span>
                      </div>
                      
                      <div className="relative pt-1">
                        <div className="mb-2 flex justify-between items-center text-xs">
                          <span>0m</span>
                          <span className="font-semibold">Radio máximo: {event.location_radius}m</span>
                          <span>{Math.round(event.location_radius * 1.5)}m+</span>
                        </div>
                        <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                          <div
                            style={{ width: `${getDistancePercentage(distance, event.location_radius * 1.5)}%` }}
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${getColorForDistance(distance, event.location_radius)}`}
                          ></div>
                        </div>
                      </div>
                      
                      {distance <= event.location_radius ? (
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4 mr-1" />
                          <span className="text-sm font-medium">Estás dentro del radio permitido</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-500 dark:text-red-400">
                          <X className="h-4 w-4 mr-1" />
                          <span className="text-sm font-medium">Estás fuera del radio permitido</span>
                          <span className="text-xs ml-1">(Necesitas PIN)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-amber-600 dark:text-amber-400 text-sm">
                      No se pudo calcular la distancia. Por favor, usa el PIN proporcionado por el profesor.
                    </p>
                  )}
                </div>
              ) : locationStatus === 'denied' || locationStatus === 'unavailable' ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Acceso a ubicación denegado</AlertTitle>
                  <AlertDescription>
                    <p>{locationError}</p>
                    <div className="flex justify-between items-center mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRetryLocation}
                      >
                        Reintentar
                      </Button>
                      <p className="text-xs">
                        Como alternativa, ingresa el PIN proporcionado por el profesor.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : locationStatus === 'unsupported' ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Ubicación no soportada</AlertTitle>
                  <AlertDescription>
                    <p>Tu dispositivo no soporta geolocalización. Utiliza el PIN de verificación proporcionado por el profesor.</p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Map className="h-4 w-4" />
                  <AlertTitle>Verificación de ubicación</AlertTitle>
                  <AlertDescription>
                    <p>Este evento requiere verificar tu ubicación para registrar asistencia.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={requestLocation}
                      className="mt-2"
                    >
                      Permitir acceso a ubicación
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documentId">Documento de Identidad</Label>
              <Input
                id="documentId"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Ingrese su documento de identidad"
                required
              />
            </div>
            
            {/* Mostrar campo de PIN si se requiere ubicación y está fuera de rango o sin acceso */}
            {event.require_location && (
              (locationStatus === 'denied' || 
               locationStatus === 'unsupported' || 
               locationStatus === 'unavailable' ||
               (locationStatus === 'granted' && distance !== null && distance > (event.location_radius || 10)))
            ) && (
              <div className="space-y-2">
                <Label htmlFor="pin" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  PIN de verificación
                </Label>
                <Input
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ingrese el PIN proporcionado por el profesor"
                />
                <p className="text-xs text-muted-foreground">
                  El PIN es proporcionado por el profesor para verificar tu presencia en clase
                </p>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Registrando..." : "Registrar Asistencia"}
            </Button>
          </form>
          
          {/* Botón para mostrar/ocultar información de depuración */}
          <div className="pt-4 border-t mt-4">
            <Button 
              variant="ghost"
              size="sm"
              className="text-xs w-full"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              <Info className="h-3 w-3 mr-1" />
              {showDebugInfo ? "Ocultar información de diagnóstico" : "Mostrar información de diagnóstico"}
            </Button>
            
            {showDebugInfo && (
              <div className="mt-2 p-2 bg-muted text-xs rounded font-mono">
                <div className="overflow-auto max-h-36">
                  <p>Status: {locationStatus}</p>
                  <p>Coords: {userCoords ? `${userCoords.latitude}, ${userCoords.longitude}` : 'null'}</p>
                  <p>Distance: {distance !== null ? `${Math.round(distance)}m` : 'null'}</p>
                  <p>Event location: {event.latitude}, {event.longitude}</p>
                  <p>Event coordinates parsed: {event.latitude && event.longitude ? 
                    `${parseFloat(event.latitude)}, ${parseFloat(event.longitude)}` : 'invalid'}</p>
                  <p>Radius: {event.location_radius}m</p>
                  <p>PIN required: {event.require_location ? 'Yes' : 'No'}</p>
                  <p>Current PIN: {event.current_pin || 'None'}</p>
                  <p>PIN Expiry: {event.pin_expiry ? new Date(event.pin_expiry).toLocaleTimeString() : 'None'}</p>
                  <p>Identical coords: {userCoords && event.latitude && event.longitude && 
                    userCoords.latitude === parseFloat(event.latitude) && 
                    userCoords.longitude === parseFloat(event.longitude) ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}