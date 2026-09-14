import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase project URL must be the base URL, not the REST endpoint.
const supabaseUrl = 'https://hwvxfmndmdtpzvsxisgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dnhmbW5kbWR0cHp2c3hpc2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTc3OTIsImV4cCI6MjA5Mzc5Mzc5Mn0.qsJT6TnJ-SXA9s03GrNmmlvszbUkwXXHk-Vrz_n6R8c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});
export const AVATAR_BUCKET = 'avatars';
export const MEMORY_PHOTOS_BUCKET = 'memory-photos';
export const MEMORY_SONGS_BUCKET = 'memory-songs';
