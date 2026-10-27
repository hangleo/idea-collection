import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textFaint,
        tabBarStyle: {
          backgroundColor: t.card,
          borderTopColor: t.borderSoft,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ color, size }) => <TabIcon name="bulb-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color, size }) => <TabIcon name="mic-circle-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="write"
        options={{
          title: 'Write',
          tabBarIcon: ({ color, size }) => <TabIcon name="pencil-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="melody"
        options={{
          title: 'Melody',
          tabBarIcon: ({ color, size }) => <TabIcon name="musical-notes-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
