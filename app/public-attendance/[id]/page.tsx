"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
}

export default function PublicAttendancePage() {
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvent();
  }, []);

  const loadEvent = async () => {
    try {
      setPageLoading(true);
      setError(null);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', params.id)
        .single();

      if (eventError) {
        if (eventError.code === 'PGRST116') {
          throw new Error('Evento no encontrado');
        }
        throw eventError;
      }

      if (!eventData) {
        throw new Error('Evento no encontrado');
      }

      setEvent(eventData);
    } catch (error: any) {
      console.error('Error loading event:', error);
      setError(error.message);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event?.id,
          documentId: documentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: "¡Asistencia registrada!",
        description: `La asistencia de ${data.student.full_name} ha sido registrada correctamente.`,
      });

      setDocumentId("");

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
        <CardContent>
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
            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Registrando..." : "Registrar Asistencia"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}