"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarPlus, MapPin, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export default function NewEvent() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    description: "",
    require_location: true, // Obligatorio por defecto
    latitude: null as number | null,
    longitude: null as number | null,
    location_radius: 10, // 10 metros por defecto
  });
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const ensureUserExists = async (userId: string, userEmail: string) => {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ id: userId, email: userEmail }])
        .select();

      if (insertError) throw insertError;
    }
  };

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        
        setFormData({
          ...formData,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        
        setLocationError(null);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError("Error al obtener tu ubicación. " + 
          (error.code === 1 
            ? "Por favor habilita la ubicación en tu navegador."
            : "Intenta nuevamente."));
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      await ensureUserExists(user.id, user.email || '');

      if (formData.require_location && (!formData.latitude || !formData.longitude)) {
        throw new Error('Debes establecer la ubicación del evento si requiere verificación por ubicación.');
      }

      const { error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title: formData.title,
            date: formData.date,
            description: formData.description,
            created_by: user.id,
            require_location: formData.require_location,
            latitude: formData.latitude,
            longitude: formData.longitude,
            location_radius: formData.location_radius,
          }
        ]);

      if (eventError) throw eventError;

      toast({
        title: "Éxito",
        description: "Evento creado correctamente",
      });
      
      router.push("/");
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

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

        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <CalendarPlus className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Crear Nuevo Evento</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del Evento</Label>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ej: Clase de Matemáticas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción breve del evento"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Configuración de Seguridad
                </CardTitle>
                <CardDescription>
                  Configura cómo quieres verificar la asistencia a este evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="location">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Verificación por Ubicación
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="require-location">Requerir verificación por ubicación</Label>
                            <p className="text-sm text-muted-foreground">
                              Los estudiantes deberán estar cerca del lugar para registrar asistencia (10m por defecto).
                            </p>
                          </div>
                          <Switch
                            id="require-location"
                            checked={formData.require_location}
                            onCheckedChange={(checked) => {
                              setFormData({ ...formData, require_location: checked });
                              if (checked && !userLocation) {
                                requestUserLocation();
                              }
                            }}
                            disabled
                          />
                        </div>

                        {formData.require_location && (
                          <>
                            {locationError && (
                              <p className="text-sm text-destructive">{locationError}</p>
                            )}
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="coordinates">Coordenadas del Evento</Label>
                                <Button 
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={requestUserLocation}
                                >
                                  <MapPin className="h-4 w-4 mr-2" />
                                  {userLocation ? "Actualizar ubicación" : "Obtener mi ubicación"}
                                </Button>
                              </div>
                              
                              {userLocation && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor="latitude" className="text-xs">Latitud</Label>
                                    <Input
                                      id="latitude"
                                      value={formData.latitude || ""}
                                      onChange={(e) =>
                                        setFormData({ ...formData, latitude: parseFloat(e.target.value) || null })
                                      }
                                      placeholder="Latitud"
                                      disabled
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="longitude" className="text-xs">Longitud</Label>
                                    <Input
                                      id="longitude"
                                      value={formData.longitude || ""}
                                      onChange={(e) =>
                                        setFormData({ ...formData, longitude: parseFloat(e.target.value) || null })
                                      }
                                      placeholder="Longitud"
                                      disabled
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="location-radius">
                                Radio de verificación <span className="text-xs">({formData.location_radius} metros)</span>
                              </Label>
                              <Input
                                id="location-radius"
                                type="range"
                                min="10"
                                max="500"
                                step="10"
                                value={formData.location_radius}
                                onChange={(e) =>
                                  setFormData({ ...formData, location_radius: parseInt(e.target.value) })
                                }
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>10m</span>
                                <span>500m</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={loading}>
              <CalendarPlus className="h-4 w-4 mr-2" />
              {loading ? "Creando..." : "Crear Evento"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}