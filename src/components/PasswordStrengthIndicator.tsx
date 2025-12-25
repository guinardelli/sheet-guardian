import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: 'Mínimo de 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Uma letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Um número', test: (p) => /[0-9]/.test(p) },
  { label: 'Um caractere especial (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrengthIndicator({
  password,
  showRequirements = true
}: PasswordStrengthIndicatorProps) {
  const metRequirements = requirements.filter(req => req.test(password));
  const strength = metRequirements.length;
  const percentage = (strength / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strength <= 2) return 'bg-destructive';
    if (strength <= 4) return 'bg-warning';
    return 'bg-success';
  };

  const getStrengthLabel = () => {
    if (strength <= 2) return 'Fraca';
    if (strength <= 4) return 'Média';
    return 'Forte';
  };

  if (!password && !showRequirements) return null;

  return (
    <div className="space-y-2">
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Força da senha:</span>
            <span className={cn(
              "font-medium",
              strength <= 2 && "text-destructive",
              strength > 2 && strength <= 4 && "text-warning",
              strength === 5 && "text-success"
            )}>
              {getStrengthLabel()}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", getStrengthColor())}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {showRequirements && (
        <ul className="space-y-1 text-xs">
          {requirements.map((req, index) => {
            const isMet = req.test(password);
            return (
              <li
                key={index}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  isMet ? "text-success" : "text-muted-foreground"
                )}
              >
                {isMet ? (
                  <Check className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <X className="h-3 w-3 flex-shrink-0" />
                )}
                <span>{req.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
