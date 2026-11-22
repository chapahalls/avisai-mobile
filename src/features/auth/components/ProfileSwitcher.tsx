import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hapticTap } from '../../../utils/haptics';
import { useSession } from '../hooks/useSession';
import type { LoginProfileOption } from '../types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'MD';
  if (parts.length === 1) return (parts[0] ?? 'MD').slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function ProfileSwitcher() {
  const { t } = useTranslation();
  const profiles = useSession((s) => s.profiles);
  const selectedEmail = useSession((s) => s.selectedEmail);
  const selectProfile = useSession((s) => s.selectProfile);
  const loadProfiles = useSession((s) => s.loadProfiles);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleSelect = (profile: LoginProfileOption) => {
    hapticTap();
    selectProfile(profile.email);
  };

  return (
    <View className="mb-3" accessibilityRole="radiogroup">
      <Text className="text-ink-300 text-xs font-semibold mb-2">
        {t('auth.profileSwitcher.title')}
      </Text>

      <View className="gap-2">
        {profiles.slice(0, 3).map((profile) => {
          const selected = profile.email.toLowerCase() === selectedEmail.toLowerCase();
          const initials = getInitials(profile.name);
          const tripLabel = profile.tripId
            ? t('auth.profileSwitcher.tripTag', { id: profile.tripId })
            : t('auth.profileSwitcher.noTrip');
          const routeLine = [profile.plate, profile.routeSummary].filter(Boolean).join(' · ');

          return (
            <Pressable
              key={profile.email}
              onPress={() => handleSelect(profile)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${profile.name}, ${routeLine || tripLabel}, ${profile.email}`}
              className={`flex-row items-center gap-2.5 rounded-xl px-3 py-2.5 border active:opacity-85 ${
                selected
                  ? 'bg-brand-500/15 border-brand-500'
                  : 'bg-ink-950/80 border-ink-700/80'
              }`}
            >
              {/* Avatar com iniciais */}
              <View
                className={`w-9 h-9 rounded-full border items-center justify-center ${
                  selected
                    ? 'bg-brand-500/20 border-brand-500'
                    : 'bg-ink-800 border-ink-700'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selected ? 'text-brand-500' : 'text-ink-300'
                  }`}
                >
                  {initials}
                </Text>
              </View>

              {/* Nome, rota/placa e e-mail */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    numberOfLines={1}
                    className="text-ink-50 text-sm font-bold flex-1"
                  >
                    {profile.name}
                  </Text>

                  {selected ? (
                    <View className="bg-brand-500/20 border border-brand-500/60 rounded-full px-2 py-0.5">
                      <Text className="text-brand-50 text-[10px] font-bold">
                        {t('auth.profileSwitcher.selectedBadge')}
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-ink-800 border border-ink-700 rounded-full px-2 py-0.5">
                      <Text className="text-ink-300 text-[10px] font-semibold">
                        {tripLabel}
                      </Text>
                    </View>
                  )}
                </View>

                {routeLine ? (
                  <Text numberOfLines={1} className="text-ink-300 text-xs mt-0.5">
                    {routeLine}
                  </Text>
                ) : null}

                <View className="flex-row items-center justify-between mt-0.5">
                  <Text
                    numberOfLines={1}
                    className="text-ink-300/80 text-[11px] font-mono"
                  >
                    {profile.email}
                  </Text>
                  {selected ? (
                    <Text className="text-brand-500 text-[10px] font-semibold">
                      {tripLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
