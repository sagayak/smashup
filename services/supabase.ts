
import { createClient } from '@supabase/supabase-js';
import { Profile, Tournament, Team, Match, CreditLog } from '../types';

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return (window as any).process?.env?.[key] || '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = !!supabase;

const mapUsernameToEmail = (username: string) => `${username.toLowerCase().trim()}@shuttleup.internal`;

export const dbService = {
  auth: {
    signUp: async (username: string, fullName: string, role: string, password?: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const email = mapUsernameToEmail(username);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || "shuttleup123",
        options: { data: { username: username.toLowerCase(), full_name: fullName, role } }
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username: username.toLowerCase(),
          full_name: fullName,
          role,
          credits: 500
        });
      }
      return data;
    },
    signIn: async (username: string, password?: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: mapUsernameToEmail(username),
        password: password || "shuttleup123"
      });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      return profile as Profile;
    },
    signOut: () => supabase?.auth.signOut()
  },
  profiles: {
    updateCredits: async (userId: string, amount: number, desc: string, action: string) => {
      if (!supabase) return;
      await supabase.rpc('update_credits', {
        target_id: userId,
        delta: amount,
        log_desc: desc,
        log_action: action
      });
    }
  },
  tournaments: {
    create: async (data: Partial<Tournament>, organizerId: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const shareId = `SHTL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: tournament, error } = await supabase.from('tournaments').insert({
        name: data.name,
        description: data.description,
        location_name: data.location_name,
        start_date: data.start_date,
        latitude: data.latitude,
        longitude: data.longitude,
        share_id: shareId,
        organizer_id: organizerId,
        status: 'published'
      }).select().single();
      if (error) throw error;
      await dbService.profiles.updateCredits(organizerId, -200, `Hosted Tournament: ${data.name}`, 'deduct');
      return tournament as Tournament;
    }
  },
  matches: {
    updateScore: async (id: string, score1: number, score2: number) => {
      if (!supabase) return;
      await supabase.from('matches').update({ score1, score2 }).eq('id', id);
    },
    complete: async (id: string) => {
      if (!supabase) return;
      await supabase.from('matches').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    }
  }
};
