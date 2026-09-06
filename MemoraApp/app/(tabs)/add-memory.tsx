import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase, MEMORY_PHOTOS_BUCKET, MEMORY_SONGS_BUCKET } from '../../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm') || lower.includes('video');
};

export default function AddMemory() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [songUri, setSongUri] = useState<string | null>(null);
  const [songMimeType, setSongMimeType] = useState<string | null>(null);
  const [songName, setSongName] = useState<string | null>(null);

  const colors = Colors[colorScheme ?? 'light'];

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setMediaType(asset.mimeType?.startsWith('video/') || asset.type === 'video' ? 'video' : 'image');
    }
  };

  const pickSong = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
      }) as any;

      const selectedSong = result?.assets?.[0] ?? (result && !result.canceled ? result : null);

      if (!selectedSong) {
        return;
      }

      const nextUri = selectedSong.uri || result?.uri;
      const nextMimeType = selectedSong.mimeType || result?.mimeType || 'audio/mpeg';
      const nextName = selectedSong.name || result?.name || 'Song';

      if (!nextUri) {
        Alert.alert('No file selected', 'Please choose an audio file from your device.');
        return;
      }

      setSongUri(nextUri);
      setSongMimeType(nextMimeType);
      setSongName(nextName);
    } catch (error) {
      console.error('Song picker error:', error);
      Alert.alert('Unable to choose song', 'Please try a different audio file.');
    }
  };

  const uploadSong = async (uri: string) => {
    if (!uri || uri.trim() === '') {
      throw new Error('Invalid song path. Please select a song again.');
    }

    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      throw new Error('Please select a local song file to upload.');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('You must be signed in to upload songs.');
    }

    let fileExt = 'mp3';
    if (songMimeType) {
      const mimeExt = songMimeType.split('/')[1];
      if (mimeExt) fileExt = mimeExt;
    }

    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    let base64String: string | undefined;
    try {
      base64String = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
    } catch (readError: any) {
      console.error('FileSystem read error:', readError);
      throw new Error(`Failed to read song file: ${readError?.message || 'File cannot be accessed'}`);
    }

    if (!base64String || typeof base64String !== 'string' || base64String.trim() === '') {
      throw new Error('Song file is empty. Please try selecting it again.');
    }

    const { error: uploadError } = await supabase.storage
      .from('memory-songs')
      .upload(fileName, decode(base64String), {
        contentType: songMimeType || 'audio/mpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Song upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from(MEMORY_SONGS_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!title || !description) {
      Alert.alert("Missing Info", "Please add a title and story.");
      return;
    }

    setLoading(true);
    let publicUrl = null;
    let songPublicUrl = null;

    try {
      // 1. Get Logged in User
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        Alert.alert(
          'Sign in required',
          'You must sign in before saving a memory.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/signin') },
          ],
        );
        setLoading(false);
        return;
      }

      // 2. Upload Photo (if selected)
      if (image) {
        const isVideo = mediaType === 'video' || isVideoUrl(image);

        if (image.startsWith('http://') || image.startsWith('https://')) {
          throw new Error('Please select a local photo or video from your device.');
        }

        if (!image || image.trim() === '') {
          throw new Error('Invalid media path. Please select a photo or video again.');
        }

        const fileExt = isVideo ? (image.toLowerCase().endsWith('.mov') ? 'mov' : image.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4') : 'jpg';
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        let base64String: string | undefined;
        try {
          base64String = await FileSystem.readAsStringAsync(image, {
            encoding: 'base64',
          });
        } catch (readError: any) {
          console.error('FileSystem read error:', readError);
          throw new Error(`Failed to read media: ${readError?.message || 'File cannot be accessed'}`);
        }

        if (!base64String || typeof base64String !== 'string' || base64String.trim() === '') {
          throw new Error('Media file is empty. Please try selecting it again.');
        }

        const contentType = isVideo ? 'video/mp4' : 'image/jpeg';

        const { error: uploadError } = await supabase.storage
          .from('memory-photos')
          .upload(fileName, decode(base64String), { 
            contentType,
            upsert: true,
            cacheControl: '3600'
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(MEMORY_PHOTOS_BUCKET).getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      if (songUri) {
        songPublicUrl = await uploadSong(songUri);
      }

      // 3. Save to database
      // status is set to 'pending' so it appears in the archive list
      // author_id is set to user.id so RLS allows you to delete/update it later
      const { error: dbError } = await supabase
        .from('stories')
        .insert([{ 
          title, 
          description, 
          status: 'pending', // Set to pending by default
          media_url: publicUrl,
          song_url: songPublicUrl,
          is_public: true,
          author_id: user.id, 
        }]);

      if (dbError) throw dbError;

      Alert.alert("Success!", "Memory archived!");
      setTitle('');
      setDescription('');
      setImage(null);
      setMediaType(null);
      setSongUri(null);
      setSongName(null);
      setSongMimeType(null);
      
      // Go back to the main list
      router.replace('/(tabs)');
      
    } catch (err: any) {
      console.log("Error details:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

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
        <View style={styles.headerContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Memory</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>Capture and share your story</Text>
        </View>
      
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Memory Title</Text>
            <TextInput 
              style={[styles.input, { 
                backgroundColor: colors.cardBg, 
                color: colors.text, 
                borderColor: colors.borderColor 
              }]} 
              placeholder="e.g. Grandma's Garden" 
              placeholderTextColor={colors.text + '80'}
              value={title}
              onChangeText={setTitle}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>The Story</Text>
            <TextInput 
              style={[
                styles.input, 
                styles.textArea, 
                { 
                  backgroundColor: colors.cardBg, 
                  color: colors.text, 
                  borderColor: colors.borderColor 
                }
              ]} 
              placeholder="Tell the story..." 
              placeholderTextColor={colors.text + '80'}
              multiline
              value={description}
              onChangeText={setDescription}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Photo or Video</Text>
            <TouchableOpacity 
              style={[
                styles.imageButton, 
                { 
                  backgroundColor: colors.cardBg, 
                  borderColor: colors.tint 
                }
              ]}
              onPress={pickImage}
              disabled={loading}
            >
              <FontAwesome name={image ? "check-circle" : "image"} size={24} color={colors.tint} />
              <Text style={[styles.imageButtonText, { color: colors.tint }]}>
                {image ? (mediaType === 'video' ? 'Video Selected' : 'Photo Selected') : 'Select a Photo or Video'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Song</Text>
            <TouchableOpacity
              style={[
                styles.imageButton,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.tint,
                }
              ]}
              onPress={pickSong}
              disabled={loading}
            >
              <FontAwesome name={songUri ? 'check-circle' : 'music'} size={24} color={colors.tint} />
              <Text style={[styles.imageButtonText, { color: colors.tint }]}>
                {songUri ? 'Song Selected' : 'Select a Song'}
              </Text>
            </TouchableOpacity>
            {songName ? (
              <Text style={[styles.songNameText, { color: colors.text, opacity: 0.8 }]}>{songName}</Text>
            ) : null}
          </View>

          {image && (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <FontAwesome name={isVideoUrl(image) ? 'video-camera' : 'image'} size={14} color={colors.tint} />
                <Text style={[styles.label, { color: colors.text }]}>Preview</Text>
              </View>
              {isVideoUrl(image) ? (
                <Video
                  source={{ uri: image }}
                  style={styles.previewImage}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping={false}
                />
              ) : (
                <Image source={{ uri: image }} style={styles.previewImage} />
              )}
            </View>
          )}



          <TouchableOpacity 
            style={[
              styles.button, 
              { backgroundColor: colors.tint, opacity: loading ? 0.6 : 1 }
            ]} 
            onPress={handleSave} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="archive" size={18} color="#fff" />
                <Text style={styles.buttonText}>Archive Memory</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ... styles remain the same
const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  headerContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
  headerTitle: { fontSize: 32, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, fontWeight: '500', opacity: 0.7 },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  formGroup: { marginBottom: 25 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 10, letterSpacing: 0.3 },
  input: { 
    borderWidth: 1.5, 
    borderRadius: 14, 
    padding: 14, 
    fontSize: 16,
    fontWeight: '500',
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  imageButton: { 
    padding: 18, 
    borderRadius: 14, 
    borderStyle: 'dashed', 
    borderWidth: 2.5,
    alignItems: 'center',
    gap: 12,
  },
  imageButtonText: { fontWeight: '600', fontSize: 16 },
  songNameText: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  previewContainer: { marginBottom: 30 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  previewImage: { width: '100%', height: 240, borderRadius: 16, backgroundColor: '#f0f0f0' },
  button: { 
    padding: 16, 
    borderRadius: 14, 
    marginTop: 10, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 0.3 }
});