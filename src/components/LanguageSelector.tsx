import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export const LanguageSelector = () => {
  const [lang, setLang] = useState<'pt' | 'en'>('pt');

  useEffect(() => {
    const stored = localStorage.getItem('language');
    if (stored === 'pt' || stored === 'en') {
      setLang(stored);
    }
  }, []);

  const toggleLanguage = (newLang: 'pt' | 'en') => {
    setLang(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Selecionar idioma">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">{lang.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toggleLanguage('pt')}>
          Português
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleLanguage('en')}>
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
