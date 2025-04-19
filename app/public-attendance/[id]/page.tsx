"use client";

import { useEffect, useState } from "react";
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
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);

  useEffect(() => {
    loadEventAndPin();
  }, [params.id]);

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

  const handleRegisterAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First, check if the PIN is valid
      if (!pinInput) {
        throw new Error("Debes ingresar el código de verificación");
      }

      if (pinInput !== currentPin) {
        throw new Error("Código de verificación incorrecto");
      }

      if (!pinExpiry || new Date() > pinExpiry) {
        throw new Error("El código de verificación ha expirado");
      }

      // Find the student by document ID
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

      // Check if the student already registered attendance
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

      // Mark the PIN as used
      await supabase
        .from("event_pins")
        .update({ used: true })
        .eq("event_id", event.id)
        .eq("pin", currentPin);

      // Register attendance
      const { error: attendanceError } = await supabase
        .from("attendances")
        .insert([
          {
            event_id: event.id,
            student_id: student.id,
            verified_by: "pin",
            verified_by_pin: true,
            verification_method: "PIN",
          },
        ]);

      if (attendanceError) throw attendanceError;

      toast({
        title: "Éxito",
        description: `Asistencia registrada para ${student.full_name}`,
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

          <div className="space-y-6">
            <form onSubmit={handleRegisterAttendance} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="pin">Código de Verificación</Label>
                <Input
                  id="pin"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ingrese el código de 4 dígitos mostrado por el profesor"
                  required
                  maxLength={4}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Verificando..." : "Registrar Asistencia"}
              </Button>
            </form>

            <div className="p-4 bg-muted rounded-lg text-center">
              <h3 className="font-medium mb-2">Instrucciones</h3>
              <p className="text-sm text-muted-foreground">
                Para registrar tu asistencia, ingresa tu documento de identidad y el código de verificación de 4 dígitos 
                que mostrará el profesor en el aula. Este código cambia cada 30 segundos.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}