
import { createClient } from '@supabase/supabase-js';
import { Profile, Tournament, Team, Match, CreditLog } from '../types';

// Safe environment variable access
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) return (window as any).process.env[key];
  return '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Only initialize if keys are present to prevent crash
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = !!supabase;

// Helper to handle username-only auth internally
const mapUsernameToEmail = (username: string) => `${username.toLowerCase().trim()}@shuttleup.internal`;

export const dbService = {
  auth: {
    signUp: async (username: string, fullName: string, role: string, password?: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      
      const { data, error } = await supabase.auth.signUp({
        email: mapUsernameToEmail(username),
        password: password || "shuttleup123",
        options: {
          data: { 
            username: username.toLowerCase(), 
            full_name: fullName, 
            role: role 
          }
        }
      });
      if (error) throw error;
      
      // Manually create profile if trigger is not used
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user!.id,
        username: username.toLowerCase(),
        full_name: fullName,
        role: role,
        credits: 500
      });
      if (profileError) console.error("Profile creation error:", profileError);
      
      return data;
    },
    signIn: async (username: string, password?: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: mapUsernameToEmail(username),
        password: password || "shuttleup123"
      });
      if (error) throw error;
      
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (pError) throw pError;
      return profile as Profile;
    },
    signOut: () => supabase?.auth.signOut()
  },

  profiles: {
    updateCredits: async (userId: string, amount: number, desc: string, action: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.rpc('update_credits', {
        target_id: userId,
        delta: amount,
        log_desc: desc,
        log_action: action
      });
      if (error) throw error;
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

      // Deduct hosting fee
      await dbService.profiles.updateCredits(organizerId, -200, `Hosted Tournament: ${data.name}`, 'deduct');
      
      return tournament as Tournament;
    }
  },

  teams: {
    create: async (tournamentId: string, name: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.from('teams').insert({
        tournament_id: tournamentId,
        name,
        points: 0,
        wins: 0,
        losses: 0
      }).select().single();
      if (error) throw error;
      return data as Team;
    },
    addMember: async (teamId: string, tournamentId: string, user: { id: string, full_name: string, username: string }) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.from('profiles').update({ role: 'player' }).eq('id', user.id);
      if (error) throw error;
    }
  },

  matches: {
    create: async (tournamentId: string, team1: Team, team2: Team, scheduledAt: string) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.from('matches').insert({
        tournament_id: tournamentId,
        team1_id: team1.id,
        team2_id: team2.id,
        scheduled_at: scheduledAt,
        status: 'live'
      }).select().single();
      if (error) throw error;
      return data as Match;
    },
    updateScore: async (id: string, score1: number, score2: number) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.from('matches').update({ score1, score2 }).eq('id', id);
      if (error) throw error;
    },
    complete: async (match: Match) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.from('matches').update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      }).eq('id', match.id);
      if (error) throw error;
      
      // Standings updates logic usually managed via Postgres triggers for high reliability
    }
  }
};
