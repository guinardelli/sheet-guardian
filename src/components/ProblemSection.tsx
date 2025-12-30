import { AlertCircle, XCircle, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const ProblemSection = () => {
  const problems = [
    {
      icon: XCircle,
      text: 'As senhas nativas do Excel são quebradas em instantes.',
      color: 'text-destructive',
    },
    {
      icon: AlertCircle,
      text: 'Clientes curiosos podem "quebrar" suas fórmulas complexas ao tentar editar.',
      color: 'text-warning',
    },
    {
      icon: TrendingDown,
      text: 'Concorrentes podem roubar sua lógica e revender seu produto mais barato.',
      color: 'text-destructive',
    },
  ];

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-destructive/5">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6">
          Você gasta horas codificando,{' '}
          <span className="text-destructive">eles levam segundos para copiar.</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {problems.map((problem, index) => (
            <Card key={index} className="border-destructive/20 bg-background/80">
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <problem.icon className={`w-7 h-7 ${problem.color}`} />
                  </div>
                </div>
                <p className="text-sm text-center text-foreground/90 leading-relaxed">
                  {problem.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-0 bg-destructive/20 blur-2xl rounded-full" />
            <div className="relative bg-muted/50 backdrop-blur-sm border border-destructive/30 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground italic">
                Ferramentas gratuitas online removem proteções nativas em segundos
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
