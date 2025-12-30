import { useTranslation } from 'react-i18next';
import { Briefcase, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const UseCasesSection = () => {
  const { t } = useTranslation();

  const useCases = [
    {
      icon: Briefcase,
      title: t('useCases.consultants'),
      description: t('useCases.consultantsDesc'),
      gradient: 'from-primary/10 to-accent/10',
    },
    {
      icon: TrendingUp,
      title: t('useCases.sellers'),
      description: t('useCases.sellersDesc'),
      gradient: 'from-accent/10 to-primary/10',
    },
    {
      icon: Users,
      title: t('useCases.teams'),
      description: t('useCases.teamsDesc'),
      gradient: 'from-primary/10 to-accent/10',
    },
  ];

  return (
    <section className="py-12 sm:py-20 md:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-7 sm:mb-10 md:mb-12 lg:mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            {t('useCases.title')}
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5">
            {t('useCases.heading')}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('useCases.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {useCases.map((useCase, index) => (
            <Card
              key={index}
              className="border-border/50 shadow-soft hover-lift transition-all duration-300 overflow-hidden"
            >
              <div className={`h-2 bg-gradient-to-r ${useCase.gradient}`} />
              <CardContent className="pt-5 sm:pt-8 pb-4 sm:pb-6 space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <useCase.icon className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-center">{useCase.title}</h3>
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {useCase.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
