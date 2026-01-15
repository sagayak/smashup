
import { createClient } from '@supabase/supabase-js';
import { Profile, Tournament, Team, Match, CreditLog } from '../types';

const supabaseUrl = "https://yvbvcmfonnbhzwhrzbxt.supabase.co";
const supabaseAnonKey = "sb_publishable_t3kSHlUw6PyrywqBgZlRUA_w7DFBIPY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = true;

export const dbService = {
  auth: {
    signUp: async (email: string, username: string, fullName: string, role: string, password?: string) => {
      // Validate email format on client side to prevent Supabase 400 errors
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new Error("Invalid email address format.");

      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || "shuttleup123",
        options: { 
          data: { 
            username: username.toLowerCase().trim(), 
            full_name: fullName, 
            role 
          } 
        }
      });
      if (error) throw error;
      return data;
    },
    signIn: async (email: string, password?: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || "shuttleup123"
      });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          throw new Error("ACCESS BLOCKED: Please disable 'Confirm email' in your Supabase Auth Settings.");
        }
        throw error;
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (profileError) throw new Error("Profile node not yet synchronized. Please try logging in again in a few seconds.");
      return profile as Profile;
    },
    signInWithGoogle: async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Fix: Ensure redirect URI matches exactly what you configure in Google Cloud
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      return data;
    },
    signOut: () => supabase.auth.signOut()
  },
  profiles: {
    updateCredits: async (userId: string, amount: number, desc: string, action: string) => {
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
  teams: {
    create: async (tournamentId: string, name: string) => {
      const { data, error } = await supabase.from('teams').insert({
        tournament_id: tournamentId,
        name,
        points: 0,
        wins: 0,
        losses: 0
      }).select().single();
      if (error) throw error;
      return data as Team;
    }
  },
  matches: {
    create: async (tournamentId: string, team1: Team, team2: Team, scheduledAt: string) => {
      const { data, error } = await supabase.from('matches').insert({
        tournament_id: tournamentId,
        team1_id: team1.id,
        team2_id: team2.id,
        team1_name: team1.name,
        team2_name: team2.name,
        scheduled_at: scheduledAt,
        status: 'live'
      }).select().single();
      if (error) throw error;
      return data as Match;
    },
    updateScore: async (id: string, score1: number, score2: number) => {
      await supabase.from('matches').update({ score1, score2 }).eq('id', id);
    },
    complete: async (match: Match) => {
      const winnerId = match.score1 > match.score2 ? match.team1_id : match.team2_id;
      const loserId = match.score1 > match.score2 ? match.team2_id : match.team1_id;
      
      const { error } = await supabase.rpc('complete_match', {
        m_id: match.id,
        winner_id: winnerId,
        loser_id: loserId
      });
      if (error) throw error;
    }
  }
};
