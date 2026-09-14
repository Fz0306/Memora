import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, Animated, Easing, ScrollView, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const SAVED_ACCOUNTS_KEY = '@memora/saved-account-emails';

type SavedAccount = {
  email: string;
  avatarUrl: string | null;
};

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { email: selectedEmail } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedEmail) setEmail(selectedEmail);
  }, [selectedEmail]);

  useEffect(() => {
    if (!selectedEmail) return;
    const matchingAccount = savedAccounts.find(account => account.email === selectedEmail);
    if (matchingAccount) setSelectedAccount(matchingAccount);
  }, [savedAccounts, selectedEmail]);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_ACCOUNTS_KEY)
      .then(value => {
        if (!value) return;
        const storedAccounts = JSON.parse(value);
        if (!Array.isArray(storedAccounts)) return;

        setSavedAccounts(
          storedAccounts
            .map(account => typeof account === 'string'
              ? { email: account, avatarUrl: null }
              : { email: account.email, avatarUrl: account.avatarUrl || null })
            .filter(account => typeof account.email === 'string' && account.email.length > 0),
        );
      })
      .catch(error => console.warn('Unable to load saved accounts:', error));
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animation]);

  const animatedLogoStyle = {
    transform: [
      {
        rotate: animation.interpolate({
          inputRange: [0, 1],
          outputRange: ['-2deg', '2deg'],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.98, 1.04, 0.98],
        }),
      },
    ],
  };

  const gradientColors: [string, string, string] = colorScheme === 'dark'
    ? ['#0f172a', '#111827', '#0f172a']
    : ['#ffffff', '#fffde7', '#fff9c4'];

  const activeTabBackground = colorScheme === 'dark' ? '#1f2937' : '#111827';

  const handleAuth = async () => {
    if (!email || !password) {
      setMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setMessage('');
    setAwaitingConfirmation(false);

    try {
      const authResult = isRegister
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      const { error, data } = authResult;
      if (error) throw error;

      if (isRegister) {
        if (data?.session) {
          if (rememberMe) {
            await rememberAccount(email, data.user?.user_metadata?.avatar_url || null, data.session);
          }
          router.replace('/(tabs)');
          return;
        }

        setMessage('Account created. Check your email and confirm your address before signing in.');
        setAwaitingConfirmation(true);
        setIsRegister(false);
        return;
      }

      if (rememberMe) {
        await rememberAccount(email, data.user?.user_metadata?.avatar_url || null, data.session);
      } else {
        await forgetSavedAccount(email);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message?.toLowerCase().includes('confirm')) {
        setMessage('Your email is not confirmed yet. Please open the confirmation email and click the link.');
      } else {
        setMessage(err.message || 'Unable to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  const rememberAccount = async (accountEmail: string, avatarUrl: string | null, session: Session | null) => {
    const normalizedEmail = accountEmail.trim().toLowerCase();
    const storedAccounts = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
    const savedAccounts: Array<{ email: string; avatarUrl: string | null }> = storedAccounts
      ? JSON.parse(storedAccounts)
      : [];
    const nextAccounts = [
      { email: normalizedEmail, avatarUrl, session },
      ...savedAccounts.filter(account => (typeof account === 'string' ? account : account.email) !== normalizedEmail),
    ].slice(0, 5);

    await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  };

  const removeSavedAccount = (accountEmail: string) => {
    Alert.alert('Remove saved account', `Remove ${accountEmail} from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const nextAccounts = savedAccounts.filter(account => account.email !== accountEmail);
          setSavedAccounts(nextAccounts);
          await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
        },
      },
    ]);
  };

  const forgetSavedAccount = async (accountEmail: string) => {
    const nextAccounts = savedAccounts.filter(account => account.email !== accountEmail);
    setSavedAccounts(nextAccounts);
    await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  };

  const handlePasswordRecovery = async () => {
    router.push('/forgot-password');
  };

  const toggleMode = () => {
    setMessage('');
    setIsRegister(current => !current);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <Animated.Image
            source={require('../assets/images/MemoraLogoNB.png')}
            style={[styles.logo, animatedLogoStyle as any]}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Memora</Text>
        <Text style={[styles.subtitle, { color: colors.text, opacity: 0.75 }]}>Dedicated digital preservation and documentation app designed exclusively for the New Era University.</Text>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>          
          <View style={styles.row}>            
            <TouchableOpacity
              style={[
                styles.tabButton,
                { borderColor: colors.borderColor, backgroundColor: !isRegister ? activeTabBackground : 'transparent' },
              ]}
              onPress={() => setIsRegister(false)}
            >
              <Text style={[styles.tabText, { color: !isRegister ? '#fff' : colors.text }]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                { borderColor: colors.borderColor, backgroundColor: isRegister ? activeTabBackground : 'transparent' },
              ]}
              onPress={() => setIsRegister(true)}
            >
              <Text style={[styles.tabText, { color: isRegister ? '#fff' : colors.text }]}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {selectedAccount && !isRegister ? (
              <View style={[styles.selectedAccount, { backgroundColor: colors.background, borderColor: colors.borderColor }]}>
                {selectedAccount.avatarUrl ? (
                  <Image source={{ uri: selectedAccount.avatarUrl }} style={styles.selectedAccountAvatar} />
                ) : (
                  <View style={[styles.selectedAccountAvatar, styles.selectedAccountAvatarFallback, { backgroundColor: colors.tint }]}>
                    <Text style={styles.selectedAccountAvatarText}>{selectedAccount.email.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.selectedAccountDetails}>
                  <Text style={[styles.selectedAccountLabel, { color: colors.text }]}>Continue as</Text>
                  <Text style={[styles.selectedAccountEmail, { color: colors.text }]} numberOfLines={1}>{selectedAccount.email}</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelectedAccount(null); setEmail(''); setPassword(''); }}>
                  <Text style={[styles.changeAccountText, { color: colors.tint }]}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text + '80'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </>
            )}

            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
              placeholder="Enter password"
              placeholderTextColor={colors.text + '80'}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {!isRegister ? (
              <View style={styles.rememberRow}>
                <View style={styles.rememberLabelGroup}>
                  <Text style={[styles.rememberLabel, { color: colors.text }]}>Remember me</Text>
                  <Text style={[styles.rememberHint, { color: colors.text }]}>Save this account on this device</Text>
                </View>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: colors.borderColor, true: colors.tint }}
                  thumbColor="#fff"
                />
              </View>
            ) : null}
          </View>

          {message ? <Text style={[styles.message, { color: colors.tint }]}>{message}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#fff59d', opacity: loading ? 0.7 : 1, borderWidth: 1, borderColor: '#facc15' }]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: '#1f2937' }]}>{isRegister ? 'Create account' : 'Login'}</Text>
          </TouchableOpacity>

          {!isRegister ? (
            <TouchableOpacity onPress={handlePasswordRecovery} style={styles.recoveryButton}>
              <Text style={[styles.footerLink, { color: colors.tint }]}>Forgot password?</Text>
            </TouchableOpacity>
          ) : null}

          {awaitingConfirmation ? (
            <Text style={[styles.confirmationText, { color: colors.tint }]}>We sent a confirmation email. Please verify your address before logging in.</Text>
          ) : null}

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.text, opacity: 0.8 }]}>Need help with your account?</Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text style={[styles.footerLink, { color: isRegister ? colors.tint : '#C0B66D' }]}> {isRegister ? 'Sign in instead' : 'Create one'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isRegister && !selectedAccount && savedAccounts.length > 0 ? (
          <View style={styles.savedAccountsBlock}>
            <View style={styles.savedAccountsHeader}>
              <Text style={[styles.savedAccountsLabel, { color: colors.text }]}>Saved accounts</Text>
              <Text style={[styles.savedAccountsHint, { color: colors.text }]}>Password required</Text>
            </View>
            <View style={styles.savedAccountsList}>
              {savedAccounts.map(account => (
                <TouchableOpacity
                  key={account.email}
                  activeOpacity={0.78}
                  onPress={() => {
                        setSelectedAccount(account);
                    setEmail(account.email);
                    setPassword('');
                    setMessage('');
                  }}
                  style={[styles.savedAccountRow, { borderColor: colors.borderColor }]}
                >
                  {account.avatarUrl ? (
                    <Image source={{ uri: account.avatarUrl }} style={styles.savedAccountAvatar} />
                  ) : (
                    <View style={[styles.savedAccountAvatar, styles.savedAccountAvatarFallback, { backgroundColor: colors.tint }]}>
                      <Text style={styles.savedAccountAvatarText}>{account.email.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.savedAccountEmail, { color: colors.text }]} numberOfLines={1}>{account.email}</Text>
                      <TouchableOpacity onPress={() => removeSavedAccount(account.email)} hitSlop={8} style={styles.removeSavedAccountButton}>
                        <FontAwesome name="trash-o" size={15} color={colors.tint} />
                      </TouchableOpacity>
                  <FontAwesome name="chevron-right" size={12} color={colors.borderColor} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  yellowBackground: { backgroundColor: '#ffffff' },
  gradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  inner: { width: '100%', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  card: { borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginHorizontal: 4 },
  tabActive: { backgroundColor: '#111827' },
  tabInactive: { backgroundColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700' },
  form: { marginBottom: 16 },
  selectedAccount: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 16 },
  selectedAccountAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 11 },
  selectedAccountAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  selectedAccountAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  selectedAccountDetails: { flex: 1, gap: 3 },
  selectedAccountLabel: { fontSize: 11, opacity: 0.55, fontWeight: '700' },
  selectedAccountEmail: { fontSize: 14, fontWeight: '700' },
  changeAccountText: { fontSize: 12, fontWeight: '700', padding: 5 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4, marginBottom: 4 },
  rememberLabelGroup: { flex: 1, marginRight: 12 },
  rememberLabel: { fontSize: 14, fontWeight: '700' },
  rememberHint: { fontSize: 11, opacity: 0.55, marginTop: 2 },
  savedAccountsBlock: { marginTop: 16, marginBottom: 14, paddingHorizontal: 4 },
  savedAccountsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  savedAccountsLabel: { fontSize: 12, fontWeight: '700', opacity: 0.7 },
  savedAccountsHint: { fontSize: 11, opacity: 0.5 },
  savedAccountsList: { gap: 6 },
  savedAccountRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10 },
  savedAccountAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 9 },
  savedAccountAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  savedAccountAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  savedAccountEmail: { flex: 1, fontSize: 13, fontWeight: '600' },
  removeSavedAccountButton: { padding: 6, marginLeft: 4 },
  message: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  confirmationText: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  button: { borderRadius: 16, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  recoveryButton: { alignItems: 'center', marginTop: 14 },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 160,
    height: 160,
    backgroundColor: 'transparent',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});