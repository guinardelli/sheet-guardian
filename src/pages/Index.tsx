import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ExcelIcon } from '@/components/ExcelIcon';
import { Shield, Zap, Lock, FileSpreadsheet, CheckCircle, ArrowRight } from 'lucide-react';

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
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <ExcelIcon className="w-12 h-12 text-primary" />
                <span className="text-lg font-semibold text-primary">Excel VBA Blocker</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight">
                Proteja suas planilhas Excel com{' '}
                <span className="text-primary">segurança total</span>
              </h1>
              
              <p className="text-lg text-muted-foreground">
                Bloqueie macros VBA em suas planilhas Excel de forma rápida e segura. 
                Proteja seus dados contra execução não autorizada de código.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={handleGetStarted} className="gap-2">
                  Começar Agora
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/plans')}>
                  Ver Planos
                </Button>
              </div>

              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Processamento seguro
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  100% online
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Resultado instantâneo
                </div>
              </div>
            </div>

            {/* Demo Video Placeholder */}
            <div className="aspect-video bg-muted rounded-xl border border-border flex items-center justify-center">
              <div className="text-center p-8">
                <FileSpreadsheet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Demo em breve</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 px-4 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Por que usar o Excel VBA Blocker?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Proteja suas planilhas Excel com nossa solução profissional e segura
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Pronto para proteger suas planilhas?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Comece agora mesmo e proteja seus arquivos Excel contra macros maliciosos.
          </p>
          <Button size="lg" onClick={handleGetStarted} className="gap-2">
            Começar Gratuitamente
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
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
  <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default Index;
