import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface Requirement {
  key: string;
  test: (password: string) => boolean;
}

const requirementTests: Requirement[] = [
  { key: 'minChars', test: (p) => p.length >= 8 },
  { key: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { key: 'number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrengthIndicator({
  password,
  showRequirements = true
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation();

  const metRequirements = requirementTests.filter(req => req.test(password));
  const strength = metRequirements.length;
  const percentage = (strength / requirementTests.length) * 100;

  const getStrengthColor = () => {
    if (strength <= 2) return 'bg-destructive';
    if (strength <= 4) return 'bg-warning';
    return 'bg-success';
  };

  const getStrengthLabel = () => {
    if (strength <= 2) return t('passwordStrength.weak');
    if (strength <= 4) return t('passwordStrength.medium');
    return t('passwordStrength.strong');
  };

  if (!password && !showRequirements) return null;

  return (
    <div className="space-y-2">
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('passwordStrength.label')}</span>
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
          {requirementTests.map((req, index) => {
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
                <span>{t(`passwordStrength.${req.key}`)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
