# Runbook de Incidentes

## Severidade
- SEV1: App completamente fora do ar
- SEV2: Feature critica quebrada (pagamentos, upload)
- SEV3: Bug afetando subset de usuarios
- SEV4: Issue cosmetico

## Procedimentos

### SEV1 - App Fora do Ar
1. Verificar Vercel status
2. Verificar Supabase status
3. Verificar Stripe status
4. Se problema interno: rollback para ultima versao estavel
5. Comunicar em #incidents no Slack

### Rollback Procedure
1. Vercel Dashboard -> Deployments
2. Encontrar ultimo deploy estavel
3. Click "Promote to Production"
4. Verificar smoke tests
5. Monitorar metricas por 15 min

### Contatos de Emergencia
- DevOps: [NOME] - [TELEFONE]
- Backend: [NOME] - [TELEFONE]
