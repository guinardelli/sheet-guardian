import { ProcessingResult } from '@/lib/excel-vba-modifier';
import { FileCheck, Shield, HardDrive, CheckCircle2 } from 'lucide-react';

interface StatisticsCardProps {
  result: ProcessingResult | null;
}

export function StatisticsCard({ result }: StatisticsCardProps) {
  if (!result) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const stats = [
    {
      icon: FileCheck,
      label: 'VBA Encontrado',
      value: result.vbaExists ? 'Sim' : 'Não',
      color: result.vbaExists ? 'text-primary' : 'text-muted-foreground'
    },
    {
      icon: Shield,
      label: 'Padrões Modificados',
      value: result.patternsModified.toString(),
      color: result.patternsModified > 0 ? 'text-primary' : 'text-muted-foreground'
    },
    {
      icon: HardDrive,
      label: 'Tamanho Original',
      value: formatSize(result.originalSize),
      color: 'text-muted-foreground'
    },
    {
      icon: CheckCircle2,
      label: 'Tamanho Final',
      value: formatSize(result.modifiedSize),
      color: 'text-primary'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 p-5 rounded-xl bg-card border border-border/50 shadow-soft"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${stat.color === 'text-primary' ? 'bg-primary/10' : 'bg-muted'}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
          </div>
          <span className={`text-xl font-bold ${stat.color} tracking-tight`}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
