import { Link } from "react-router-dom";
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
              O processamento de arquivos .xlsm ocorre via Edge Function. O arquivo e enviado para processamento
              em memoria e nao e armazenado em banco ou storage. Metadados de uso e logs de erro podem ser
              registrados para operacao e suporte.
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
              contato com nosso canal de privacidade pelo e-mail informado abaixo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Contato de privacidade</h2>
            <p className="text-muted-foreground">
              Controlador: <span className="font-medium text-foreground">Sheet Guardian</span> &middot;{" "}
              <span className="font-medium text-foreground">suporte@sheetguardian.com</span>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-4">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <Link to="/faq" className="text-primary hover:underline underline-offset-4">
              FAQ
            </Link>
            <span className="hidden sm:inline text-muted-foreground/60">•</span>
            <span>© {new Date().getFullYear()} Excel VBA Blocker. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
