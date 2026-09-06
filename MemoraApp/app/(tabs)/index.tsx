import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { StyleSheet, FlatList, ActivityIndicator, Alert, Text, View, Image, RefreshControl, TextInput, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../../constants/SupabaseConfig';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio, Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm') || lower.includes('video');
};

interface Story {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  song_url?: string | null;
  created_at: string;
  status: string;
  author_id: string;
  is_public: boolean;
}

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return () => {
      if (currentSoundRef.current) {
        currentSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const getSongTitle = (story: Story) => {
    if (story.song_url) {
      try {
        const url = new URL(story.song_url);
        const path = url.pathname;
        const filename = path.split('/').pop();
        return filename ? filename.split('.')[0] : 'Song';
      } catch {
        return 'Song';
      }
    }
    return null;
  };

  const playSong = async (songUrl: string, storyId: string) => {
    try {
      if (currentSoundRef.current && playingSongId === storyId) {
        await currentSoundRef.current.pauseAsync();
        currentSoundRef.current = null;
        setPlayingSongId(null);
        return;
      }

      if (currentSoundRef.current) {
        await currentSoundRef.current.unloadAsync();
        currentSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: songUrl },
        { shouldPlay: true }
      );
      currentSoundRef.current = sound;
      setPlayingSongId(storyId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          currentSoundRef.current = null;
          setPlayingSongId((current) => (current === storyId ? null : current));
        }
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert('Error', 'Unable to play the song. Please check your audio settings.');
    }
  };

  // Wrap fetch in useCallback to prevent re-renders
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return; // User handled by navigation/auth flow
      }

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('author_id', user.id)
        .neq('status', 'deleted') // Simpler than .not('status', 'eq', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error: any) {
      console.error('Fetch Error:', error.message);
      Alert.alert('Error', 'Failed to load your memories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchMemories();
    }
  }, [isFocused, fetchMemories]);


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMemories();
    setRefreshing(false);
  };

  const formatMemorySummary = (story: Story) => {
    const when = new Date(story.created_at).toLocaleDateString();
    return `"${story.title}" (${when}) - ${story.description.slice(0, 120)}${story.description.length > 120 ? '...' : ''}`;
  };

  const getGroqResponse = (normalized: string) => {
    if (!normalized) return '';

    if (normalized.includes('what is') && normalized.includes('memory archive')) {
      return 'A memory archive preserves your stories, photos, audio, and notes so they stay meaningful over time. It helps you revisit moments and share history with loved ones.';
    }

    if (normalized.includes('why') && (normalized.includes('archive') || normalized.includes('memory'))) {
      return 'Archiving memories protects your personal history. It helps you remember key moments, preserve emotions, and pass stories to future generations.';
    }

    if (normalized.includes('how to') && (normalized.includes('archive') || normalized.includes('memory'))) {
      return 'Start by capturing the key details: who was there, what happened, where it took place, and why it mattered. Organize these memories with titles, dates, and backups so they stay safe.';
    }

    if (normalized.includes('best') && normalized.includes('memory')) {
      return 'The best memories are preserved with context, emotion, and a little story behind them. Add clear titles, photos or audio, and a reason why the moment matters.';
    }

    if (normalized.includes('preserve') || normalized.includes('store') || normalized.includes('backup')) {
      return 'Use multiple backup locations and refresh your archive format from time to time. A combination of cloud storage, local copies, and clear labels keeps memories safe.';
    }

    if (normalized.includes('tips') || normalized.includes('help') || normalized.includes('advice')) {
      return 'GROQ AI can help with memory archiving, story ideas, organization tips, and general memory preservation. Ask with a specific moment or goal for the best guidance.';
    }

    return `GROQ AI is ready to help. I can answer questions about memory archives, storytelling, organization, and preservation. You asked: "${normalized}."`;  
  };

  const getOpenAIAnswer = async (question: string) => {
    const apiKey = Constants.expoConfig?.extra?.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      console.log('API key not configured or is placeholder');
      return '';
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.log('API key does not start with sk-');
      Alert.alert('Invalid API Key', 'OpenAI API keys should start with "sk-". Please check your key format.');
      return '';
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are GROQ AI, a smart assistant for memory archives and general questions. Answer clearly, helpfully, and in a friendly tone.',
            },
            {
              role: 'user',
              content: question,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('OpenAI error', data);
        const errorMessage = data.error?.message || `API Error: ${response.status}`;
        Alert.alert('API Error', `OpenAI API error: ${errorMessage}. Please check your API key.`);
        return '';
      }

      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('OpenAI request failed', error);
      return '';
    }
  };

  const generateMemoryResponse = (question: string, memories: Story[]) => {
    const normalized = question.trim().toLowerCase();
    const generalAnswer = getGroqResponse(normalized);

    const isAppSpecificQuestion = /how many|total|count|number of|recent|latest|newest|last|favorite|best|special|memorable|important|matching|find/.test(normalized);

    if (generalAnswer && !isAppSpecificQuestion) {
      return generalAnswer;
    }

    if (!memories.length) {
      return generalAnswer || 'You have no archived memories yet. Add a moment and ask again.';
    }

    const latestMemory = memories[0];
    const sortedByLength = [...memories].sort((a, b) => b.description.length - a.description.length);
    const favoriteMemory = sortedByLength[0];

    const hasAny = (terms: string[]) => terms.some((term) => normalized.includes(term));

    if (hasAny(['how many', 'total', 'count', 'number of', 'how much'])) {
      return `You currently have ${memories.length} archived ${memories.length === 1 ? 'memory' : 'memories'}.`;
    }

    if (hasAny(['recent', 'latest', 'newest', 'last'])) {
      return `Your most recent archived memory is ${formatMemorySummary(latestMemory)}.`;
    }

    if (hasAny(['favorite', 'best', 'special', 'memorable', 'important'])) {
      return `One of your most meaningful memories is ${formatMemorySummary(favoriteMemory)}.`;
    }

    const keywords = normalized.match(/\w+/g) || [];
    const matches = memories.filter((story) =>
      keywords.some((keyword) =>
        story.title.toLowerCase().includes(keyword) || story.description.toLowerCase().includes(keyword)
      )
    );

    if (matches.length) {
      const firstMatches = matches.slice(0, 3).map((story) => formatMemorySummary(story));
      return `I found ${matches.length} matching memory${matches.length === 1 ? '' : 'ies'} related to your question:\n\n${firstMatches.join('\n\n')}`;
    }

    if (generalAnswer) {
      return generalAnswer;
    }

    const topMemories = memories.slice(0, 3).map((story) => formatMemorySummary(story));
    return `I couldn't find a direct match for that question, but here are your latest archived memories:\n\n${topMemories.join('\n\n')}`;
  };

  const handleAskMemoryAI = async () => {
    const trimmedQuestion = aiQuestion.trim();
    if (!trimmedQuestion) {
      Alert.alert('Ask a question', 'Please enter a memory-related question first.');
      return;
    }

    setAiResponse('');
    setAiLoading(true);
    const openAiAnswer = await getOpenAIAnswer(trimmedQuestion);
    let answer = openAiAnswer;

    if (!answer) {
      answer = generateMemoryResponse(trimmedQuestion, stories);
    }

    setAiResponse(answer);
    setAiLoading(false);
  };

  const filteredStories = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    const normalized = searchQuery.trim().toLowerCase();
    return stories.filter((item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.description.toLowerCase().includes(normalized)
    );
  }, [stories, searchQuery]);

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0f172a', '#111827'] : colorScheme === 'system' ? ['#fef3c7', '#fef08a'] : ['#f0f9ff', '#f3f4f6']}
      style={styles.gradientContainer}
    >
      <View style={styles.container}>
        <View style={[styles.aiContainer, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}> 
          <Text style={[styles.aiTitle, { color: colors.text }]}>GROQ AI</Text>
          <Text style={[styles.aiDescription, { color: colors.text, opacity: 0.8 }]}>Ask anything about memories, archiving, stories, or how to preserve moments over time.</Text>
          <TextInput
            style={[styles.aiInput, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f8fafc', color: colors.text, borderColor: colors.borderColor }]}
            placeholder="Ask GROQ anything..."
            placeholderTextColor={colors.text + '80'}
            value={aiQuestion}
            onChangeText={(text) => {
              setAiQuestion(text);
              if (aiResponse) setAiResponse('');
            }}
            returnKeyType="send"
            onSubmitEditing={handleAskMemoryAI}
          />
          <TouchableOpacity
            style={[styles.aiButton, { backgroundColor: '#fff59d', borderColor: '#facc15', borderWidth: 1, opacity: aiLoading ? 0.6 : 1 }]}
            onPress={handleAskMemoryAI}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <ActivityIndicator color="#1f2937" />
            ) : (
              <Text style={[styles.aiButtonText, { color: '#1f2937' }]}>Ask GROQ</Text>
            )}
          </TouchableOpacity>
          {aiResponse ? (
            <View style={[styles.aiResponseContainer, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f8fafc', borderColor: colors.borderColor }]}> 
              <Text style={[styles.aiResponseTitle, { color: colors.text }]}>GROQ Answer</Text>
              <Text style={[styles.aiResponseText, { color: colors.text }]}>{aiResponse}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerContainer}>
           <Text style={[styles.headerTitle, { color: colors.text }]}>Memories</Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.borderColor }]}
            placeholder="Search memories..."
            placeholderTextColor={colors.text + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={filteredStories}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <FontAwesome name="inbox" size={40} color={colors.tint} />
                    <Text style={[styles.emptyText, { color: colors.text, opacity: 0.7 }]}>No memories found</Text>
                </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
                {item.media_url && (
                  <TouchableOpacity onPress={() => router.push(`/memory/${item.id}`)}>
                    {isVideoUrl(item.media_url) ? (
                      <Video
                        source={{ uri: item.media_url }}
                        style={styles.cardImage}
                        useNativeControls
                        resizeMode={ResizeMode.COVER}
                        isLooping={false}
                      />
                    ) : (
                      <Image source={{ uri: item.media_url }} style={styles.cardImage} />
                    )}
                  </TouchableOpacity>
                )}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardText, { color: colors.text, opacity: 0.7 }]} numberOfLines={2}>{item.description}</Text>
                  <Text style={[styles.cardDate, { color: colors.text, opacity: 0.5 }]}>{new Date(item.created_at).toLocaleString()}</Text>
                  {getSongTitle(item) && (
                    <View style={styles.songContainer}>
                      <Text style={[styles.songTitle, { color: colors.text, opacity: 0.6 }]}>Song: {getSongTitle(item)}</Text>
                      <TouchableOpacity onPress={() => playSong(item.song_url!, item.id)} style={styles.playButton}>
                        <FontAwesome name={playingSongId === item.id ? 'pause' : 'play'} size={14} color={colors.tint} />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={() => router.push(`/memory/${item.id}`)} style={styles.actionBtn}>
                        <FontAwesome name="edit" size={14} color={colors.tint} />
                        <Text style={[styles.actionText, { color: colors.tint }]}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}

        <TouchableOpacity style={[styles.fabButton, { backgroundColor: colors.tint }]} onPress={() => router.push('/delete')}>
            <FontAwesome name="trash" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1, paddingTop: 24 },
  headerContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 34, fontWeight: '900', marginBottom: 8 },
  headerSubtitle: { fontSize: 15, lineHeight: 22 },
  aiContainer: { marginHorizontal: 20, marginTop: 12, marginBottom: 18, borderRadius: 24, padding: 20, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 5 }, shadowRadius: 14, elevation: 4 },
  aiTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  aiDescription: { fontSize: 14, marginBottom: 16, lineHeight: 22 },
  aiInput: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  aiButton: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14 },
  aiButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  aiResponseContainer: { marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1 },
  aiResponseTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  aiResponseText: { fontSize: 14, lineHeight: 22 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 18 },
  searchInput: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, fontSize: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 120, gap: 10 },
  emptyText: { fontSize: 16 },
  listContent: { paddingHorizontal: 15, paddingBottom: 140 },
  card: { borderRadius: 20, marginBottom: 18, overflow: 'hidden', borderWidth: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18 },
  cardImage: { width: '100%', height: 190 },
  cardContent: { padding: 20 },
  cardTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  cardText: { fontSize: 15, marginBottom: 12, lineHeight: 22 },
  cardDate: { fontSize: 12, marginBottom: 12 },
  actionButtons: { flexDirection: 'row', gap: 18, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontWeight: '600', fontSize: 14 },
  songContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  songTitle: { fontSize: 12, flex: 1 },
  playButton: { padding: 4 },
  fabButton: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 }
});