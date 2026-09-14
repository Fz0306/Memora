import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, MEMORY_PHOTOS_BUCKET, MEMORY_SONGS_BUCKET } from '../../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import { stopAudioPlayback } from '../../constants/audioPlayback';

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm') || lower.includes('video');
};

interface Story {
  id: any;
  title: string;
  description: string;
  media_url: string | null;
  song_url?: string | null;
  created_at: string;
  status: string;
  author_id: string;
  is_public: boolean;
}

export default function MemoryDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [story, setStory] = useState<Story | null>(null);

  const storyId = typeof id === 'string' && !Number.isNaN(Number(id)) ? Number(id) : id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [songUri, setSongUri] = useState<string | null>(null);
  const [songMimeType, setSongMimeType] = useState<string | null>(null);
  const [songName, setSongName] = useState<string | null>(null);

  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (!id) return;
    fetchMemory();
  }, [id]);

  async function fetchMemory() {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.warn('Unable to get authenticated user', userError);
      }
      setUserId(user?.id ?? null);

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', String(storyId))
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        Alert.alert('Not found', 'Memory not found.');
        router.replace('/(tabs)');
        return;
      }

      setStory(data as Story);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setSongUrl(data.song_url || '');
      setSongName(null);
      setImage(data.media_url || null);
      setMediaType(isVideoUrl(data.media_url) ? 'video' : 'image');
      setSongUri(null);  // Clear pending song selection after refresh
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Unable to load memory.');
    } finally {
      setLoading(false);
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
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
        type: 'audio/*',
        copyToCacheDirectory: true,
      }) as any;

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedSong = result.assets[0];
      setSongUri(selectedSong.uri);
      setSongMimeType(selectedSong.mimeType || 'audio/mpeg');
      setSongName(selectedSong.name || 'Song');
    } catch (error) {
      console.error('Song picker error:', error);
      Alert.alert('Unable to choose song', 'Please try a different audio file.');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!userId) {
      throw new Error('You must be signed in to upload images.');
    }

    try {
      // Check if URI is a remote URL (already uploaded) vs local file
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        throw new Error('Please select a new image to upload, not the existing one.');
      }

      // Validate URI is not empty
      if (!uri || uri.trim() === '') {
        throw new Error('Invalid image path. Please select an image again.');
      }

      const fileName = `${userId}/${Date.now()}.jpg`;

      let base64String: string | undefined;
      try {
        base64String = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch (readError: any) {
        console.error('FileSystem read error:', readError);
        throw new Error(`Failed to read image file: ${readError?.message || 'File cannot be accessed'}`);
      }

      if (!base64String || typeof base64String !== 'string' || base64String.trim() === '') {
        throw new Error('Image file is empty. Please try selecting it again.');
      }

      const { error: uploadError } = await supabase.storage
        .from('memory-photos')
        .upload(fileName, decode(base64String), {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from(MEMORY_PHOTOS_BUCKET).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const uploadSong = async (uri: string) => {
    if (!userId) {
      throw new Error('You must be signed in to upload songs.');
    }

    try {
      // Check if URI is a remote URL vs local file
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        throw new Error('Please select a new song file to upload.');
      }

      // Extract file extension from MIME type
      let fileExt = 'mp3';
      if (songMimeType) {
        const mimeExt = songMimeType.split('/')[1];
        if (mimeExt) fileExt = mimeExt;
      }

      // Validate URI is not empty
      if (!uri || uri.trim() === '') {
        throw new Error('Invalid song path. Please select a song again.');
      }

      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
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
    } catch (error: any) {
      console.error('Error uploading song:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!story) return;
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Please enter title and story.');
      return;
    }

    setSaving(true);

    try {
      const updates: any = {
        title: title.trim(),
        description: description.trim(),
      };

      if (image && image !== story.media_url) {
        const uploadedUrl = await uploadImage(image);
        updates.media_url = uploadedUrl;
      }

      let newSongUrl = songUrl.trim() || null;
      if (songUri) {
        newSongUrl = await uploadSong(songUri);
      }
      updates.song_url = newSongUrl;

      const { error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId);

      if (error) {
        throw error;
      }

      Alert.alert('Saved', 'Memory updated successfully.');
      await fetchMemory();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Unable to update memory.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!story) return;

    Alert.alert('Delete Memory', 'Move this memory to the deleted archive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopAudioPlayback();
            setLoading(true);

            const {
              data: { session },
              error: authError,
            } = await supabase.auth.getSession();

            if (authError) {
              throw authError;
            }
            const currentUserId = session?.user?.id;
            if (!currentUserId || currentUserId !== story.author_id) {
              throw new Error('You are not allowed to delete this memory.');
            }
            const targetId = String(story?.id ?? storyId);
            if (!targetId) {
              throw new Error('Invalid memory identifier.');
            }

            const { data, error } = await supabase
              .from('stories')
              .update({ status: 'deleted', is_public: false })
              .match({ id: targetId, author_id: currentUserId })
              .select('id, status');

            if (error) {
              console.error('Delete response', { data, error });
              throw error;
            }

            Alert.alert('Deleted', 'Memory moved to the recycle bin.', [
              { text: 'OK', onPress: () => router.replace('/delete') },
            ]);
          } catch (err: any) {
            console.error('Delete error', err);
            const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
            Alert.alert('Error', message || 'Unable to delete memory.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleRestore = async () => {
    if (!story) return;

    try {
      setLoading(true);
      const targetId = String(storyId);
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) throw authError;
      const currentUserId = session?.user?.id;
      if (!currentUserId || currentUserId !== story.author_id) {
        throw new Error('You are not allowed to restore this memory.');
      }

      const { error } = await supabase
        .from('stories')
        .update({ status: 'pending', is_public: true })
        .match({ id: targetId, author_id: currentUserId });

      if (error) throw error;

      Alert.alert('Restored', 'Memory restored to public archive.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Unable to restore memory.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSong = async () => {
    if (!songUrl?.trim()) return;
    const supported = await Linking.canOpenURL(songUrl.trim());
    if (!supported) {
      Alert.alert('Invalid URL', 'Unable to open this song URL.');
      return;
    }
    await Linking.openURL(songUrl.trim());
  };

  const handleOpenDocumentation = () => {
    if (!story) return;

    router.push({
      pathname: '/documentation',
      params: {
        memoryId: String(story.id),
        memoryTitle: title || story.title,
        memoryDescription: description || story.description,
        memoryPhoto: image || story.media_url || '',
        memorySong: songUrl || story.song_url || '',
      },
    });
  };

  if (loading) {
    return (
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#0f172a', '#111827', '#0f172a'] : colorScheme === 'system' ? ['#fef3c7', '#fef08a', '#fef3c7'] : ['#f0f9ff', '#e0f2fe', '#f3f4f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={colorScheme === 'dark'
        ? ['#0f172a', '#111827', '#0f172a']
        : colorScheme === 'system'
        ? ['#fef3c7', '#fef08a', '#fef3c7']
        : ['#f0f9ff', '#e0f2fe', '#f3f4f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Memory Details</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>Edit story, photo, or song</Text>
        </View>

        {story ? (
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Memory title"
                placeholderTextColor={colors.text + '80'}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Story</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Write or update your story"
                placeholderTextColor={colors.text + '80'}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Song</Text>
              <TouchableOpacity
                style={[styles.imageButton, { backgroundColor: colors.cardBg, borderColor: colors.tint }]}
                onPress={pickSong}
              >
                <FontAwesome name={songUri ? 'check-circle' : 'music'} size={20} color={colors.tint} />
                <Text style={[styles.imageButtonText, { color: colors.tint }]}>Choose Song</Text>
              </TouchableOpacity>
              {songUrl?.trim() ? (
                <TouchableOpacity style={[styles.linkButton, { backgroundColor: colors.tint }]} onPress={handleOpenSong}>
                  <Text style={styles.linkButtonText}>Open Song</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Photo or Video</Text>
              <TouchableOpacity
                style={[styles.imageButton, { backgroundColor: colors.cardBg, borderColor: colors.tint }]}
                onPress={pickImage}
              >
                <FontAwesome name={image ? 'check-circle' : 'image'} size={20} color={colors.tint} />
                <Text style={[styles.imageButtonText, { color: colors.tint }]}>{image ? (mediaType === 'video' ? 'Choose Video' : 'Choose Photo') : 'Choose Photo or Video'}</Text>
              </TouchableOpacity>
            </View>

            {image ? (
              <TouchableOpacity onPress={handleOpenDocumentation} style={styles.documentationImageWrapper}>
                {isVideoUrl(image) ? (
                  <Video source={{ uri: image }} style={styles.previewImage} useNativeControls resizeMode={ResizeMode.COVER} isLooping={false} />
                ) : (
                  <Image source={{ uri: image }} style={styles.previewImage} />
                )}
                <Text style={[styles.documentationText, { color: colors.tint }]}>{isVideoUrl(image) ? 'Tap the video for documentation' : 'Tap the photo for documentation'}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Save Changes</Text>
                )}
              </TouchableOpacity>

              {story.author_id === userId ? (
                story.is_public ? (
                  <TouchableOpacity style={[styles.deleteButton, { backgroundColor: '#dc2626' }]} onPress={handleDelete}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.deleteButton, { backgroundColor: '#10b981' }]} onPress={handleRestore}>
                    <Text style={styles.deleteText}>Restore</Text>
                  </TouchableOpacity>
                )
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: colors.text }]}>Memory details not available.</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 30, fontWeight: '800', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, fontWeight: '500', opacity: 0.8 },
  form: { paddingHorizontal: 20 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  textArea: { height: 130, textAlignVertical: 'top' },
  imageButton: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  imageButtonText: { fontSize: 16, fontWeight: '700' },
  documentationImageWrapper: { marginTop: 16, alignItems: 'center' },
  documentationText: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  previewImage: { width: '100%', height: 250, borderRadius: 16, marginTop: 16, backgroundColor: '#f0f0f0' },
  linkButton: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  linkButtonText: { color: '#fff', fontWeight: '700' },
  buttonRow: { marginTop: 10, gap: 12 },
  saveButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  errorText: { fontSize: 16, fontWeight: '600' },
});
