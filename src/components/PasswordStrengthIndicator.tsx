import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const RULES: Rule[] = [
  { label: "Mínimo 6 caracteres", test: (pw) => pw.length >= 6 },
  { label: "Letra maiúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Letra minúscula", test: (pw) => /[a-z]/.test(pw) },
  { label: "Número", test: (pw) => /[0-9]/.test(pw) },
  { label: "Caractere especial (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  const passed = RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return { score: 1, label: "Muito fraca", color: "bg-destructive" };
  if (passed === 2) return { score: 2, label: "Fraca", color: "bg-orange-500" };
  if (passed === 3) return { score: 3, label: "Razoável", color: "bg-amber-500" };
  if (passed === 4) return { score: 4, label: "Boa", color: "bg-emerald-400" };
  return { score: 5, label: "Forte", color: "bg-emerald-500" };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { score, label, color } = useMemo(() => getStrength(password), [password]);
  const ruleResults = useMemo(() => RULES.map((r) => ({ ...r, passed: r.test(password) })), [password]);

  if (!password) return null;

  return (
    <div className="space-y-2 pt-1">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                i <= score ? color : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className={cn("text-xs font-medium", score <= 2 ? "text-destructive" : score <= 3 ? "text-amber-500" : "text-emerald-500")}>
          {label}
        </span>
      </div>

      {/* Rules checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {ruleResults.map((rule) => (
          <div key={rule.label} className="flex items-center gap-1.5">
            {rule.passed ? (
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
            <span className={cn("text-[11px]", rule.passed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60")}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function isPasswordStrong(password: string): boolean {
  return RULES.filter((r) => r.test(password)).length >= 3;
}
