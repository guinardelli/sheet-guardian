Setup de Ambiente para Testes Manuais (Fase 3)
Este guia fornece os dados e artefatos necessários para desbloquear os cenários A, B e C do plano de QA.
1. Usuário de Teste (Cenários A e B)
Como o Supabase Auth usa hashing seguro (bcrypt), não podemos inserir um usuário via SQL simples.
Ação: Utilize o fluxo de cadastro da própria aplicação.
Acesse a aplicação (Local ou Preview): /auth
Realize Sign Up com os dados:
Email: estruturas.gn@gmail.com
Senha: Guin20101@#
Obter o user_id: 393589b0-a7f4-4708-8f40-68f68b8d920d
Acesse o SQL Editor do Supabase (Dashboard) e rode:
select id, email from auth.users where email = 'estruturas.gn@gmail.com';


Copie este UUID para usar nos passos abaixo.
2. Artefato de Teste .xlsm (Cenário A)
Precisamos de um arquivo "limpo" e seguro, mas protegido por senha VBA.
Ação: Siga este passo a passo para criar o arquivo vba-protegido.xlsm em 1 minuto:
Abra um Excel em branco.
Pressione Alt + F11 para abrir o editor VBA.
No menu superior, vá em Tools (Ferramentas) > VBAProject Properties (Propriedades).
Aba Protection (Proteção):
[x] Marque "Lock project for viewing" (Bloquear projeto para exibição).
Senha: 1234gui
Confirmar: 1234gui
Clique OK e feche o editor VBA.
Salve o arquivo como:
Nome: teste_qa_bloqueado.xlsm
Tipo: "Pasta de Trabalho Habilitada para Macro do Excel (.xlsm)"
3. Webhook e Edge Function (Cenário C)
Dados de Produção
Baseado no log de deploy do projeto dgweztejbixowxmfizgx:
URL da Função (Target):
https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook
Como testar sem o STRIPE_WEBHOOK_SECRET real
Você não precisa da chave secreta se usar o Stripe CLI para disparar o evento diretamente, pois ele simula a assinatura corretamente.
Comando para Disparo (Terminal):
Substitua <SEU_USER_ID> pelo UUID obtido no Passo 1.
# Disparar evento de Compra Aprovada
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.user_id=<SEU_USER_ID> \
  --add checkout_session:mode=subscription


Nota: Se você quiser testar contra o LOCALHOST, adicione --forward-to localhost:54321/functions/v1/stripe-webhook ao comando stripe listen, e use o secret que ele exibir no terminal.
4. Scripts de Manipulação de Estado (Cenário B)
Para testar o limite do plano Free:
SQL para Forçar Bloqueio:
Substitua <SEU_USER_ID> pelo UUID obtido.
-- Forçar usuário para plano Free e estourar o limite (ex: 5 arquivos)
UPDATE public.profiles
SET 
    subscription_tier = 'free',
    files_processed_total = 5,
    files_processed_this_week = 5
WHERE id = '<SEU_USER_ID>';


SQL para Resetar (Para retestar):
UPDATE public.profiles
SET 
    files_processed_total = 0,
    files_processed_this_week = 0
WHERE id = '<SEU_USER_ID>';


