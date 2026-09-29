import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router'; // Ensure this is installed/available
import Colors from '@/constants/Colors';
import { useColorScheme, useTheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter(); // Initialize the router here
  const { theme, setTheme } = useTheme();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [highQualityUploads, setHighQualityUploads] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const colors = Colors[colorScheme ?? 'light'];
  const languages = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese'];

  const handleThemeChange = async (selectedTheme: 'light' | 'dark' | 'system') => {
    await setTheme(selectedTheme);
    const label = selectedTheme === 'system' ? 'System Default' : `${selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)} Mode`;
    Alert.alert('Theme Changed', `Switched to ${label}.`);
  };

  const handleLinkPress = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Don't know how to open this URL");
    }
  };

  const handleAboutUs = () => {
    router.push('/about');
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark'
        ? ['#0f172a', '#111827', '#0f172a']
        : colorScheme === 'system' ? ['#fef3c7', '#fef08a', '#fef3c7'] : ['#f0f9ff', '#e0f2fe', '#f3f4f6']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          {/* FIXED: Added a check to ensure router exists before calling back() */}
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : Alert.alert("Notice", "No back history")} 
            style={styles.backButton}
          >
            <FontAwesome name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        </View>

        {/* ... Rest of your sections (Appearance, Preferences, etc.) ... */}
        
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <TouchableOpacity
            style={[
              styles.option,
              { backgroundColor: colors.cardBg, borderColor: colors.borderColor },
              theme === 'light' ? styles.selectedOption : null,
            ]}
            onPress={() => handleThemeChange('light')}
          >
            <FontAwesome name="sun-o" size={20} color={colors.tint} />
            <Text style={[styles.optionText, { color: colors.text }]}>Light Mode</Text>
            {theme === 'light' && <FontAwesome name="check" size={16} color={colors.tint} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              { backgroundColor: colors.cardBg, borderColor: colors.borderColor },
              theme === 'dark' ? styles.selectedOption : null,
            ]}
            onPress={() => handleThemeChange('dark')}
          >
            <FontAwesome name="moon-o" size={20} color={colors.tint} />
            <Text style={[styles.optionText, { color: colors.text }]}>Dark Mode</Text>
            {theme === 'dark' && <FontAwesome name="check" size={16} color={colors.tint} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              { backgroundColor: colors.cardBg, borderColor: colors.borderColor },
              theme === 'system' ? styles.selectedOption : null,
            ]}
            onPress={() => handleThemeChange('system')}
          >
            <FontAwesome name="desktop" size={20} color={colors.tint} />
            <Text style={[styles.optionText, { color: colors.text }]}>System Default</Text>
            {theme === 'system' && <FontAwesome name="check" size={16} color={colors.tint} />}
          </TouchableOpacity>
        </View>

        {/* Support Section Example */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>
          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}
            onPress={handleAboutUs}
          >
            <FontAwesome name="info-circle" size={20} color={colors.tint} />
            <Text style={[styles.optionText, { color: colors.text }]}>About Us</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.borderColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}
            onPress={() => handleLinkPress('https://memora.com/faq')}
          >
            <FontAwesome name="question-circle" size={20} color={colors.tint} />
            <Text style={[styles.optionText, { color: colors.text }]}>FAQ</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.borderColor} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 60, // Increased for status bar clearance
    paddingBottom: 20,
    backgroundColor: 'transparent' 
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  section: { marginBottom: 24, paddingHorizontal: 20, backgroundColor: 'transparent' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    elevation: 2,
  },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600', marginLeft: 12 },
  selectedOption: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  versionText: { fontSize: 14, fontWeight: '500' },
});