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
  warning: 'text-[hsl(var(--color-warning))]',
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
      <h3 className="text-foreground text-lg font-semibold tracking-tight">Log de Processamento</h3>
      <div
        ref={scrollRef}
        className="flex flex-col h-72 w-full rounded-xl bg-[hsl(var(--color-log-bg))] p-5 font-mono text-sm text-muted-foreground overflow-y-auto shadow-soft-lg"
      >
        {logs.length === 0 ? (
          <div className="flex items-start gap-3 py-2">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground/80 mt-0.5 animate-pulse" />
            <p className="flex-1 leading-relaxed text-muted-foreground/70">Aguardando arquivo para iniciar...</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const Icon = iconMap[log.type];
            return (
              <div
                key={index}
                className="flex items-start gap-3 py-2 animate-fade-in border-b border-border/30 last:border-0"
              >
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', colorMap[log.type])} />
                <span className="text-muted-foreground/80 flex-shrink-0 tabular-nums">[{formatTime(log.timestamp)}]</span>
                <p className="flex-1 leading-relaxed break-words">{log.message}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
