import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Info, Play, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { ExcelIcon } from '@/components/ExcelIcon';
import { FileDropzone } from '@/components/FileDropzone';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { NewHeader } from '@/components/NewHeader';
import { ProcessingLog } from '@/components/ProcessingLog';
import { StatisticsCard } from '@/components/StatisticsCard';

import { useAuth } from '@/hooks/useAuth';
import { PLAN_LIMITS, useSubscription } from '@/hooks/useSubscription';

import {
  downloadFile,
  LogEntry,
  processExcelFile,
  ProcessingResult,
} from '@/lib/excel-vba-modifier';
import { logger } from '@/lib/logger';

const MAX_LOG_ENTRIES = 100;

const Dashboard = () => {
  const { t } = useTranslation();
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

  const processingLockRef = useRef(false);

  const { user, loading: authLoading, authError, clearAuthError } = useAuth();
  const { subscription, canProcessSheet, incrementUsage, getUsageStats, isUpdating } = useSubscription();
  const navigate = useNavigate();

  const PROCESSING_MESSAGES = [
    t('dashboard.processingMessages.analyzing'),
    t('dashboard.processingMessages.verifying'),
    t('dashboard.processingMessages.processing'),
    t('dashboard.processingMessages.applying'),
    t('dashboard.processingMessages.finalizing'),
  ];

  useEffect(() => {
    if (authError) {
      toast.error(t('toasts.authError'), {
        description: authError,
        action: {
          label: t('toasts.signInAction'),
          onClick: () => {
            clearAuthError();
            navigate('/auth');
          },
        },
      });
    }
  }, [authError, clearAuthError, navigate, t]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!isProcessing || processingComplete) return;

    const duration = 4000;
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(Math.floor((currentStep / steps) * 95), 95);
      setDisplayProgress(newProgress);

      const messageIndex = Math.min(
        Math.floor((newProgress / 100) * PROCESSING_MESSAGES.length),
        PROCESSING_MESSAGES.length - 1,
      );
      setProcessingMessage(PROCESSING_MESSAGES[messageIndex]);

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isProcessing, processingComplete, PROCESSING_MESSAGES]);

  useEffect(() => {
    if (processingComplete && result) {
      setDisplayProgress(100);
      setProcessingMessage(t('dashboard.processingMessages.completed'));
    }
  }, [processingComplete, result, t]);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!user) {
        toast.error(t('toasts.loginRequired'), {
          description: t('toasts.loginRequiredDesc'),
          action: {
            label: t('toasts.signInAction'),
            onClick: () => navigate('/auth'),
          },
        });
        return;
      }

      const fileSizeKB = file.size / 1024;
      const { allowed, reason, suggestUpgrade } = canProcessSheet(fileSizeKB);

      if (!allowed) {
        if (suggestUpgrade) {
          toast.error(t('toasts.limitReached'), {
            description: reason,
            action: {
              label: t('toasts.viewPlans'),
              onClick: () => navigate('/plans'),
            },
          });
        } else {
          toast.error(t('common.error'), {
            description: reason,
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
    },
    [user, canProcessSheet, navigate, t],
  );

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
    setLogs((prev) => {
      const newLogs = [...prev, entry];
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return newLogs.slice(-MAX_LOG_ENTRIES);
      }
      return newLogs;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (!selectedFile || !user || isProcessing || processingLockRef.current) {
      return;
    }

    const fileSizeKB = selectedFile.size / 1024;
    const { allowed, reason, suggestUpgrade } = canProcessSheet(fileSizeKB);

    if (!allowed) {
      if (suggestUpgrade) {
        toast.error(t('toasts.limitReached'), {
          description: reason,
          action: {
            label: t('toasts.viewPlans'),
            onClick: () => navigate('/plans'),
          },
        });
      } else {
        toast.error(t('common.error'), {
          description: reason,
        });
      }
      return;
    }

    processingLockRef.current = true;
    setIsProcessing(true);
    setLogs([]);
    setProgress(0);
    setDisplayProgress(0);
    setResult(null);
    setProcessingComplete(false);
    setDownloadAllowed(false);

    try {
      const processingResult = await processExcelFile(selectedFile, handleLog, setProgress);

      await new Promise((resolve) => setTimeout(resolve, 4500));

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
              toast.error(t('toasts.criticalError'), {
                description: t('toasts.usageRegisterError'),
              });
              return;
            }
          } catch (usageError) {
            logger.error('Unexpected error incrementing usage', usageError, { userId: user.id });
            toast.error(t('toasts.criticalError'), {
              description: t('toasts.usageRegisterError'),
            });
            return;
          }
        }

        setDownloadAllowed(true);

        if (processingResult.patternsModified === 0) {
          toast.warning(t('toasts.processingComplete'), {
            description: t('toasts.noPatternModified'),
            action: {
              label: t('toasts.download'),
              onClick: () =>
                downloadFile(processingResult.modifiedFile!, processingResult.newFileName),
            },
          });
        } else {
          toast.success(t('toasts.fileProcessed'), {
            description: `${processingResult.patternsModified} ${t('toasts.patternsModified')}`,
            action: {
              label: t('toasts.download'),
              onClick: () =>
                downloadFile(processingResult.modifiedFile!, processingResult.newFileName),
            },
          });
        }
      } else if (processingResult.error) {
        toast.error(t('toasts.processingError'), {
          description: processingResult.error,
        });
      }
    } catch (error) {
      logger.error('Erro inesperado durante processamento', error);
      toast.error(t('toasts.unexpectedError'), {
        description: t('toasts.unexpectedErrorDesc'),
      });
    } finally {
      setIsProcessing(false);
      processingLockRef.current = false;
    }
  }, [selectedFile, user, isProcessing, canProcessSheet, handleLog, incrementUsage, navigate, t]);

  const handleDownload = useCallback(() => {
    if (result?.modifiedFile && downloadAllowed) {
      downloadFile(result.modifiedFile, result.newFileName);
      toast.success(t('toasts.downloadStarted'));
    }
  }, [result, downloadAllowed, t]);

  const handleRestore = useCallback(() => {
    if (originalFile) {
      downloadFile(originalFile, originalFile.name);
      toast.info(t('toasts.originalDownloaded'));
    }
  }, [originalFile, t]);

  const planLimits = subscription ? PLAN_LIMITS[subscription.plan] : null;
  const usageStats = getUsageStats();
  const usagePercentage = usageStats?.limit
    ? Math.min((usageStats.used / usageStats.limit) * 100, 100)
    : 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <NewHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <LoadingSkeleton variant="dashboard" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <NewHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ExcelIcon className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t('dashboard.title')}
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {user && subscription && (
          <Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                {t('dashboard.usageInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageStats && usageStats.limit !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('dashboard.usage')} {usageStats.period}</span>
                    <span className="font-medium">
                      {usageStats.used} / {usageStats.limit}
                    </span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {planLimits && planLimits.maxFileSizeMB !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('dashboard.maxSize')}:</span>
                    <span className="font-semibold text-foreground">{planLimits.maxFileSizeMB} MB</span>
                  </div>
                )}
                {subscription.plan === 'premium' && (
                  <span className="text-primary font-semibold">{t('dashboard.unlimitedUsage')}</span>
                )}
                {subscription.plan !== 'premium' && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary hover:text-primary/80 font-medium"
                    onClick={() => navigate('/plans')}
                  >
                    {t('dashboard.upgrade')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClearFile={handleClearFile}
          disabled={isProcessing || !user}
        />

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
                    {t('dashboard.processingFile')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!selectedFile || isProcessing || !user || isUpdating}
            className="w-full sm:w-auto sm:min-w-[200px] h-12 shadow-soft"
          >
            <Play className="w-4 h-4 mr-2" />
            {isProcessing ? t('common.processing') : isUpdating ? t('common.wait') : t('dashboard.startProcessing')}
          </Button>

          {result?.success && result.modifiedFile && processingComplete && downloadAllowed && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownload}
              className="w-full sm:w-auto sm:min-w-[200px] h-12 animate-fade-in"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('dashboard.downloadFile')}
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
              {t('dashboard.restoreOriginal')}
            </Button>
          )}
        </div>

        {processingComplete && (
          <div className="animate-fade-in">
            <StatisticsCard result={result} />
          </div>
        )}

        <ProcessingLog logs={logs} />

        <footer className="text-center py-8 border-t border-border/50 mt-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t('dashboard.title')}. {t('common.allRightsReserved')}.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
