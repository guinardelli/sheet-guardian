import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { FileDropzone } from '@/components/FileDropzone';
import { ProcessingLog } from '@/components/ProcessingLog';
import { StatisticsCard } from '@/components/StatisticsCard';
import { ExcelIcon } from '@/components/ExcelIcon';
import { Header } from '@/components/Header';
import {
  processExcelFile,
  downloadFile,
  LogEntry,
  ProcessingResult
} from '@/lib/excel-vba-modifier';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

const PROCESSING_MESSAGES = [
  'Analisando arquivo...',
  'Verificando estrutura VBA...',
  'Processando macros...',
  'Aplicando modificações...',
  'Finalizando...',
];

// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES = 100;

const Dashboard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [downloadAllowed, setDownloadAllowed] = useState(false);

  // Ref to prevent double processing
  const processingLockRef = useRef(false);

  const { user, loading: authLoading, authError, clearAuthError } = useAuth();
  const { subscription, canProcessSheet, incrementUsage, getUsageStats, isUpdating } = useSubscription();
  const navigate = useNavigate();

  // Show auth errors to user
  useEffect(() => {
    if (authError) {
      toast.error('Erro de autenticação', {
        description: authError,
        action: {
          label: 'Entrar',
          onClick: () => {
            clearAuthError();
            navigate('/auth');
          }
        }
      });
    }
  }, [authError, clearAuthError, navigate]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Cinematic progress animation
  useEffect(() => {
    if (!isProcessing || processingComplete) return;

    const duration = 4000; // 4 seconds
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(Math.floor((currentStep / steps) * 95), 95);
      setDisplayProgress(newProgress);

      // Update message based on progress
      const messageIndex = Math.min(
        Math.floor((newProgress / 100) * PROCESSING_MESSAGES.length),
        PROCESSING_MESSAGES.length - 1
      );
      setProcessingMessage(PROCESSING_MESSAGES[messageIndex]);

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isProcessing, processingComplete]);

  // Complete the progress when processing is done
  useEffect(() => {
    if (processingComplete && result) {
      setDisplayProgress(100);
      setProcessingMessage('Concluído!');
    }
  }, [processingComplete, result]);

  const handleFileSelect = useCallback((file: File) => {
    if (!user) {
      toast.error('Login necessário', {
        description: 'Faça login para processar planilhas.',
        action: {
          label: 'Entrar',
          onClick: () => navigate('/auth')
        }
      });
      return;
    }

    const fileSizeKB = file.size / 1024;
    const { allowed, reason, suggestUpgrade } = canProcessSheet(fileSizeKB);

    if (!allowed) {
      if (suggestUpgrade) {
        toast.error('Limite atingido', {
          description: reason,
          action: {
            label: 'Ver Planos',
            onClick: () => navigate('/plans')
          }
        });
      } else {
        toast.error('Erro', {
          description: reason
        });
      }
      return;
    }

    setSelectedFile(file);
    setOriginalFile(file);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setDisplayProgress(0);
    setProcessingComplete(false);
    setDownloadAllowed(false);
  }, [user, canProcessSheet, navigate]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setOriginalFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setDisplayProgress(0);
    setProcessingComplete(false);
    setDownloadAllowed(false);
  }, []);

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs(prev => {
      const newLogs = [...prev, entry];
      // Limit log entries to prevent memory growth
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return newLogs.slice(-MAX_LOG_ENTRIES);
      }
      return newLogs;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    // Guard: prevent double processing
    if (!selectedFile || !user || isProcessing || processingLockRef.current) {
      return;
    }

    const fileSizeKB = selectedFile.size / 1024;
    const { allowed, reason, suggestUpgrade } = canProcessSheet(fileSizeKB);

    if (!allowed) {
      if (suggestUpgrade) {
        toast.error('Limite atingido', {
          description: reason,
          action: {
            label: 'Ver Planos',
            onClick: () => navigate('/plans')
          }
        });
      } else {
        toast.error('Erro', {
          description: reason
        });
      }
      return;
    }

    // Set lock to prevent race conditions
    processingLockRef.current = true;
    setIsProcessing(true);
    setLogs([]);
    setProgress(0);
    setDisplayProgress(0);
    setResult(null);
    setProcessingComplete(false);
    setDownloadAllowed(false);

    try {
      const processingResult = await processExcelFile(
        selectedFile,
        handleLog,
        setProgress
      );

      // Wait for the cinematic animation to catch up
      await new Promise(resolve => setTimeout(resolve, 4500));

      setResult(processingResult);
      setProcessingComplete(true);

      if (processingResult.success && processingResult.modifiedFile) {
        if (processingResult.shouldCountUsage) {
          try {
            const usageResult = await incrementUsage();
            if (!usageResult.success) {
              logger.error('Failed to increment usage', undefined, {
                userId: user.id,
                error: usageResult.error,
              });
              toast.error('Erro crítico', {
                description: 'Não foi possível registrar o uso. Entre em contato.',
              });
              return;
            }
          } catch (usageError) {
            logger.error('Unexpected error incrementing usage', usageError, { userId: user.id });
            toast.error('Erro crítico', {
              description: 'Não foi possível registrar o uso. Entre em contato.',
            });
            return;
          }
        }

        setDownloadAllowed(true);

        // Warn if no patterns were modified
        if (processingResult.patternsModified === 0) {
          toast.warning('Processamento concluído', {
            description: 'Nenhum padrão de proteção VBA foi encontrado ou modificado no arquivo.',
            action: {
              label: 'Baixar',
              onClick: () => downloadFile(
                processingResult.modifiedFile!,
                processingResult.newFileName
              )
            }
          });
        } else {
          toast.success('Arquivo processado com sucesso!', {
            description: `${processingResult.patternsModified} padrão(ões) modificado(s)`,
            action: {
              label: 'Baixar',
              onClick: () => downloadFile(
                processingResult.modifiedFile!,
                processingResult.newFileName
              )
            }
          });
        }
      } else if (processingResult.error) {
        toast.error('Erro ao processar arquivo', {
          description: processingResult.error
        });
      }
    } catch (error) {
      logger.error('Erro inesperado durante processamento', error);
      toast.error('Erro inesperado', {
        description: 'Ocorreu um erro durante o processamento. Tente novamente.'
      });
    } finally {
      setIsProcessing(false);
      processingLockRef.current = false;
    }
  }, [selectedFile, user, isProcessing, canProcessSheet, handleLog, incrementUsage, navigate]);

  const handleDownload = useCallback(() => {
    if (result?.modifiedFile && downloadAllowed) {
      downloadFile(result.modifiedFile, result.newFileName);
      toast.success('Download iniciado!');
    }
  }, [result, downloadAllowed]);

  const handleRestore = useCallback(() => {
    if (originalFile) {
      downloadFile(originalFile, originalFile.name);
      toast.info('Arquivo original baixado');
    }
  }, [originalFile]);

  const planLimits = subscription ? PLAN_LIMITS[subscription.plan] : null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12 gap-10">
        {/* Page Header */}
        <div className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ExcelIcon className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Bloqueador de Planilhas
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Selecione um arquivo Excel (.xlsm), inicie o processamento e acompanhe o status no log.
          </p>
        </div>

        {/* Usage Info */}
        {user && subscription && (
          <Card className="border-border/50 shadow-soft">
            <CardContent className="py-4 px-5">
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
                {(() => {
                  const usageStats = getUsageStats();
                  if (usageStats && usageStats.limit !== null) {
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Uso ({usageStats.period}):</span>
                        <span className="font-semibold text-foreground">
                          {usageStats.used}/{usageStats.limit}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {planLimits && planLimits.maxFileSizeMB !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tamanho máximo:</span>
                    <span className="font-semibold text-foreground">{planLimits.maxFileSizeMB} MB</span>
                  </div>
                )}
                {subscription.plan === 'premium' && (
                  <span className="text-primary font-semibold">Uso Ilimitado</span>
                )}
                {subscription.plan !== 'premium' && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary hover:text-primary/80 font-medium"
                    onClick={() => navigate('/plans')}
                  >
                    Fazer upgrade →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Dropzone */}
        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClearFile={handleClearFile}
          disabled={isProcessing || !user}
        />

        {/* Cinematic Progress Bar */}
        {isProcessing && (
          <Card className="overflow-hidden border-border/50 shadow-soft animate-fade-in">
            <CardContent className="p-6">
              <div className="flex flex-col gap-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">{processingMessage}</span>
                  <span className="text-sm font-bold text-primary tabular-nums">{displayProgress}%</span>
                </div>
                <Progress value={displayProgress} className="h-2.5" />
                <div className="flex justify-center">
                  <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                    Processando seu arquivo...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!selectedFile || isProcessing || !user || isUpdating}
            className="w-full sm:w-auto sm:min-w-[200px] h-12 shadow-soft"
          >
            <Play className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processando...' : isUpdating ? 'Aguarde...' : 'Iniciar Processamento'}
          </Button>

          {result?.success && result.modifiedFile && processingComplete && downloadAllowed && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownload}
              className="w-full sm:w-auto sm:min-w-[200px] h-12 animate-fade-in"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Arquivo
            </Button>
          )}

          {originalFile && result && processingComplete && (
            <Button
              size="lg"
              variant="secondary"
              onClick={handleRestore}
              className="w-full sm:w-auto sm:min-w-[200px] h-12"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar Original
            </Button>
          )}
        </div>

        {/* Statistics */}
        {processingComplete && <StatisticsCard result={result} />}

        {/* Processing Log */}
        <ProcessingLog logs={logs} />

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border/50 mt-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Bloqueador de Planilhas. Todos os direitos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
