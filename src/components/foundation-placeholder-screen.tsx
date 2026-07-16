import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';

type FoundationPlaceholderScreenProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

export function FoundationPlaceholderScreen({
  icon,
  title,
  description,
}: FoundationPlaceholderScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.screen }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            padding: 24,
          }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.primarySoft,
              borderRadius: 18,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}>
            <Ionicons name={icon} size={34} color={theme.colors.primary} />
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 24,
              fontWeight: '900',
              marginTop: 18,
              textAlign: 'center',
            }}>
            {title}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              textAlign: 'center',
            }}>
            {description}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
