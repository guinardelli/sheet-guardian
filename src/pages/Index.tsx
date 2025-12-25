import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExcelIcon } from '@/components/ExcelIcon';
import { NewHeader } from '@/components/NewHeader';
import { ArrowRight, CheckCircle, FileSpreadsheet, Lock, Shield, Zap } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />

      <section className="relative py-20 md:py-28 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background animate-gradient-shift" />
          <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-sm text-muted-foreground shadow-soft">
              <ExcelIcon className="h-4 w-4 text-primary" />
              Excel VBA Blocker
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              <span className="text-gradient-primary">Proteja suas planilhas</span>
              <br />
              com segurança profissional
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Modifique automaticamente arquivos Excel com VBA, mantendo suas macros seguras,
              funcionais e prontas para distribuir.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <Button size="lg" onClick={() => navigate('/dashboard')} className="hover-lift">
                  Ir para Dashboard
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/auth')} className="hover-lift">
                  Começar Gratuitamente
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => navigate('/plans')} className="hover-lift">
                Ver Planos
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 pt-4">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                Processamento seguro
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                100% online
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary" />
                Resultado instantâneo
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Recursos</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Tudo que você precisa para proteger suas planilhas
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Design moderno, desempenho rápido e total privacidade no processamento.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              icon={Shield}
              title="Segurança Garantida"
              description="Bloqueie macros VBA para evitar execução de código malicioso em suas planilhas Excel."
            />
            <FeatureCard
              icon={Zap}
              title="Processamento Rápido"
              description="Arquivos processados em segundos com tecnologia otimizada e segura."
            />
            <FeatureCard
              icon={Lock}
              title="Privacidade Total"
              description="Seus arquivos são processados localmente no navegador, sem upload externo."
            />
            <FeatureCard
              icon={FileSpreadsheet}
              title="Compatibilidade .xlsm"
              description="Funciona com planilhas Excel com macros habilitadas no formato .xlsm."
            />
            <FeatureCard
              icon={CheckCircle}
              title="Fácil de Usar"
              description="Interface intuitiva com drag-and-drop. Arraste seu arquivo e pronto."
            />
            <FeatureCard
              icon={ArrowRight}
              title="Download Imediato"
              description="Baixe o arquivo processado instantaneamente após o bloqueio."
            />
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Pronto para proteger seu código VBA?
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl mb-10 leading-relaxed">
            Comece agora mesmo e proteja seus arquivos Excel contra macros maliciosos.
          </p>
          <Button size="lg" onClick={() => navigate('/plans')} className="hover-lift">
            Começar Gratuitamente
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Excel VBA Blocker. Todos os direitos reservados.
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
