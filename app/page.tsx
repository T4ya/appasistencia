  'use client';

  import { useEffect, useState } from 'react';
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import { Calendar, Plus, UserPlus } from "lucide-react";
  import Link from "next/link";
  import { ModeToggle } from "@/components/mode-toggle";
  import { Logo } from "@/components/logo";
  import { supabase } from '@/lib/supabase';

  export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        if (!user) {
          window.location.href = '/login';
        }
      };
      
      getUser();
      loadEvents();
    }, []);

    const loadEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
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
              {events.map((event: any) => (
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
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
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