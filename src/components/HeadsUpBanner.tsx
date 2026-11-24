import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { create } from 'zustand';
import { newId } from '../lib/id';
import { hapticAlert } from '../utils/haptics';
import { colors } from '../lib/theme';

export type HeadsUpTone = 'brand' | 'ok' | 'wait' | 'alert';

export interface HeadsUpItem {
  id: string;
  title: string;
  message: string;
  tone: HeadsUpTone;
}

interface HeadsUpBannerState {
  banner: HeadsUpItem | null;
  show: (item: Omit<HeadsUpItem, 'id'>) => void;
  clear: () => void;
}

let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

export const useHeadsUpBanner = create<HeadsUpBannerState>((set) => ({
  banner: null,
  show: (item) => {
    clearAutoHide();
    hapticAlert();
    const next: HeadsUpItem = { id: newId(), ...item };
    set({ banner: next });
    if (!process.env.VITEST) {
      autoHideTimer = setTimeout(() => {
        autoHideTimer = null;
        set({ banner: null });
      }, 6000);
    }
  },
  clear: () => {
    clearAutoHide();
    set({ banner: null });
  },
}));

const containerStyles: Record<HeadsUpTone, string> = {
  brand: 'bg-brand-500/20 border-b border-brand-500/70',
  ok: 'bg-ok-500/20 border-b border-ok-500/70',
  wait: 'bg-wait-500/20 border-b border-wait-500/70',
  alert: 'bg-alert-500/20 border-b border-alert-500/70',
};

const titleStyles: Record<HeadsUpTone, string> = {
  brand: 'text-brand-300',
  ok: 'text-ok-500',
  wait: 'text-wait-500',
  alert: 'text-alert-500',
};

const iconColors: Record<HeadsUpTone, string> = {
  brand: colors.brand[300],
  ok: colors.ok[500],
  wait: colors.wait[500],
  alert: colors.alert[500],
};

function navigateToTrip(): void {
  if (process.env.VITEST) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { navigationRef } = require('../app/navigation') as typeof import('../app/navigation');
    if (navigationRef?.isReady()) {
      navigationRef.navigate('Main', { screen: 'Trip' });
    }
  } catch {
    // Ignora caso navegação ainda não esteja pronta
  }
}

/**
 * Banner heads-up estilo notificação push no topo de todas as telas (C5):
 * Exibe alertas críticos em tempo real (resposta do recebedor, pergunta do CCO, nova rota ou divergência de GPS).
 */
export function HeadsUpBanner() {
  const banner = useHeadsUpBanner((s) => s.banner);
  const clear = useHeadsUpBanner((s) => s.clear);

  if (!banner) return null;

  const stroke = iconColors[banner.tone];

  return (
    <Pressable
      onPress={() => {
        clear();
        navigateToTrip();
      }}
      accessibilityRole="alert"
      className={`px-4 py-2.5 flex-row items-center justify-between ${containerStyles[banner.tone]}`}
    >
      <View className="flex-row items-center gap-2.5 flex-1 pr-2">
        <View className="w-7 h-7 rounded-full bg-ink-950/70 border border-ink-700 items-center justify-center">
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2.2} />
            <Path
              d="M12 8v4.5M12 16h.01"
              stroke={stroke}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className={`text-xs font-bold ${titleStyles[banner.tone]}`}>
            {banner.title}
          </Text>
          <Text numberOfLines={2} className="text-ink-50 text-xs font-medium mt-0.5">
            {banner.message}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
