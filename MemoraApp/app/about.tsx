import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme, useTheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

export default function AboutScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleContactSupport = async () => {
    const url = 'mailto:support@memora.com?subject=Memora Support';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Unable to open mail app', 'Please contact support@memora.com directly.');
    }
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark'
        ? ['#0f172a', '#111827', '#0f172a']
        : colorScheme === 'system' ? ['#fef3c7', '#fef08a', '#fef3c7'] : ['#fdf6e7', '#fff9ec', '#f5f0e1']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>About Us</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Memora</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.75 }]}>Version 1.0.0</Text>

          <Text style={[styles.bodyText, { color: colors.text }]}>Memora is built to help families preserve memories in one secure, beautiful place. Store stories, photos, and special moments while keeping every memory easy to share.</Text>

          <Text style={[styles.sectionLabel, { color: colors.text }]}>What we offer</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>• Secure memory storage for family stories and photos.{"\n"}
• Simple sharing with loved ones.{"\n"}
• Personalized themes and account control.{"\n"}
• Support for easy switching between family members.</Text>

          <Text style={[styles.sectionLabel, { color: colors.text }]}>Get in touch</Text>
          <Text style={[styles.bodyText, { color: colors.text, marginBottom: 20 }]}>If you have questions, feature ideas or need assistance, we are here to help.</Text>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.tint }]} onPress={handleContactSupport}>
            <Text style={styles.actionButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  bodyText: { fontSize: 15, lineHeight: 24, fontWeight: '500' },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
