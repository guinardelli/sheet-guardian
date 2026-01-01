import { useState } from 'react';

import { useAuth } from './useAuth';
import { useToast } from './use-toast';

import { supabase } from '@/services/supabase/client';
import { logger } from '@/lib/logger';

export const useSubscriptionManagement = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const openCustomerPortal = async () => {
    if (!session?.access_token) {
      toast({
        title: 'Sessao nao encontrada',
        description: 'Por favor, faca login novamente.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('URL do portal nao recebida');
      }
    } catch (error) {
      logger.error('Portal error', error);
      toast({
        title: 'Erro ao abrir portal',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCustomerPortal, loading };
};

