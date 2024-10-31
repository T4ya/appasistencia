'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Plus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { Logo } from "@/components/logo";
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Event {
  id: string;
  title: string;
  date: string;
  description: string | null;
  created_by: string;
  created_at: string;
  attendance_count?: number;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setUser(user);
        
        if (!user) {
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Error getting user:', error);
        setError('Error al obtener información del usuario');
      }
    };
    
    getUser();
    loadEvents();
  }, []);

  const getAttendanceCount = async (eventId: string) => {
    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances') // Cambiado de 'attendance' a 'attendances'
        .select('*')
        .eq('event_id', eventId);

      if (attendanceError) {
        console.error('Error checking attendance:', attendanceError);
        return 0;
      }

      return attendanceData?.length || 0;
    } catch (error) {
      console.error('Error getting attendance count:', error);
      return 0;
    }
  };

  const loadEvents = async () => {
    setError(null);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

      if (eventsError) throw eventsError;

      const eventsWithAttendance = await Promise.all(
        (eventsData || []).map(async (event) => {
          const attendanceCount = await getAttendanceCount(event.id);
          return {
            ...event,
            attendance_count: attendanceCount
          };
        })
      );

      setEvents(eventsWithAttendance);
    } catch (error: any) {
      console.error('Error loading events:', error);
      setError(error.message || 'Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Error al cerrar sesión');
    }
  };

  const handleRetry = () => {
    setLoading(true);
    loadEvents();
  };

  if (!user) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <ModeToggle />
              <Button variant="outline" onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Eventos Académicos</h1>
          <div className="flex gap-2">
            <Link href="/students">
              <Button variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Gestionar Estudiantes
              </Button>
            </Link>
            <Link href="/events/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex justify-between items-center">
              {error}
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-8">Cargando eventos...</div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No hay eventos creados</h2>
              <p className="text-muted-foreground mb-4">
                Comienza creando tu primer evento académico
              </p>
              <Link href="/events/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Evento
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event: Event) => (
              <Link key={event.id} href={`/events/${event.id}/scan`}>
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold mb-2">{event.title}</h2>
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {event.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{event.attendance_count || 0} asistente{event.attendance_count !== 1 ? 's' : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}