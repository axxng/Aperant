import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

export function LoginPage() {
  const { t } = useTranslation(['auth']);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('auth:welcome')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth:welcomeDescription')}</p>
        </div>
        <Button asChild className="w-full">
          <a href="/api/auth/github">{t('auth:signInWithGitHub')}</a>
        </Button>
      </div>
    </div>
  );
}
