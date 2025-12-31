# Supabase scheduled functions

## Objetivo
Agendar a edge function `cleanup-tokens` para rodar automaticamente.

## Passos
1) Supabase Dashboard -> Edge Functions -> cleanup-tokens -> Schedule.
2) Cron sugerido (UTC): `0 3 * * *` (diario).
3) Salvar e verificar logs da execucao.

## Observacoes
- A funcao usa `SUPABASE_SERVICE_ROLE_KEY`, garantido pelo ambiente do Supabase.
- Ajustar a janela de delete se necessario.
