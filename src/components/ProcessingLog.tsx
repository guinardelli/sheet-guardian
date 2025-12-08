import { useEffect, useRef } from 'react';
import { LogEntry } from '@/lib/excel-vba-modifier';
import { cn } from '@/lib/utils';
import { MoreHorizontal, CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react';

interface ProcessingLogProps {
  logs: LogEntry[];
}

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
};

const colorMap = {
  info: 'text-muted-foreground',
  success: 'text-primary',
  warning: 'text-yellow-500',
  error: 'text-destructive',
};

export function ProcessingLog({ logs }: ProcessingLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-foreground text-xl font-bold">Log de Processamento</h3>
      <div 
        ref={scrollRef}
        className="flex flex-col h-72 w-full rounded-lg bg-slate-900 p-4 font-mono text-sm text-slate-300 overflow-y-auto"
      >
        {logs.length === 0 ? (
          <div className="flex items-start gap-3 py-1.5">
            <MoreHorizontal className="w-4 h-4 text-slate-500 mt-0.5" />
            <p className="flex-1 leading-relaxed">Aguardando arquivo para iniciar...</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const Icon = iconMap[log.type];
            return (
              <div 
                key={index} 
                className="flex items-start gap-3 py-1.5 animate-fade-in"
              >
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', colorMap[log.type])} />
                <span className="text-slate-500 flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                <p className="flex-1 leading-relaxed break-words">{log.message}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
