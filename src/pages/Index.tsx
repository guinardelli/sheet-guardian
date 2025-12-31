import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExcelIcon } from '@/components/ExcelIcon';
import { NewHeader } from '@/components/NewHeader';
import { ProblemSection } from '@/components/ProblemSection';
import { UseCasesSection } from '@/components/UseCasesSection';
import { CheckCircle, Lock, Shield, Zap } from 'lucide-react';

const Index = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <NewHeader />

      <section className="relative py-12 sm:py-20 md:py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background" />
          <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-7 md:space-y-8 lg:space-y-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-sm text-muted-foreground shadow-soft">
              <ExcelIcon className="h-4 w-4 text-primary" />
              {t('landing.badge')}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              <span className="text-gradient-primary">{t('landing.title1')}</span>
              <br />
              {t('landing.title2')}
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('landing.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center">
              {user ? (
                <Button size="lg" onClick={() => navigate('/dashboard')} className="hover-lift">
                  {t('landing.ctaLoggedIn')}
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/auth')} className="hover-lift">
                  {t('landing.ctaLoggedOut')}
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => navigate('/plans')} className="hover-lift">
                {t('landing.ctaPlans')}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground/80 italic">
              {t('landing.localProcessing')}
            </p>

            <div className="flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-2 sm:gap-y-3 pt-3 sm:pt-6">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('landing.feature1')}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('landing.feature2')}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('landing.feature3')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProblemSection />

      <section className="py-12 sm:py-20 md:py-24 lg:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-7 sm:mb-10 md:mb-12 lg:mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">{t('landing.featuresTitle')}</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
              {t('landing.featuresHeading')}
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
            <FeatureCard
              icon={Shield}
              title={t('landing.featureVBE')}
              description={t('landing.featureVBEDesc')}
            />
            <FeatureCard
              icon={Zap}
              title={t('landing.featureFrictionless')}
              description={t('landing.featureFrictionlessDesc')}
            />
            <FeatureCard
              icon={Lock}
              title={t('landing.featurePrivacy')}
              description={t('landing.featurePrivacyDesc')}
            />
          </div>
        </div>
      </section>

      <UseCasesSection />

      <section className="py-12 sm:py-20 md:py-24 lg:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl mb-5 sm:mb-8 md:mb-10 leading-relaxed">
            {t('landing.ctaSubtitle')}
          </p>
          <Button size="lg" onClick={() => navigate('/plans')} className="hover-lift">
            {t('landing.ctaButton')}
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/50 py-5 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Excel VBA Blocker. {t('common.allRightsReserved')}.
          </p>
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <Card className="border-border/50 shadow-soft hover-lift transition-all duration-200">
    <CardContent className="pt-6 space-y-3">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </CardContent>
  </Card>
);

export default Index;
