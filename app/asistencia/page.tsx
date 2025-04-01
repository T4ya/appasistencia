"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AsistenciaDirecta() {
  const [documentId, setDocumentId] = useState("");
  const [eventId, setEventId] = useState("3ae5a6cc-382c-44ef-8288-ba1d3f124ea1"); // ID de tu evento actual
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/attendance-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          documentId,
          studentName: "Estudiante" // Será reemplazado por el backend
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido');
      }
      
      setResult(data);
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Error al registrar asistencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Registro Directo de Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eventId">ID del Evento</Label>
              <Input
                id="eventId"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="ID del evento"
                required
              />
              <p className="text-xs text-muted-foreground">
                Este es el ID del evento actual. Puedes dejarlo como está.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="documentId">Documento de Identidad</Label>
              <Input
                id="documentId"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Ingresa tu documento de identidad"
                required
              />
            </div>
            
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar Asistencia'}
            </Button>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
          
          {result && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md">
              <p className="font-medium">{result.message}</p>
              {result.location && (
                <p className="text-sm mt-1">Celda actualizada: {result.location}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}