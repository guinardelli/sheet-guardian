import { Link } from "react-router-dom";
import { NewHeader } from "@/components/NewHeader";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <NewHeader />

      <main className="container px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Termos de Uso</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Condicoes para uso do Sheet Guardian
            </h1>
            <p className="text-muted-foreground">
              Ao utilizar o Sheet Guardian, voce concorda com os termos abaixo. Leia com atencao antes de usar o
              servico.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Descricao do servico</h2>
            <p className="text-muted-foreground">
              O Sheet Guardian oferece processamento de arquivos .xlsm via Edge Function para modificar padroes
              VBA, com limites de uso definidos pelo plano contratado. O arquivo e processado em memoria e
              devolvido ao usuario, sem armazenamento permanente.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Planos e limites</h2>
            <p className="text-muted-foreground">
              Os limites de uso variam conforme o plano (free, professional ou premium) e podem ser alterados com
              aviso previo. O uso abusivo pode resultar em suspensao.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Responsabilidades do usuario</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Garantir que possui direitos sobre os arquivos enviados.</li>
              <li>Manter suas credenciais em seguranca e nao compartilhar acesso.</li>
              <li>Respeitar as politicas de uso e nao tentar burlar limites.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Limitacao de responsabilidade</h2>
            <p className="text-muted-foreground">
              O servico e fornecido "como esta". Nao nos responsabilizamos por perdas indiretas ou danos
              consequentes. Recomendamos backup antes do processamento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Politica de reembolso</h2>
            <p className="text-muted-foreground">
              Reembolsos seguem as politicas do provedor de pagamento e a legislacao aplicavel. Solicite suporte em
              ate 7 dias corridos quando aplicavel, pelo e-mail suporte@sheetguardian.com.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Jurisicao</h2>
            <p className="text-muted-foreground">
              Estes termos sao regidos pelas leis brasileiras. Eventuais controversias serao resolvidas no foro
              competente do Brasil.
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

export default Terms;
