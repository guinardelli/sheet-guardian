import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ExcelIcon } from '@/components/ExcelIcon';
import { Shield, Zap, Lock, FileSpreadsheet, CheckCircle, ArrowRight, Home } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="py-20 md:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ExcelIcon className="w-8 h-8 text-primary" />
                </div>
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                  Excel VBA Blocker
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-[1.1]">
                Proteja seu código VBA Excel com{' '}
                <span className="text-gradient-primary">segurança total</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                Bloqueie macros VBA em suas planilhas Excel de forma rápida e segura.
                Proteja seus dados contra cópia não autorizada.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                {user ? (
                  <>
                    <Button size="lg" onClick={() => navigate('/dashboard')} className="gap-2 shadow-soft h-12 px-6">
                      <Home className="w-4 h-4" />
                      Ir para Início
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => navigate('/plans')} className="h-12 px-6">
                      Ver Planos
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" onClick={handleGetStarted} className="gap-2 shadow-soft h-12 px-6">
                      Começar Agora
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => navigate('/plans')} className="h-12 px-6">
                      Ver Planos
                    </Button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-3 pt-4">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Processamento seguro</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>100% online</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Resultado instantâneo</span>
                </div>
              </div>
            </div>

            {/* Demo Video Placeholder */}
            <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-2xl border border-border/50 flex items-center justify-center shadow-soft-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--primary)/0.08),_transparent_70%)]" />
              <div className="text-center p-8 relative">
                <div className="w-20 h-20 rounded-2xl bg-background/80 backdrop-blur flex items-center justify-center mx-auto mb-5 shadow-soft">
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Demo em breve</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
              Recursos
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
              Por que usar o Excel VBA Blocker?
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Proteja suas planilhas Excel com nossa solução profissional e segura
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
              description="Processe seus arquivos em segundos com nossa tecnologia otimizada para máxima performance."
            />
            <FeatureCard
              icon={Lock}
              title="Proteção de Dados"
              description="Seus arquivos são processados localmente no navegador, garantindo total privacidade."
            />
            <FeatureCard
              icon={FileSpreadsheet}
              title="Suporte a .xlsm"
              description="Compatível com arquivos Excel com macros habilitadas no formato .xlsm."
            />
            <FeatureCard
              icon={CheckCircle}
              title="Fácil de Usar"
              description="Interface intuitiva com drag-and-drop. Arraste seu arquivo e pronto!"
            />
            <FeatureCard
              icon={ArrowRight}
              title="Download Imediato"
              description="Baixe seu arquivo processado instantaneamente após o bloqueio dos macros."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Pronto para proteger seu código VBA?
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl mb-10 leading-relaxed">
            Comece agora mesmo e proteja seus arquivos Excel contra macros maliciosos.
          </p>
          <Button size="lg" onClick={() => navigate('/plans')} className="gap-2 shadow-soft h-12 px-8">
            Começar Gratuitamente
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
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
  <div className="group bg-card border border-border/50 rounded-2xl p-6 lg:p-8 shadow-soft hover:shadow-soft-lg hover:border-primary/20 transition-all duration-300">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-3 tracking-tight">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

export default Index;
