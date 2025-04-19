"use client";

import { useState} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarPlus, ShieldAlert, Key, QrCode, Info } from "lucide-react";
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

export default function NewEvent() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    description: "",
    require_location: false, // No longer required
    latitude: null as number | null,
    longitude: null as number | null,
    location_radius: 10, // Default still 10 meters
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      await ensureUserExists(user.id, user.email || '');

      const { error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title: formData.title,
            date: formData.date,
            description: formData.description,
            created_by: user.id,
            require_location: false, // Always false now
            latitude: null,
            longitude: null,
            location_radius: 10, // Default value
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
                  Configuración del sistema de verificación de asistencia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="verification">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Verificación de Asistencia
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <div className="flex items-center gap-2 mb-2">
                          <QrCode className="h-4 w-4 text-primary" />
                          <h3 className="font-medium">Sistema de Verificación por Código QR y PIN</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          La asistencia se verificará mediante un código QR que los estudiantes deberán escanear y un código numérico de 4 dígitos que se regenera cada 30 segundos.
                        </p>
                        <div className="flex items-center p-3 bg-muted rounded-lg">
                          <Info className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                          <p className="text-xs">
                            Este método reemplaza la verificación por ubicación GPS, que ha sido desactivada debido a problemas de precisión.
                          </p>
                        </div>
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