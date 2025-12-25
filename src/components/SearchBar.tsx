import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Home, LayoutDashboard, CreditCard, User, LifeBuoy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
}

const shortcuts = {
  mac: '⌘K',
  windows: 'Ctrl+K',
};

export const SearchBar = ({ className }: SearchBarProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /mac/i.test(navigator.platform);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className={cn('w-full', className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-full justify-between gap-2 border-border/60 bg-background/70 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Abrir busca"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar...</span>
          <span className="sm:hidden">Buscar</span>
        </span>
        <kbd className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {isMac ? shortcuts.mac : shortcuts.windows}
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            <CommandItem onSelect={() => handleNavigate('/')}>
              <Home className="mr-2 h-4 w-4" />
              Início
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/plans')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Planos
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/account')}>
              <User className="mr-2 h-4 w-4" />
              Conta
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Ajuda">
            <CommandItem disabled>
              <LifeBuoy className="mr-2 h-4 w-4" />
              Central de ajuda (em breve)
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Arquivos">
            <CommandItem disabled>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Arquivos processados (em breve)
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};
