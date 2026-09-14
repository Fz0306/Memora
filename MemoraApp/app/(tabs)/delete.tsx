import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  Image,
  TouchableOpacity, 
  RefreshControl 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Video, ResizeMode } from 'expo-av';
import { stopAudioPlayback } from '../../constants/audioPlayback';

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.split('?')[0].split('#')[0].toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm') || lower.includes('video');
};

interface Story {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  song_url: string | null;
  created_at: string;
  status: string;
  author_id: string;
  is_public: boolean;
}

export default function DeleteScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const isFocused = useIsFocused();
  
  const [deletedStories, setDeletedStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeletedMemories = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('User not authenticated', userError);
        return;
      }

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('author_id', user.id)
        .eq('status', 'deleted') 
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeletedStories(data || []);
    } catch (error: any) {
      console.error('Fetch Bin Error:', error.message);
      Alert.alert('Error', 'Unable to load deleted memories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchDeletedMemories();
    }
  }, [isFocused, fetchDeletedMemories]);

  const restoreMemory = async (storyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      const { error } = await supabase
        .from('stories')
        .update({ 
          status: 'pending',
          is_public: true 
        })
        .eq('id', storyId)
        .eq('author_id', user.id); 
  
      if (error) throw error;

      // Update local state immediately
      setDeletedStories(prev => prev.filter(item => item.id !== storyId));
      Alert.alert('Restored', 'Memory moved back to your archive.');
    } catch (error: any) {
      console.error('Restore Error:', error.message);
      Alert.alert('Permission Denied', 'Ensure your RLS UPDATE policy allows restoring.');
    }
  };

  const getStoragePathFromPublicUrl = (publicUrl: string, bucket: string) => {
    try {
      const parsed = new URL(publicUrl);
      const prefix = `/storage/v1/object/public/${bucket}/`;
      if (!parsed.pathname.includes(prefix)) return null;
      return decodeURIComponent(parsed.pathname.split(prefix)[1]);
    } catch {
      return null;
    }
  };

  const deleteStorageFile = async (publicUrl: string | null, bucket: string) => {
    if (!publicUrl) return;
    const path = getStoragePathFromPublicUrl(publicUrl, bucket);
    if (!path) return;

    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
        console.warn(`Storage Cleanup Note: ${error.message}`);
    }
  };

  const permanentlyDelete = async (storyId: string) => {
    Alert.alert(
      "Permanent Delete",
      "This action cannot be undone. The memory and files will be removed forever.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Forever", 
          style: "destructive", 
          onPress: async () => {
            try {
              await stopAudioPlayback();

              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // 1. Fetch file URLs before deleting the row
              const { data: story, error: fetchError } = await supabase
                .from('stories')
                .select('media_url, song_url')
                .eq('id', storyId)
                .single();

              if (fetchError) throw fetchError;

              // 2. Clean up Storage files
              if (story.media_url) await deleteStorageFile(story.media_url, 'memory-photos');
              if (story.song_url) await deleteStorageFile(story.song_url, 'memory-songs');

              // 3. HARD DELETE: Remove row from database
              const { error: deleteError } = await supabase
                .from('stories')
                .delete()
                .eq('id', storyId)
                .eq('author_id', user.id);

              if (deleteError) throw deleteError;

              // 4. Update local state IMMEDIATELY so it disappears from the screen
              setDeletedStories(prev => prev.filter(item => item.id !== storyId));
              
              Alert.alert('Deleted', 'Memory removed permanently.');
              
            } catch (error: any) {
              console.error('Hard Delete Error:', error.message);
              Alert.alert('Error', 'The server could not delete this item. Ensure your RLS DELETE policy is active.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeletedMemories();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
            <FontAwesome name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Deleted Memories</Text>
        <Text style={[styles.subtitle, { color: colors.text, opacity: 0.6 }]}> 
          Memories stay here until you delete them permanently.
        </Text>
        {deletedStories.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.tint + '1f' }]}>
            <FontAwesome name="trash-o" size={13} color={colors.tint} />
            <Text style={[styles.countText, { color: colors.tint }]}>
              {deletedStories.length} {deletedStories.length === 1 ? 'memory' : 'memories'} in bin
            </Text>
          </View>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : deletedStories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="inbox" size={60} color={colors.text} style={{ marginBottom: 15, opacity: 0.1 }} />
          <Text style={[styles.emptyText, { color: colors.text, opacity: 0.5 }]}>Your bin is empty</Text>
        </View>
      ) : (
        <FlatList
          data={deletedStories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { 
              backgroundColor: colors.cardBg,
              borderColor: colors.borderColor
            }]}> 
              {item.media_url ? (
                <View style={styles.mediaPreview}>
                  {isVideoUrl(item.media_url) ? (
                    <Video
                      source={{ uri: item.media_url }}
                      style={styles.previewImage}
                      useNativeControls
                      resizeMode={ResizeMode.COVER}
                      isLooping={false}
                    />
                  ) : (
                    <Image source={{ uri: item.media_url }} style={styles.previewImage} />
                  )}
                  <View style={styles.deletedBadge}>
                    <FontAwesome name="trash" size={11} color="#fff" />
                    <Text style={styles.deletedBadgeText}>Deleted</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.mediaFallback, styles.mediaPreview, { backgroundColor: colorScheme === 'dark' ? '#273449' : '#f8f3d8' }]}>
                  <FontAwesome name="image" size={28} color={colors.tint} />
                  <Text style={[styles.mediaFallbackText, { color: colors.text }]}>No image attached</Text>
                </View>
              )}

              <View style={styles.cardMain}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title || 'Untitled Memory'}</Text>
                  <FontAwesome name="ellipsis-v" size={16} color={colors.text} style={styles.moreIcon} />
                </View>
                <Text style={[styles.cardDescription, { color: colors.text, opacity: 0.7 }]} numberOfLines={2}>
                  {item.description || 'No description provided.'}
                </Text>
                <Text style={[styles.cardDate, { color: colors.text, opacity: 0.5 }]}>
                  Added {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.restoreButton, { backgroundColor: colors.tint }]} 
                  onPress={() => restoreMemory(item.id)}
                >
                  <FontAwesome name="undo" size={14} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.buttonText}>Restore</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.deleteForeverButton} 
                  onPress={() => permanentlyDelete(item.id)}
                >
                  <Text style={styles.deleteForeverText}>Delete Forever</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 28, marginTop: 60 },
  backArrow: { marginBottom: 22 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, opacity: 0.75 },
  countBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 16 },
  countText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  loadingContainer: { flex: 1, justifyContent: 'center', paddingTop: 30 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  listContent: { paddingBottom: 100, paddingTop: 10 },
  card: { 
    borderRadius: 20, 
    borderWidth: 1, 
    overflow: 'hidden',
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18
  },
  mediaPreview: { height: 170, width: '100%', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  mediaFallbackText: { fontSize: 13, fontWeight: '700', opacity: 0.65 },
  deletedBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#b91c1c', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  deletedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardMain: { padding: 18, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  moreIcon: { marginLeft: 8, marginTop: 3, opacity: 0.4 },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  cardDate: { fontSize: 12, marginTop: 10, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 10, padding: 18, paddingTop: 12 },
  restoreButton: { flex: 1.2, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  deleteForeverButton: { 
    flex: 1, 
    height: 46,
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  deleteForeverText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
});