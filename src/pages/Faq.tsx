import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { NewHeader } from "@/components/NewHeader";

const Faq = () => {
  const { t } = useTranslation();
  const faqItems = [
    {
      question: t('faq.questions.noProcess'),
      answer: <p>{t('faq.questions.noProcessAns')}</p>,
    },
    {
      question: t('faq.questions.fileChanges'),
      answer: <p>{t('faq.questions.fileChangesAns')}</p>,
    },
    {
      question: t('faq.questions.excelPassword'),
      answer: <p>{t('faq.questions.excelPasswordAns')}</p>,
    },
    {
      question: t('faq.questions.macSupport'),
      answer: <p>{t('faq.questions.macSupportAns')}</p>,
    },
    {
      question: t('faq.questions.antivirus'),
      answer: <p>{t('faq.questions.antivirusAns')}</p>,
    },
    {
      question: t('faq.questions.sync'),
      answer: <p>{t('faq.questions.syncAns')}</p>,
    },
    {
      question: t('faq.questions.cancel'),
      answer: <p>{t('faq.questions.cancelAns')}</p>,
    },
    {
      question: t('faq.questions.local'),
      answer: <p>{t('faq.questions.localAns')}</p>,
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
              {t('faq.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('faq.subtitle')}
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
              <h2 className="text-xl font-semibold text-foreground">{t('faq.contact')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('faq.contactDesc')}
              </p>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Email:</span>{" "}
                <a
                  href="mailto:suporte@sheetguardian.com"
                  className="text-primary hover:underline underline-offset-4"
                >
                  suporte@sheetguardian.com
                </a>
              </li>
              <li>
                <span className="font-medium text-foreground">{t('common.privacy') ?? 'Privacidade'}:</span>{" "}
                <a
                  href="mailto:privacidade@sheetguardian.com"
                  className="text-primary hover:underline underline-offset-4"
                >
                  privacidade@sheetguardian.com
                </a>
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
            <span>© {new Date().getFullYear()} Excel VBA Blocker.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Faq;
