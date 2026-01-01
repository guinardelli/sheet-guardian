import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, ShieldCheck, ShieldOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/services/supabase/client';
import { toast } from 'sonner';

type TotpEnrollment = {
  id: string;
  totp: {
    qr_code: string;
    secret: string;
  };
  friendly_name?: string;
};

type Mode = 'idle' | 'setup' | 'disable';

export const MFASetup = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);

  const qrCodeUrl = useMemo(() => {
    if (!enrollment?.totp?.qr_code) {
      return null;
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(enrollment.totp.qr_code)}`;
  }, [enrollment]);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(t('account.mfa.errors.load'));
      setLoading(false);
      return;
    }
    const verified = data?.totp?.[0] ?? null;
    setFactorId(verified?.id ?? null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const handleStartEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: t('account.mfa.defaultName'),
    });

    if (error || !data) {
      toast.error(t('account.mfa.errors.enroll'), { description: error?.message });
      setBusy(false);
      return;
    }

    setEnrollment(data);
    setMode('setup');
    setBusy(false);
  };

  const handleVerifyEnroll = async () => {
    if (!enrollment) {
      return;
    }
    const trimmed = code.replace(/\s+/g, '');
    if (trimmed.length < 6) {
      toast.error(t('account.mfa.errors.invalidCode'));
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code: trimmed,
    });

    if (error || !data) {
      toast.error(t('account.mfa.errors.verify'), { description: error?.message });
      setBusy(false);
      return;
    }

    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    toast.success(t('account.mfa.enabled'));
    setEnrollment(null);
    setMode('idle');
    setCode('');
    await loadFactors();
    setBusy(false);
  };

  const handleCancelEnroll = async () => {
    if (!enrollment) {
      setMode('idle');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
    if (error) {
      toast.error(t('account.mfa.errors.disable'), { description: error.message });
    }
    setEnrollment(null);
    setMode('idle');
    setCode('');
    setBusy(false);
  };

  const handleDisable = async () => {
    if (!factorId) {
      return;
    }
    const trimmed = code.replace(/\s+/g, '');
    if (trimmed.length < 6) {
      toast.error(t('account.mfa.errors.invalidCode'));
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: trimmed,
    });

    if (error || !data) {
      toast.error(t('account.mfa.errors.verify'), { description: error?.message });
      setBusy(false);
      return;
    }

    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      toast.error(t('account.mfa.errors.disable'), { description: unenrollError.message });
      setBusy(false);
      return;
    }

    toast.success(t('account.mfa.disabled'));
    setMode('idle');
    setCode('');
    await loadFactors();
    setBusy(false);
  };

  return (
    <Card className="border-border/50 shadow-soft bg-gradient-to-br from-background to-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t('account.mfa.title')}
        </CardTitle>
        <CardDescription>{t('account.mfa.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('account.mfa.loading')}</p>
        ) : factorId ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t('account.mfa.statusEnabled')}
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <ShieldOff className="h-4 w-4" />
            {t('account.mfa.statusDisabled')}
          </div>
        )}

        {mode === 'setup' && enrollment ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('account.mfa.setupIntro')}</p>
              {qrCodeUrl && (
                <div className="flex justify-center rounded-lg border border-border/60 bg-background p-3">
                  <img src={qrCodeUrl} alt={t('account.mfa.qrAlt')} className="h-40 w-40" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mfa-secret" className="text-xs text-muted-foreground">
                  {t('account.mfa.secretLabel')}
                </Label>
                <Input id="mfa-secret" readOnly value={enrollment.totp.secret} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfa-code">{t('account.mfa.codeLabel')}</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleVerifyEnroll} disabled={busy}>
                {busy ? t('account.mfa.verifying') : t('account.mfa.enable')}
              </Button>
              <Button variant="ghost" onClick={handleCancelEnroll} disabled={busy}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : mode === 'disable' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('account.mfa.disablePrompt')}</p>
            <div className="space-y-2">
              <Label htmlFor="mfa-disable-code">{t('account.mfa.codeLabel')}</Label>
              <Input
                id="mfa-disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="destructive" onClick={handleDisable} disabled={busy}>
                {busy ? t('account.mfa.verifying') : t('account.mfa.disable')}
              </Button>
              <Button variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            {factorId ? (
              <Button variant="outline" onClick={() => setMode('disable')}>
                <ShieldOff className="h-4 w-4 mr-2" />
                {t('account.mfa.disable')}
              </Button>
            ) : (
              <Button onClick={handleStartEnroll} disabled={busy}>
                <QrCode className="h-4 w-4 mr-2" />
                {busy ? t('account.mfa.preparing') : t('account.mfa.enable')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

