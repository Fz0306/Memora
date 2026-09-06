import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ScrollView, Image, TextInput } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase, AVATAR_BUCKET } from '../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setName(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
    setAvatarUrl(user?.user_metadata?.avatar_url || null);
  }

  const saveProfile = async () => {
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter your name before saving.');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          name: trimmedName,
        },
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            full_name: trimmedName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.warn('Profile update warning:', profileError.message);
      }

      setUser((prev: any) => ({
        ...prev,
        user_metadata: {
          ...(prev?.user_metadata || {}),
          full_name: trimmedName,
          name: trimmedName,
        },
      }));

      Alert.alert('Success', 'Your name has been updated.');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to save your profile.');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll permissions are required to select an image.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Verify it's a local file URI, not a remote URL
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        Alert.alert('Invalid Image', 'Please select a new photo from your device.');
        setLoading(false);
        return;
      }

      // Validate URI
      if (!uri || uri.trim() === '') {
        throw new Error('Invalid image path. Please select an image again.');
      }

      let base64String: string | undefined;
      try {
        base64String = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch (readError: any) {
        console.error('FileSystem read error:', readError);
        throw new Error(`Failed to read image: ${readError?.message || 'File cannot be accessed'}`);
      }

      if (!base64String || typeof base64String !== 'string' || base64String.trim() === '') {
        throw new Error('Image file is empty. Please try selecting it again.');
      }

      const fileName = `avatar-${user.id}-${Date.now()}.jpg`;

      // 2. Upload to Storage Bucket
      const { error: storageError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, decode(base64String), {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });

      if (storageError) throw storageError;

      // 3. Get the Public URL for the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName);

      // 4. Update Auth Metadata (For session/internal use)
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (authError) throw authError;

      // 5. Update the 'profiles' table (For the main Profile screen)
      // This ensures your dashboard sees the new picture immediately.
      const { error: tableError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (tableError) {
        console.warn("Auth updated, but profiles table failed:", tableError.message);
        // We don't necessarily want to 'throw' here if the upload worked, 
        // but it's why your main screen might be blank.
      }

      setAvatarUrl(publicUrl);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to upload profile picture.');
    } finally {
      setLoading(false);
    }
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
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <FontAwesome name="user" size={60} color={colors.tint} />
              )}
            </View>
            <TouchableOpacity
              onPress={pickImage}
              disabled={loading}
              style={[styles.changeButton, { backgroundColor: colors.tint }]}
            >
              <Text style={styles.changeButtonText}>
                {loading ? 'Uploading...' : 'Change Picture'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.label, { color: colors.text }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colorScheme === 'dark' ? '#94a3b8' : '#64748b'}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.borderColor,
                  backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
                },
              ]}
            />
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <Text style={[styles.value, { color: colors.text, opacity: 0.7 }]}>
              {user?.email}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={saveProfile}
          disabled={loading}
          style={[styles.saveButton, { backgroundColor: colors.tint, opacity: loading ? 0.7 : 1 }]}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  changeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  saveButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
