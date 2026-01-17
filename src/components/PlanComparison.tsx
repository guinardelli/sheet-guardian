import { useTranslation } from 'react-i18next';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureRow {
    name: string;
    free: string | boolean;
    pro: string | boolean;
    premium: string | boolean;
}

export const PlanComparison = () => {
    const { t } = useTranslation();

    const features: FeatureRow[] = [
        {
            name: t('plans.comparison.sheets'),
            free: `3 / ${t('dashboard.days') === 'dias' ? 'semana' : 'week'}`, // Simple logic or better keys
            pro: `20 / ${t('plansPage.perMonth').replace('/', '')}`,
            premium: t('common.unlimited') || "Ilimitado",
        },
        {
            name: t('plans.comparison.fileSize'),
            free: "5 MB",
            pro: "20 MB",
            premium: "50 MB",
        },
        {
            name: t('plans.comparison.vbaProtection'),
            free: true,
            pro: true,
            premium: true,
        },
        {
            name: t('plans.comparison.watermark'),
            free: false,
            pro: true,
            premium: true,
        },
        {
            name: t('plans.comparison.support'),
            free: t('plans.comparison.supportForum') || "Fórum",
            pro: t('plans.comparison.supportEmail') || "E-mail",
            premium: t('plans.comparison.supportVip') || "Prioritário",
        },
        {
            name: t('plans.comparison.api'),
            free: false,
            pro: false,
            premium: t('common.soon') || "Em breve",
        },
    ];

    return (
        <div className="mt-20 overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-soft">
            <div className="p-6 md:p-8 border-b border-border/50 bg-muted/30">
                <h3 className="text-xl font-bold text-foreground">{t('plans.comparison.title')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('plans.comparison.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border/50 bg-muted/10">
                            <th className="py-5 px-6 text-sm font-semibold text-muted-foreground w-1/3 italic capitalize">Recurso</th>
                            <th className="py-5 px-6 text-sm font-bold text-foreground text-center">Free</th>
                            <th className="py-5 px-6 text-sm font-bold text-primary text-center">Professional</th>
                            <th className="py-5 px-6 text-sm font-bold text-accent text-center">Premium</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {features.map((feature, idx) => (
                            <tr key={idx} className="hover:bg-muted/5 transition-colors group">
                                <td className="py-4 px-6 text-sm font-medium text-foreground group-hover:pl-7 transition-all">
                                    {feature.name}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <FeatureValue value={feature.free} />
                                </td>
                                <td className="py-4 px-6 text-center bg-primary/5">
                                    <FeatureValue value={feature.pro} isHighlight />
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <FeatureValue value={feature.premium} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FeatureValue = ({ value, isHighlight }: { value: string | boolean; isHighlight?: boolean }) => {
    if (typeof value === 'boolean') {
        return value ? (
            <Check className={cn("mx-auto h-5 w-5", isHighlight ? "text-primary" : "text-green-500")} />
        ) : (
            <Minus className="mx-auto h-5 w-5 text-muted-foreground/30" />
        );
    }
    return <span className={cn("text-sm font-semibold", isHighlight ? "text-primary" : "text-foreground")}>{value}</span>;
};
