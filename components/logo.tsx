import { GraduationCap } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <GraduationCap className="h-6 w-6 text-primary" />
      <span className="font-semibold text-xl">AsistenciaApp</span>
    </div>
  );
}