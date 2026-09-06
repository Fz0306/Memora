import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useRouter } from 'expo-router';

export default function ResetPasswordScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        console.log('Handling deep link:', url);

        // Parse URL to extract tokens
        const allParams = new URLSearchParams(url.split('?')[1] || url.split('#')[1] || '');
        
        // Check both query and fragment for tokens
        let accessToken = allParams.get('access_token');
        let refreshToken = allParams.get('refresh_token');
        const type = allParams.get('type');

        // Also check URL hash if not found in query
        if (!accessToken && url.includes('#')) {
          const hashParams = new URLSearchParams(url.split('#')[1]);
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
        }

        console.log('Extracted - Type:', type, 'Access Token:', !!accessToken, 'Refresh Token:', !!refreshToken);

        if (!accessToken || !refreshToken) {
          setErrorMsg('❌ Recovery link is invalid or expired. Please request a new password reset.');
          return;
        }

        // Set the session
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Session error:', error);
          setErrorMsg(`❌ ${error.message || 'Failed to verify recovery link'}`);
          return;
        }

        console.log('Session set successfully');
        setReady(true);
      } catch (error: any) {
        console.error('Deep link error:', error);
        setErrorMsg(`❌ ${error.message || 'Unable to process recovery link'}`);
      }
    };

    const setupDeepLinkListener = async () => {
      // Get initial URL
      const initialUrl = await Linking.getInitialURL();
      
      if (initialUrl != null) {
        handleDeepLink(initialUrl);
      }

      // Listen for new deep links
      const subscription = Linking.addEventListener('url', ({ url }) => {
        handleDeepLink(url);
      });

      return subscription;
    };

    setupDeepLinkListener().then(subscription => {
      return () => subscription?.remove();
    });
  }, []);

  const updatePassword = async () => {
    if (password.length < 6) {
      Alert.alert('Invalid password', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password twice.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }

    Alert.alert('Password updated', 'You can now sign in with your new password.', [
      { text: 'Sign in', onPress: () => router.replace('/signin') },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Reset Your Password</Text>

        {errorMsg && (
          <View style={[styles.errorBox, { borderColor: colors.tint }]}>
            <Text style={[styles.errorText, { color: colors.tint }]}>{errorMsg}</Text>
            <Text style={[styles.errorSubtext, { color: colors.text, opacity: 0.7 }]}>
              If you're testing on a browser, please:
              {'\n\n'}
              1. Copy the reset link from your email
              {'\n'}
              2. Open the email link on your actual mobile device with the app installed
              {'\n\n'}
              Or request a new password reset and try again.
            </Text>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.tint }]} 
              onPress={() => router.replace('/signin')}
            >
              <Text style={styles.buttonText}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {!errorMsg && !ready && (
          <View style={[styles.loadingBox, { borderColor: colors.tint }]}>
            <Text style={[styles.loadingText, { color: colors.text }]}>⏳ Waiting for reset link...</Text>
            <Text style={[styles.loadingSubtext, { color: colors.text, opacity: 0.7 }]}>
              Make sure you've clicked the password reset link from your email.
            </Text>
          </View>
        )}

        {ready && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>New password</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.borderColor }]}
              placeholder="Enter new password (min. 6 characters)"
              placeholderTextColor={`${colors.text}80`}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <Text style={[styles.label, { color: colors.text }]}>Confirm password</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.borderColor }]}
              placeholder="Confirm password"
              placeholderTextColor={`${colors.text}80`}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
            />

            <TouchableOpacity 
              style={[styles.button, { 
                backgroundColor: colors.tint,
                opacity: loading ? 0.6 : 1
              }]} 
              onPress={updatePassword} 
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? '⏳ Updating...' : '✓ Update Password'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16 },
  button: { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorBox: { borderWidth: 1.5, borderRadius: 14, padding: 16, marginTop: 20 },
  errorText: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  errorSubtext: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  loadingBox: { borderWidth: 1.5, borderRadius: 14, padding: 16, marginTop: 20, alignItems: 'center' },
  loadingText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  loadingSubtext: { fontSize: 13, textAlign: 'center' },
});
