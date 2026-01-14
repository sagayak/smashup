
/**
 * ShuttleUp CockroachDB Service
 * Distributed SQL-ready service layer.
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

const syncChannel = new BroadcastChannel('shuttleup_sync');

class CockroachDBService {
  private storageKey = 'shuttleup_cockroach_store';
  private sessionKey = 'shuttleup_session';

  constructor() {
    this.init();
  }

  private init() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify({
        profiles: [],
        tournaments: [],
        teams: [],
        matches: [],
        credit_logs: [],
        tournament_participants: [],
        team_members: []
      }));
    }
  }

  private getData() {
    return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
  }

  private saveData(data: any) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  auth = {
    signUp: async ({ options, password }: { email: string, password?: string, options: any }) => {
      const { username, full_name, role } = options.data;
      const data = this.getData();
      
      if (data.profiles.find((p: any) => p.username === username.toLowerCase())) {
        return { error: { message: "Username already exists in CockroachDB cluster." } };
      }

      const newUser: Profile = {
        id: crypto.randomUUID(),
        username: username.toLowerCase(),
        full_name,
        role: role as UserRole,
        credits: 500, // Initial credits
        created_at: new Date().toISOString()
      };

      (newUser as any).password_hash = password; 

      data.profiles.push(newUser);
      this.saveData(data);
      return { data: { user: newUser }, error: null };
    },

    signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
      const username = email.split('@')[0].toLowerCase();
      const data = this.getData();
      const profile = data.profiles.find((p: any) => p.username === username && p.password_hash === password);

      if (!profile) return { error: { message: "Invalid username or password." } };
      
      const sessionUser = { ...profile };
      delete sessionUser.password_hash;
      
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionUser));
      return { data: { user: sessionUser }, error: null };
    },

    signOut: async () => {
      localStorage.removeItem(this.sessionKey);
    },

    getSession: async () => {
      const session = localStorage.getItem(this.sessionKey);
      return { data: { session: session ? { user: JSON.parse(session) } : null } };
    }
  };

  from(table: string) {
    return {
      select: (query?: string) => ({
        eq: (col: string, val: any) => ({
          single: async () => {
            const data = this.getData()[table] || [];
            const item = data.find((i: any) => i[col] === val);
            return { data: item || null, error: item ? null : { message: "SQL Result: 0 rows" } };
          },
          order: (colOrder: string, { ascending }: { ascending: boolean }) => ({
            then: async (resolve: any) => {
              const data = (this.getData()[table] || []).filter((i: any) => i[col] === val);
              data.sort((a: any, b: any) => ascending ? (a[colOrder] > b[colOrder] ? 1 : -1) : (a[colOrder] < b[colOrder] ? 1 : -1));
              resolve({ data, error: null });
            }
          })
        }),
        order: (col: string, { ascending }: { ascending: boolean }) => ({
          then: async (resolve: any) => {
            const data = [...(this.getData()[table] || [])];
            data.sort((a: any, b: any) => ascending ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1));
            resolve({ data, error: null });
          }
        }),
        async then(resolve: any) {
          const data = this.getData()[table] || [];
          resolve({ data, error: null });
        }
      }),

      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            const data = this.getData();
            if (!data[table]) data[table] = [];
            const newRecord = { 
              id: crypto.randomUUID(), 
              created_at: new Date().toISOString(), 
              ...(table === 'tournaments' ? { share_id: 'SHTL-' + Math.random().toString(36).substring(2, 6).toUpperCase() } : {}),
              ...record 
            };
            data[table].push(newRecord);
            this.saveData(data);
            syncChannel.postMessage({ event: `${table.toUpperCase()}_UPDATE`, payload: newRecord });
            return { data: newRecord, error: null };
          }
        }),
        async then(resolve: any) {
          const data = this.getData();
          if (!data[table]) data[table] = [];
          const newRecord = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record };
          data[table].push(newRecord);
          this.saveData(data);
          syncChannel.postMessage({ event: `${table.toUpperCase()}_UPDATE`, payload: newRecord });
          resolve({ data: newRecord, error: null });
        }
      }),

      update: (updates: any) => ({
        eq: (col: string, val: any) => ({
          async then(resolve: any) {
            const data = this.getData();
            data[table] = (data[table] || []).map((item: any) => 
              item[col] === val ? { ...item, ...updates } : item
            );
            this.saveData(data);
            syncChannel.postMessage({ event: `${table.toUpperCase()}_UPDATE`, payload: { id: val, ...updates } });
            resolve({ error: null });
          }
        })
      }),

      delete: () => ({
        eq: (col: string, val: any) => ({
          async then(resolve: any) {
            const data = this.getData();
            data[table] = (data[table] || []).filter((item: any) => item[col] !== val);
            this.saveData(data);
            syncChannel.postMessage({ event: `${table.toUpperCase()}_DELETE`, payload: { id: val } });
            resolve({ error: null });
          }
        })
      })
    };
  }

  rpc = async (name: string, params: any) => {
    const data = this.getData();
    
    if (name === 'update_user_credits') {
      const profile = data.profiles.find((p: Profile) => p.id === params.target_user_id);
      if (profile) {
        profile.credits += params.amount_change;
        if (profile.credits < 0) return { error: { message: "Insufficient credits." } };
        
        data.credit_logs.push({
          id: crypto.randomUUID(),
          user_id: params.target_user_id,
          amount: params.amount_change,
          action_type: params.log_action,
          description: params.log_description,
          created_at: new Date().toISOString()
        });
        this.saveData(data);
        syncChannel.postMessage({ event: 'CREDIT_UPDATE', payload: profile });
        return { error: null };
      }
    }

    if (name === 'bulk_add_teams') {
      const { tournament_id, team_names } = params;
      const newTeams = team_names.map((name: string) => ({
        id: crypto.randomUUID(),
        tournament_id,
        name,
        points: 0,
        wins: 0,
        losses: 0,
        created_at: new Date().toISOString()
      }));
      data.teams.push(...newTeams);
      this.saveData(data);
      syncChannel.postMessage({ event: 'TEAMS_UPDATE', payload: newTeams });
      return { data: newTeams, error: null };
    }

    if (name === 'bulk_import_participants_by_username') {
      const { tournament_id, usernames } = params;
      const added = [];
      const notFound = [];

      for (const username of usernames) {
        const profile = data.profiles.find((p: any) => p.username === username.toLowerCase());
        if (profile) {
          const exists = data.tournament_participants.find((tp: any) => tp.tournament_id === tournament_id && tp.user_id === profile.id);
          if (!exists) {
            const newParticipant = {
              id: crypto.randomUUID(),
              tournament_id,
              user_id: profile.id,
              status: 'approved',
              created_at: new Date().toISOString()
            };
            data.tournament_participants.push(newParticipant);
            added.push(username);
          }
        } else {
          notFound.push(username);
        }
      }
      this.saveData(data);
      syncChannel.postMessage({ event: 'PARTICIPANTS_UPDATE', payload: { tournament_id, added } });
      return { data: { added, notFound }, error: null };
    }

    if (name === 'get_tournament_details_advanced') {
      const tournament = data.tournaments.find((t: any) => t.id === params.tournament_id);
      if (!tournament) return { error: "Tournament not found" };

      const participants = data.tournament_participants
        .filter((tp: any) => tp.tournament_id === params.tournament_id)
        .map((tp: any) => {
          const p = data.profiles.find((u: any) => u.id === tp.user_id);
          return { ...tp, username: p?.username, full_name: p?.full_name };
        });

      const teams = data.teams
        .filter((t: any) => t.tournament_id === params.tournament_id)
        .map((t: any) => {
           const members = data.team_members
            .filter((tm: any) => tm.team_id === t.id)
            .map((tm: any) => {
              const p = data.profiles.find((u: any) => u.id === tm.user_id);
              return { ...tm, username: p?.username, full_name: p?.full_name };
            });
           return { ...t, members, member_count: members.length };
        });

      const matches = data.matches
        .filter((m: any) => m.tournament_id === params.tournament_id)
        .map((m: any) => {
           const t1 = teams.find(t => t.id === m.team1_id);
           const t2 = teams.find(t => t.id === m.team2_id);
           return { ...m, team1_name: t1?.name, team2_name: t2?.name };
        });

      return { data: { tournament, participants, teams, matches }, error: null };
    }

    return { error: { message: "SQL Function not found." } };
  };

  channel(name: string) {
    return {
      on: (type: string, filter: any, callback: Function) => {
        const handler = (e: any) => {
          if (e.data.event === filter.table.toUpperCase() + '_UPDATE' || e.data.event === filter.table.toUpperCase() + '_DELETE') {
             callback({ new: e.data.payload });
          }
        };
        syncChannel.addEventListener('message', handler);
        return { subscribe: () => ({ unsubscribe: () => syncChannel.removeEventListener('message', handler) }) };
      },
      subscribe: () => ({})
    };
  }

  removeChannel(channel: any) {}
}

export const supabase = new CockroachDBService() as any;

export const mapUsernameToEmail = (username: string) => {
  return `${username.toLowerCase()}@shuttleup.local`;
};
