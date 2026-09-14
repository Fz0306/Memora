import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/constants/SupabaseConfig';

const SAVED_ACCOUNTS_KEY = '@memora/saved-account-emails';

type SavedAccount = {
  email: string;
  avatarUrl: string | null;
  session?: {
    access_token: string;
    refresh_token: string;
  } | null;
};

export default function SwitchAccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_ACCOUNTS_KEY)
      .then(value => {
        if (!value) return;

        const storedAccounts = JSON.parse(value);
        if (!Array.isArray(storedAccounts)) return;

        const normalizedAccounts = storedAccounts
          .map(account => typeof account === 'string'
            ? { email: account, avatarUrl: null }
            : { email: account.email, avatarUrl: account.avatarUrl || null, session: account.session || null })
          .filter(account => typeof account.email === 'string' && account.email.length > 0);

        setAccounts(normalizedAccounts);
      })
      .catch(error => console.warn('Unable to load saved accounts:', error));
  }, []);

  const selectAccount = async (account: SavedAccount) => {
    if (!account.session?.access_token || !account.session.refresh_token) {
      router.push({ pathname: '/signin', params: { email: account.email } });
      return;
    }

    try {
      const { error } = await supabase.auth.setSession(account.session);
      if (error) throw error;
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Sign in required', 'This saved session has expired. Please sign in again.', [
        { text: 'Sign in', onPress: () => router.push({ pathname: '/signin', params: { email: account.email } }) },
      ]);
    }
  };

  const handleAnotherAccount = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      router.replace('/signin');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to open the login page.');
    }
  };

  const removeSavedAccount = (accountEmail: string) => {
    Alert.alert('Remove saved account', `Remove ${accountEmail} from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const nextAccounts = accounts.filter(account => account.email !== accountEmail);
          setAccounts(nextAccounts);
          await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
        },
      },
    ]);
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0f172a', '#111827', '#0f172a'] : ['#ffffff', '#fffde7', '#fff9c4']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={17} color={colors.text} />
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>

            <View style={styles.brandBlock}>
              <Image
                source={require('../assets/images/MemoraLogoNB.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={[styles.title, { color: colors.text }]}>Switch account</Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>Choose an account saved on this device.</Text>
            </View>

            <View style={styles.accountList}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Saved accounts</Text>
                {accounts.length > 0 ? (
                  <Text style={[styles.accountCount, { color: colors.text }]}>{accounts.length} saved</Text>
                ) : null}
              </View>
              {accounts.map(account => (
                <TouchableOpacity
                  key={account.email}
                  activeOpacity={0.78}
                  onPress={() => selectAccount(account)}
                  style={[styles.accountCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}
                >
                  {account.avatarUrl ? (
                    <Image source={{ uri: account.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.tint }]}>
                      <FontAwesome name="user" size={21} color="#fff" />
                    </View>
                  )}
                  <View style={styles.accountDetails}>
                    <Text style={[styles.accountName, { color: colors.text }]}>Memora account</Text>
                    <Text style={[styles.email, { color: colors.text }]} numberOfLines={1}>{account.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeSavedAccount(account.email)} hitSlop={8} style={styles.removeAccountButton}>
                    <FontAwesome name="trash-o" size={15} color={colors.tint} />
                  </TouchableOpacity>
                  <View style={[styles.chevron, { backgroundColor: colors.background }]}>
                    <FontAwesome name="chevron-right" size={13} color={colors.tint} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {accounts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text }]}>No saved accounts yet.</Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={handleAnotherAccount}
              style={[styles.anotherAccountButton, { backgroundColor: colors.cardBg, borderColor: colors.tint }]}
            >
              <FontAwesome name="plus" size={15} color={colors.tint} />
              <Text style={[styles.anotherAccountText, { color: colors.tint }]}>Add another account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 18 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 22 },
  backText: { fontSize: 15, fontWeight: '600' },
  brandBlock: { alignItems: 'center', marginBottom: 34 },
  logo: { width: 104, height: 104, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: 0, marginBottom: 8, textAlign: 'center' },
  subtitle: { maxWidth: 280, fontSize: 15, lineHeight: 21, opacity: 0.7, textAlign: 'center' },
  accountList: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', opacity: 0.7 },
  accountCount: { fontSize: 12, opacity: 0.55 },
  accountCard: { flexDirection: 'row', alignItems: 'center', minHeight: 76, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 13 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  accountDetails: { flex: 1, gap: 3 },
  accountName: { fontSize: 12, fontWeight: '700', opacity: 0.55 },
  email: { fontSize: 15, fontWeight: '600' },
  chevron: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginLeft: 10 },
  removeAccountButton: { padding: 6, marginLeft: 4 },
  emptyText: { fontSize: 15, opacity: 0.7, marginTop: 14 },
  anotherAccountButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 28 },
  anotherAccountText: { fontSize: 15, fontWeight: '700' },
});
