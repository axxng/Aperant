import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth-store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function LoginPage() {
  const { t } = useTranslation(['auth']);
  const { requestOtp, verifyOtp, isLoading, error } = useAuthStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'otp') {
      codeInputRef.current?.focus();
    }
  }, [step]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await requestOtp(email.trim());
    if (ok) {
      setStep('otp');
      setCode('');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    await verifyOtp(email.trim(), code);
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    useAuthStore.getState().setError(null);
  };

  const errorMessage = error ? t(`auth:${error}`, { defaultValue: error }) : null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('auth:welcome')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth:welcomeDescription')}</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth:email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth:emailPlaceholder')}
                autoFocus
                autoComplete="email"
                required
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
              {isLoading ? '...' : t('auth:sendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{t('auth:codeSent')}</p>
            <p className="text-sm font-medium text-center">{email}</p>
            <div className="space-y-1.5">
              <Input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('auth:codePlaceholder')}
                className="text-center text-lg tracking-widest"
                autoComplete="one-time-code"
                required
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
              {isLoading ? '...' : t('auth:verifyCode')}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleBack}>
              {t('auth:backToEmail')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
