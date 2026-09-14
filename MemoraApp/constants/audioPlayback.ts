import { Audio } from 'expo-av';

type PlaybackListener = (storyId: string | null) => void;

let currentSound: Audio.Sound | null = null;
let currentStoryId: string | null = null;
const listeners = new Set<PlaybackListener>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(currentStoryId));
};

export const subscribeToAudioPlayback = (listener: PlaybackListener) => {
  listeners.add(listener);
  listener(currentStoryId);

  return () => {
    listeners.delete(listener);
  };
};

export const stopAudioPlayback = async () => {
  const sound = currentSound;
  currentSound = null;
  currentStoryId = null;
  notifyListeners();

  if (sound) {
    try {
      await sound.unloadAsync();
    } catch (error) {
      console.warn('Audio unload cleanup error:', error);
    }
  }
};

export const toggleAudioPlayback = async (songUrl: string, storyId: string) => {
  if (currentSound && currentStoryId === storyId) {
    await stopAudioPlayback();
    return;
  }

  await stopAudioPlayback();

  const { sound } = await Audio.Sound.createAsync(
    { uri: songUrl },
    { shouldPlay: true }
  );
  currentSound = sound;
  currentStoryId = storyId;
  notifyListeners();

  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      stopAudioPlayback().catch((error) => {
        console.error('Audio cleanup error:', error);
      });
    }
  });
};
