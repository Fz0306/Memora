import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio, Video, ResizeMode } from 'expo-av';
import { supabase } from '../constants/SupabaseConfig';

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm') || lower.includes('video');
};

export default function DocumentationScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();

  const memoryId = typeof params.memoryId === 'string' ? params.memoryId : '';
  const initialTitle = typeof params.memoryTitle === 'string' ? params.memoryTitle : '';
  const initialDescription = typeof params.memoryDescription === 'string' ? params.memoryDescription : '';
  const photoUrl = typeof params.memoryPhoto === 'string' ? params.memoryPhoto : '';
  const songUrl = typeof params.memorySong === 'string' ? params.memorySong : '';
  const isVideoMedia = isVideoUrl(photoUrl);

  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setNotes(initialDescription);
  }, [initialTitle, initialDescription]);

  useEffect(() => {
    let isMounted = true;

    const startSong = async () => {
      if (!songUrl || !songUrl.trim()) return;

      try {
        if (currentSoundRef.current) {
          await currentSoundRef.current.unloadAsync();
          currentSoundRef.current = null;
        }

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: songUrl },
          { shouldPlay: true }
        );

        if (!isMounted) {
          await sound.unloadAsync();
          return;
        }

        currentSoundRef.current = sound;
        setIsPlaying(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      } catch (error) {
        console.error('Documentation song playback error:', error);
      }
    };

    startSong();

    return () => {
      isMounted = false;
      if (currentSoundRef.current) {
        currentSoundRef.current.unloadAsync();
        currentSoundRef.current = null;
      }
    };
  }, [songUrl]);

  const toggleSongPlayback = async () => {
    if (!songUrl || !songUrl.trim()) {
      Alert.alert('No song', 'This memory does not have a song attached.');
      return;
    }

    try {
      if (!currentSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: songUrl },
          { shouldPlay: true }
        );
        currentSoundRef.current = sound;
        setIsPlaying(true);
        return;
      }

      const status = await currentSoundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await currentSoundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await currentSoundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Toggle song playback error:', error);
      Alert.alert('Unable to play song', 'This song could not be played right now.');
    }
  };

  const exampleNotes = useMemo(() => {
    return [
      'Who was there:',
      'Where it happened:',
      'What made this moment special:',
      'Why this memory matters now:',
    ].join('\n');
  }, []);

  const handleFillExample = () => {
    setNotes((current) => current && current.trim() ? `${current.trim()}\n\n${exampleNotes}` : exampleNotes);
  };

  const handleSave = async () => {
    if (!memoryId) {
      router.back();
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedTitle && !trimmedNotes) {
      Alert.alert('Add documentation', 'Please add a title or notes for this memory.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('stories')
        .update({
          title: trimmedTitle || initialTitle || 'Untitled Memory',
          description: trimmedNotes || initialDescription || 'No documentation added yet.',
        })
        .eq('id', memoryId);

      if (error) {
        throw error;
      }

      Alert.alert('Saved', 'Your documentation has been added to this memory.');
      router.back();
    } catch (error: any) {
      console.error('Documentation save error:', error);
      Alert.alert('Unable to save', error?.message || 'Something went wrong while saving the documentation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark'
        ? ['#0f172a', '#111827', '#0f172a']
        : colorScheme === 'system'
        ? ['#fef3c7', '#fef08a', '#fef3c7']
        : ['#f8fafc', '#fef3c7', '#fef3c7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Documentation</Text>
          <Text style={[styles.subtitle, { color: colors.text, opacity: 0.75 }]}>Add details about this photo and memory.</Text>
        </View>

        {photoUrl ? (
          <View style={[styles.imageCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}> 
            {isVideoMedia ? (
              <Video
                source={{ uri: photoUrl }}
                style={styles.previewImage}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                isLooping={false}
              />
            ) : (
              <Image source={{ uri: photoUrl }} style={styles.previewImage} resizeMode="cover" />
            )}
          </View>
        ) : null}

        {songUrl ? (
          <TouchableOpacity
            onPress={toggleSongPlayback}
            style={[styles.songButton, { backgroundColor: colors.tint }]}
          >
            <FontAwesome name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
            <Text style={styles.songButtonText}>{isPlaying ? 'Pause memory song' : 'Play memory song'}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Memory title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Add a title for this memory"
            placeholderTextColor={colors.text + '80'}
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.borderColor }]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Documentation notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Write who was there, where it happened, what it meant, and why it matters."
            placeholderTextColor={colors.text + '80'}
            multiline
            numberOfLines={8}
            style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.borderColor }]}
          />

          <TouchableOpacity onPress={handleFillExample} style={[styles.helperButton, { borderColor: colors.tint }]}>
            <Text style={[styles.helperButtonText, { color: colors.tint }]}>Use example notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving ? 0.7 : 1 }]}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save documentation</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { padding: 20, paddingTop: 40, paddingBottom: 40 },
  header: { marginBottom: 18 },
  backButton: { marginBottom: 20, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  imageCard: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  previewImage: { width: '100%', height: 220 },
  songButton: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 },
  songButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: { borderRadius: 24, borderWidth: 1, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 180, textAlignVertical: 'top', marginBottom: 14 },
  helperButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  helperButtonText: { fontSize: 14, fontWeight: '700' },
  saveButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
