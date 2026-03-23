import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, LogOut, ArrowRight } from "lucide-react";

export function TrialExpiredScreen() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <HabitaeLogo variant="horizontal" size="lg" />
      <Card className="mt-8 max-w-md w-full">
        <CardContent className="py-8 text-center space-y-5">
          <Clock className="h-14 w-14 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Período de teste encerrado</h2>
          <p className="text-sm text-muted-foreground">
            Seu período gratuito de 7 dias expirou. Assine um plano para continuar utilizando a plataforma.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="gap-2 w-full"
              onClick={() => navigate("/planos")}
            >
              Ver planos disponíveis
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}