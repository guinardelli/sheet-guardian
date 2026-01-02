import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { NewHeader } from "@/components/NewHeader";

const Faq = () => {
  const faqItems = [
    {
      question: "Meu arquivo nao processa, e agora?",
      answer: (
        <ul className="list-disc pl-5 space-y-2">
          <li>Verifique se e .xlsm, se nao esta corrompido e se esta dentro do limite do seu plano.</li>
          <li>Faca logout/login e tente novamente.</li>
          <li>Tente um arquivo menor para descartar problemas de tamanho.</li>
        </ul>
      ),
    },
    {
      question: "O que muda no meu arquivo?",
      answer: (
        <p>
          Apenas padroes de protecao no projeto VBA. Formulas, dados e layout nao sao alterados.
        </p>
      ),
    },
    {
      question: "Isso remove senha do Excel?",
      answer: <p>Nao. O foco e no projeto VBA, nao em senhas de arquivo/planilha.</p>,
    },
    {
      question: "Funciona no Mac?",
      answer: (
        <p>
          Sim, o app e web. Para abrir o resultado, voce precisa do Excel para Mac (ou compativel).
        </p>
      ),
    },
    {
      question: "Meu antivirus/Excel acusou macro.",
      answer: (
        <p>O arquivo continua com macros. Abra apenas se voce confiar no arquivo e no remetente.</p>
      ),
    },
    {
      question: "Meu plano nao atualizou apos o pagamento.",
      answer: (
        <p>
          Aguarde alguns minutos, faca logout/login e verifique novamente. O app sincroniza com o Stripe.
        </p>
      ),
    },
    {
      question: "Como cancelar/gerenciar minha assinatura?",
      answer: (
        <p>
          Use o botao de &quot;Gerenciar Assinatura&quot; na pagina de{" "}
          <Link to="/plans" className="text-primary hover:underline underline-offset-4">
            Planos
          </Link>{" "}
          ou{" "}
          <Link to="/account" className="text-primary hover:underline underline-offset-4">
            Conta
          </Link>{" "}
          (abre o portal do Stripe).
        </p>
      ),
    },
    {
      question: "O processamento e local?",
      answer: (
        <p>
          No fluxo atual, o arquivo e enviado para a Edge Function. Nao ha armazenamento do arquivo no codigo.
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <NewHeader />

      <main className="container px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">FAQ</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Perguntas frequentes
            </h1>
            <p className="text-muted-foreground">
              Respostas rapidas sobre processamento de planilhas, planos e seguranca.
            </p>
          </header>

          <section className="space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-border/60 bg-background/80 p-5 shadow-soft"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2">
                  <span>{item.question}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </div>
              </details>
            ))}
          </section>

          <section
            id="suporte-contato"
            className="rounded-2xl border border-border/60 bg-muted/30 p-6 shadow-soft space-y-4"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Suporte e contato</h2>
              <p className="text-sm text-muted-foreground">
                Canais oficiais para tirar duvidas ou reportar problemas.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">GitHub Issues:</span> Use para bugs e sugestoes em{" "}
                <a
                  href="https://github.com/guinardelli/sheet-guardian/issues"
                  className="text-primary hover:underline underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  github.com/guinardelli/sheet-guardian/issues
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-foreground">Seguranca:</span> Para relatar vulnerabilidades,
                envie email para{" "}
                <a
                  href="mailto:security@sheetguardian.com"
                  className="text-primary hover:underline underline-offset-4"
                >
                  security@sheetguardian.com
                </a>
                .
              </li>
            </ul>
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

export default Faq;
