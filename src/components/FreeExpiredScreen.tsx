import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, LogOut, ArrowRight, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FreeExpiredScreen() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <HabitaeLogo variant="horizontal" size="lg" />
      <Card className="mt-8 max-w-md w-full">
        <CardContent className="py-8 text-center space-y-5">
          <Clock className="h-14 w-14 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Seu período gratuito encerrou</h2>
          <p className="text-muted-foreground text-sm">
            Os 15 dias do plano Gratuito expiraram. Assine um plano para continuar usando a plataforma.
          </p>

          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">Desconto exclusivo!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Por ter usado o período gratuito, você ganha{" "}
              <Badge variant="secondary" className="text-primary font-bold">25% OFF</Badge>{" "}
              em qualquer plano.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              className="gap-2 w-full" 
              onClick={() => navigate("/planos?discount=free25")}
            >
              Ver planos com desconto
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
