import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Step {
    id: string;
    label: string;
    completed: boolean;
}

interface SuccessChecklistProps {
    steps: Step[];
    className?: string;
}

export const SuccessChecklist = ({ steps, className }: SuccessChecklistProps) => {
    const { t } = useTranslation();
    const allCompleted = steps.every((s) => s.completed);

    if (allCompleted) return null;

    return (
        <Card className={cn('border-primary/20 bg-primary/5 shadow-soft animate-fade-in', className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {t('dashboard.checklist.title', { defaultValue: 'Primeiros Passos' })}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {steps.map((step) => (
                        <li key={step.id} className="flex items-center gap-3 text-sm">
                            {step.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                                <Circle className="h-4 w-4 text-muted-foreground animate-pulse" />
                            )}
                            <span className={cn(step.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium')}>
                                {t(`dashboard.checklist.${step.id}`, { defaultValue: step.label })}
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};
