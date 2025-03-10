"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarPlus, MapPin } from "lucide-react";
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
  CardTitle 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function NewEvent() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    description: "",
    latitude: "",
    longitude: "",
    require_location: true,
    location_radius: 10, // radio en metros
  });
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);

  const ensureUserExists = async (userId: string, userEmail: string) => {
    // Primero verificamos si el usuario ya existe
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Si el usuario no existe, lo creamos
    if (!existingUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ id: userId, email: userEmail }])
        .select();

      if (insertError) throw insertError;
    }
  };

  const handleGetCurrentLocation = () => {
    setLocationLoading(true);
    
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tu navegador no soporta geolocalización",
      });
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData({
          ...formData,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        });
        setCurrentLocation(`${latitude}, ${longitude}`);
        setLocationLoading(false);
        
        toast({
          title: "Ubicación obtenida",
          description: "La ubicación del aula ha sido guardada correctamente",
        });
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo obtener la ubicación. " + error.message,
        });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Obtener el usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Asegurar que el usuario existe en la tabla users
      await ensureUserExists(user.id, user.email || '');

      // Crear el evento
      const { error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title: formData.title,
            date: formData.date,
            description: formData.description,
            created_by: user.id,
            latitude: formData.latitude || null,
            longitude: formData.longitude || null,
            require_location: formData.require_location,
            location_radius: formData.location_radius
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
                <CardTitle className="text-lg">Opciones de seguridad para asistencia</CardTitle>
                <CardDescription>
                  Configura cómo se verificará la asistencia física al evento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="require_location" className="text-base">Requerir verificación de ubicación</Label>
                    <p className="text-sm text-muted-foreground">
                      Los estudiantes deberán estar físicamente cerca para registrar asistencia
                    </p>
                  </div>
                  <Switch
                    id="require_location"
                    checked={formData.require_location}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, require_location: checked })
                    }
                  />
                </div>

                {formData.require_location && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="location">Ubicación del Aula</Label>
                      <div className="flex gap-2">
                        <Input
                          id="location"
                          value={currentLocation || "No establecida"}
                          readOnly
                          className="bg-muted"
                        />
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={handleGetCurrentLocation}
                          disabled={locationLoading}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          {locationLoading ? "Obteniendo..." : "Obtener Ubicación"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Usa este botón mientras estés en el aula para guardar su ubicación exacta
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location_radius">Radio de proximidad (metros)</Label>
                      <Input
                        id="location_radius"
                        type="number"
                        min="5"
                        max="100"
                        value={formData.location_radius}
                        onChange={(e) =>
                          setFormData({ ...formData, location_radius: parseInt(e.target.value) || 10 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Distancia máxima permitida desde la ubicación del aula
                      </p>
                    </div>
                  </>
                )}
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