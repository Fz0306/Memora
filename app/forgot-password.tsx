import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const gradientColors: [string, string, string] = colorScheme === 'dark'
    ? ['#0f172a', '#111827', '#0f172a']
    : ['#ffffff', '#fffde7', '#fff9c4'];

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    if (!email.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'memoryarchiveapp://reset-password',
      });

      if (error) throw error;

      setMessage('Password recovery email sent successfully!');
      setSent(true);
      setEmail('');

      setTimeout(() => {
        router.replace('/signin');
      }, 3000);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setMessage(err.message || 'Unable to send password recovery email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    router.replace('/signin');
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
        <TouchableOpacity onPress={handleBackToSignIn} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.tint }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.75 }]}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.text + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!sent}
              value={email}
              onChangeText={setEmail}
            />

            {message ? (
              <Text style={[styles.message, { 
                color: sent ? '#10b981' : colors.tint 
              }]}>
                {message}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button, 
                { 
                  backgroundColor: sent ? '#10b981' : '#fff59d',
                  opacity: loading ? 0.7 : 1,
                  borderWidth: 1,
                  borderColor: sent ? '#10b981' : '#facc15'
                }
              ]}
              onPress={handleForgotPassword}
              disabled={loading || sent}
            >
              <Text style={[
                styles.buttonText, 
                { color: sent ? '#fff' : '#1f2937' }
              ]}>
                {loading ? 'Sending...' : (sent ? 'Email sent!' : 'Send reset link')}
              </Text>
            </TouchableOpacity>

            {sent && (
              <View style={styles.infoBox}>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Check your email for a password reset link. If you don't see it, check your spam folder.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text, opacity: 0.8 }]}>
              Remember your password?{' '}
            </Text>
            <TouchableOpacity onPress={handleBackToSignIn}>
              <Text style={[styles.footerLink, { color: colors.tint }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  backButton: { paddingVertical: 16 },
  backText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  card: { borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 4, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16 },
  message: { fontSize: 14, marginBottom: 16, textAlign: 'center', fontWeight: '600' },
  button: { borderRadius: 16, padding: 16, alignItems: 'center' },
  buttonText: { fontWeight: '700', fontSize: 16 },
  infoBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  infoText: { fontSize: 13, lineHeight: 20, opacity: 0.8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});
