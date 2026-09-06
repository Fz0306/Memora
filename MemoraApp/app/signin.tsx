import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

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
          router.replace('/(tabs)');
          return;
        }

        setMessage('Account created. Check your email and confirm your address before signing in.');
        setAwaitingConfirmation(true);
        setIsRegister(false);
        return;
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

            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
              placeholder="Enter password"
              placeholderTextColor={colors.text + '80'}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  yellowBackground: { backgroundColor: '#ffffff' },
  gradient: { ...StyleSheet.absoluteFillObject },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  card: { borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginHorizontal: 4 },
  tabActive: { backgroundColor: '#111827' },
  tabInactive: { backgroundColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700' },
  form: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16 },
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