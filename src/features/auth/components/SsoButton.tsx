import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../../../components/Button';
import { useSession } from '../hooks/useSession';

export function SsoButton() {
  const { t } = useTranslation();
  const login = useSession((s) => s.login);
  const loading = useSession((s) => s.loading);
  const profiles = useSession((s) => s.profiles);
  const selectedEmail = useSession((s) => s.selectedEmail);

  const selectedProfile =
    profiles.find((p) => p.email.toLowerCase() === selectedEmail.toLowerCase()) ?? profiles[0];
  const firstName = selectedProfile?.name?.trim().split(/\s+/)[0];
  const ctaLabel = firstName ? t('auth.ssoAs', { name: firstName }) : t('auth.sso');

  return (
    <Button
      label={loading ? t('auth.loading') : ctaLabel}
      onPress={() => {
        void login();
      }}
      disabled={loading}
      icon={
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
            stroke="#F4F6FA"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      }
    />
  );
}
