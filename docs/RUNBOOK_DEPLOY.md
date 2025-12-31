# Runbook de Deploy

## Pre-Deploy Checklist
- [ ] Todos os testes passando (CI verde)
- [ ] Code review aprovado
- [ ] Migrations testadas em staging
- [ ] Changelog atualizado

## Deploy para Staging
1. Merge PR para branch staging
2. CI executa automaticamente
3. Verificar preview deployment
4. Executar smoke tests
5. Testar fluxos criticos manualmente

## Deploy para Production
1. Merge staging para main
2. CI executa automaticamente
3. Monitorar Sentry por 15 min
4. Verificar metricas no dashboard
5. Comunicar em #releases

## Post-Deploy Verification
```bash
# Smoke tests
curl https://vbablocker.vercel.app/ # Expect: HTML
curl https://[PROJECT].supabase.co/functions/v1/health-check # Expect: {"status":"ok"}
```
