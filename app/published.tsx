import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { supabase } from '../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

interface PublishedStory {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  created_at: string;
}

export default function PublishedScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const isFocused = useIsFocused();
  const [stories, setStories] = useState<PublishedStory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublishedStories = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStories([]);
        return;
      }

      const { data, error } = await supabase
        .from('stories')
        .select('id, title, description, media_url, created_at')
        .eq('author_id', user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Published stories error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) fetchPublishedStories();
  }, [isFocused, fetchPublishedStories]);

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0f172a', '#111827', '#0f172a'] : ['#f0f9ff', '#e0f2fe', '#f3f4f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={18} color={colors.tint} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Published</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.tint} style={styles.loader} />
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome name="globe" size={42} color={colors.tint} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No published memories yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/memory/${item.id}`)}
                style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}
              >
                {item.media_url ? <Image source={{ uri: item.media_url }} style={styles.image} /> : null}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>{item.description}</Text>
                  <Text style={[styles.date, { color: colors.text }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  backButton: { padding: 4 },
  title: { fontSize: 28, fontWeight: '800' },
  loader: { marginTop: 60 },
  list: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  image: { width: '100%', height: 180 },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  description: { fontSize: 15, lineHeight: 21, opacity: 0.75 },
  date: { fontSize: 13, opacity: 0.55, marginTop: 10 },
  empty: { alignItems: 'center', marginTop: 120, gap: 12 },
  emptyText: { fontSize: 16, opacity: 0.7 },
});
