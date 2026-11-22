import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button';
import { useSession } from '../hooks/useSession';

export function SsoButton() {
  const { t } = useTranslation();
  const { login, loading } = useSession();
  return <Button label={loading ? t('auth.loading') : t('auth.sso')} onPress={login} disabled={loading} />;
}
