import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch, Linking, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '../../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme, useTheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ACCOUNTS_KEY = '@memora/saved-account-emails';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ totalMemories: 0, pendingApproval: 0, published: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const darkModeEnabled = theme === 'dark';

  useEffect(() => {
    if (isFocused) {
      fetchUserData();
    }
  }, [isFocused]);

  async function fetchUserData() {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Get stats for current user only
      if (user) {
        const { data: userStories } = await supabase
          .from('stories')
          .select('status')
          .eq('author_id', user.id);
        
        if (userStories) {
          setStats({
            totalMemories: userStories.length,
            pendingApproval: userStories.filter(s => s.status === 'pending').length,
            published: userStories.filter(s => s.status === 'approved').length,
          });
        }
      } else {
        // User not authenticated - reset stats
        setStats({ totalMemories: 0, pendingApproval: 0, published: 0 });
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            router.replace('/signin');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleSwitchAccount = async () => {
    Alert.alert('Switch Account', 'Do you want to sign out and switch accounts?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Continue',
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              const storedAccounts = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
              const savedAccounts: Array<{ email: string; avatarUrl: string | null; session?: object }> = storedAccounts
                ? JSON.parse(storedAccounts)
                : [];
              const normalizedEmail = user.email.trim().toLowerCase();
              const currentAccount = {
                email: normalizedEmail,
                avatarUrl: user.user_metadata?.avatar_url || null,
                session: (await supabase.auth.getSession()).data.session,
              };
              const nextAccounts = [
                currentAccount,
                ...savedAccounts.filter(account => (typeof account === 'string' ? account : account.email) !== normalizedEmail),
              ].slice(0, 5);
              await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
            }
            router.replace('/switch-account');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleNotificationsToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    Alert.alert('Notifications', value ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleDarkModeToggle = async (value: boolean) => {
    await setTheme(value ? 'dark' : 'light');
    Alert.alert('Theme', value ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'Choose an option:',
      [
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@memora.com?subject=Help with Memora') },
        { text: 'FAQ', onPress: () => Linking.openURL('https://memora.com/faq') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const colors = Colors[colorScheme ?? 'light'];

  return (
    <LinearGradient
      colors={colorScheme === 'dark'
        ? ['#0f172a', '#111827', '#0f172a']
        : colorScheme === 'system'
        ? ['#fef3c7', '#fef08a', '#fef3c7']
        : ['#f0f9ff', '#e0f2fe', '#f3f4f6']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.borderColor }]}>
        <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
          {user?.user_metadata?.avatar_url ? (
            <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.avatarImage} />
          ) : (
            <FontAwesome name="user" size={40} color="#fff" />
          )}
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>
          {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User'}
        </Text>
        <Text style={[styles.userEmail, { color: colors.text, opacity: 0.7, alignSelf: 'center' }]}> 
          Eranians Archive Member
        </Text>
      </View>
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <Text style={[styles.statNumber, { color: colors.tint }]}>{stats.totalMemories}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Total Memories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <Text style={[styles.statNumber, { color: colors.accent }]}>{stats.pendingApproval}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{stats.published}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Published</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <View style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <FontAwesome name="bell" size={20} color={colors.tint} />
          <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: colors.borderColor, true: colors.tint }}
            thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity 
          onPress={() => router.push('/edit-profile')}
          style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <FontAwesome name="edit" size={20} color={colors.tint} />
          <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
          <FontAwesome name="chevron-right" size={16} color={colors.borderColor} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/settings')}
          style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <FontAwesome name="cog" size={20} color={colors.tint} />
          <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
          <FontAwesome name="chevron-right" size={16} color={colors.borderColor} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleHelpSupport}
          style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          <FontAwesome name="question-circle" size={20} color={colors.tint} />
          <Text style={[styles.menuText, { color: colors.text }]}>Help & Support</Text>
          <FontAwesome name="chevron-right" size={16} color={colors.borderColor} />
        </TouchableOpacity>

        <TouchableOpacity           onPress={handleSwitchAccount}
          style={[styles.menuItem, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}> 
          <FontAwesome name="exchange" size={20} color="#4338ca" />
          <Text style={[styles.menuText, { color: '#4338ca' }]}>Switch Account</Text>
          <FontAwesome name="chevron-right" size={16} color="#c7d2fe" />
        </TouchableOpacity>

        <TouchableOpacity           onPress={handleLogout}
          style={[styles.menuItem, styles.logoutItem, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
          <FontAwesome name="sign-out" size={20} color="#dc2626" />
          <Text style={[styles.menuText, { color: '#dc2626' }]}>Logout</Text>
          <FontAwesome name="chevron-right" size={16} color="#fecaca" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text, opacity: 0.5 }]}>
          Memora v1.0
        </Text>
      </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 32,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuSection: {
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutItem: {
    marginTop: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 14,
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
