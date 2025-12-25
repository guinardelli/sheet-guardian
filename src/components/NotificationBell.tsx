import { useMemo, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  read: boolean;
  timestamp: Date;
};

const initialNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Limite de uso quase atingido',
    description: 'Você utilizou 80% do seu limite mensal.',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 18),
  },
  {
    id: '2',
    type: 'info',
    title: 'Novo recurso disponível',
    description: 'Agora você pode salvar preferências de idioma.',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: '3',
    type: 'success',
    title: 'Processamento concluído',
    description: 'Seu arquivo foi processado com sucesso.',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
  },
];

const typeStyles = {
  warning: {
    icon: AlertTriangle,
    className: 'text-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning))]/10',
  },
  info: {
    icon: Info,
    className: 'text-[hsl(var(--color-info))] bg-[hsl(var(--color-info))]/10',
  },
  success: {
    icon: CheckCircle2,
    className: 'text-primary bg-primary/10',
  },
};

const formatTimestamp = (date: Date) => {
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays}d`;
};

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Abrir notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] justify-center rounded-full px-1.5 py-0 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lidas` : 'Nenhuma pendente'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={markAllAsRead}
              disabled={notifications.length === 0 || unreadCount === 0}
            >
              Marcar tudo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={clearAll}
              disabled={notifications.length === 0}
            >
              Limpar
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={BellOff}
                title="Sem notificações"
                description="Quando houver atualizações, você verá aqui."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((notification) => {
                const config = typeStyles[notification.type];
                const Icon = config.icon;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      !notification.read && 'bg-muted/30',
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className={cn('mt-0.5 rounded-full p-1.5', config.className)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
