import { NewHeader } from "@/components/NewHeader";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <NewHeader />

      <main className="container px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Politica de Privacidade</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Como tratamos seus dados</h1>
            <p className="text-muted-foreground">
              Este documento descreve, de forma objetiva, quais dados coletamos e como usamos as informacoes
              relacionadas ao uso do Sheet Guardian.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Dados coletados</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Informacoes de conta: e-mail e identificadores de autenticacao.</li>
              <li>Dados tecnicos: endereco IP, navegador, dispositivo e logs de erro.</li>
              <li>Uso do produto: eventos de uso, limites de plano e sucesso de processamento.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Processamento de arquivos</h2>
            <p className="text-muted-foreground">
              O processamento de arquivos .xlsm ocorre localmente no navegador. Nao fazemos upload do arquivo
              para nossos servidores, exceto quando voce optar por enviar logs de erro ou diagnosticos.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Cookies e tecnologias similares</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies estritamente necessarios para autenticacao e sessao. Tambem podemos usar cookies
              de analytics, sempre respeitando a configuracao de consentimento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Compartilhamento com terceiros</h2>
            <p className="text-muted-foreground">
              Trabalhamos com provedores essenciais para operar o servico, incluindo Supabase (autenticacao e
              banco de dados) e Stripe (pagamentos). Esses parceiros tratam dados apenas para fins operacionais.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Direitos do usuario (LGPD)</h2>
            <p className="text-muted-foreground">
              Voce pode solicitar acesso, correcao, exclusao ou portabilidade dos seus dados. Para isso, entre em
              contato com nosso DPO pelo e-mail informado abaixo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Contato do DPO</h2>
            <p className="text-muted-foreground">
              DPO: <span className="font-medium text-foreground">[NOME]</span> &middot;{" "}
              <span className="font-medium text-foreground">[EMAIL]</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Este texto e um rascunho e deve ser revisado por assessoria juridica antes do lancamento.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-4">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Excel VBA Blocker. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
