import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Image, Pressable, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      
      {/* Tab One: Home/Feed */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Memora',
          headerLeft: () => (
            <View style={{ marginLeft: 15, flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={require('../../assets/images/MemoraLogoNB.png')}
                style={{ width: 28, height: 28, marginRight: 8 }}
              />
            </View>
          ),
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />

      {/* Tab Two: Existing Tab */}
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />

      {/* NEW Tab: Add Memory Archive */}
      <Tabs.Screen
        name="add-memory"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color }) => <FontAwesome name="plus-square" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}