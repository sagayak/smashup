
/**
 * ShuttleUp Database Service
 * Dedicated for CockroachDB Serverless Data API.
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

// --- COCKROACHDB DATA API CONFIGURATION ---
const COCKROACH_CONFIG = {
  ENABLED: false, 
  BASE_URL: 'https://api.cockroachlabs.cloud/v1/clusters/981e97c4-344d-4f2c-a9e9-d726f27f6b83/sql',
  API_KEY: 'CCDB1_2saEIW8Qkw8WCo09DvbO9c_zhu4T1zHTImuNmpDpsFabVBE6fpGvWH2HCxQb4LW',
  CLUSTER_NAME: 'badminton',
  DATABASE: 'defaultdb'
};
// ------------------------------------------

class CockroachService {
  private sessionKey = 'shuttleup_session';
  private storageKey = 'shuttleup_cockroach_store';

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;
    const defaults = {
      profiles: [],
      tournaments: [],
      teams: [],
      matches: [],
      credit_logs: [],
      tournament_participants: [],
      team_members: []
    };
    
    try {
      const existing = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      Object.keys(defaults).forEach(key => {
        if (!Array.isArray(existing[key])) existing[key] = (defaults as any)[key];
      });
      localStorage.setItem(this.storageKey, JSON.stringify(existing));
    } catch (e) {
      localStorage.setItem(this.storageKey, JSON.stringify(defaults));
    }
  }

  private getData() {
    const raw = localStorage.getItem(this.storageKey);
    const data = JSON.parse(raw || '{}');
    const tables = ['profiles', 'tournaments', 'teams', 'matches', 'credit_logs', 'tournament_participants', 'team_members'];
    tables.forEach(t => { if (!Array.isArray(data[t])) data[t] = []; });
    return data;
  }

  private saveData(data: any) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  private async execute(sql: string, params: any = {}): Promise<{ data: any; error: any }> {
    if (!COCKROACH_CONFIG.ENABLED) {
      return this.executeMock(sql, params);
    }

    try {
      const response = await fetch(COCKROACH_CONFIG.BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COCKROACH_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ database: COCKROACH_CONFIG.DATABASE, statement: sql })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Database link failed.');
      return { data: result.rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  private async executeMock(sql: string, params: any): Promise<any> {
    const data = this.getData();
    
    if (sql.includes('INSERT INTO team_members')) {
        const match = sql.match(/VALUES \('(.+?)', '(.+?)'\)/);
        if (match) {
            const [_, tid, uid] = match;
            const exists = (data.team_members || []).find((tm: any) => tm.team_id === tid && tm.user_id === uid);
            if (!exists) {
                const newMember = { id: crypto.randomUUID(), team_id: tid, user_id: uid, created_at: new Date().toISOString() };
                data.team_members.push(newMember);
                this.saveData(data);
                return { data: [newMember], error: null };
            }
        }
    }

    if (sql.includes('INSERT INTO teams')) {
        const match = sql.match(/INSERT INTO teams \((.+?)\) VALUES \((.+?)\)/);
        if (match) {
            const keys = match[1].split(', ').map(k => k.trim());
            const vals = match[2].split(', ').map(v => v.trim().replace(/'/g, ''));
            const newTeam: any = { id: crypto.randomUUID(), created_at: new Date().toISOString(), points: 0, wins: 0, losses: 0 };
            keys.forEach((k, i) => newTeam[k] = vals[i]);
            data.teams.push(newTeam);
            this.saveData(data);
            return { data: [newTeam], error: null };
        }
    }

    if (sql.includes('INSERT INTO tournament_participants')) {
        const match = sql.match(/VALUES \('(.+?)', '(.+?)', '(.+?)'\)/);
        if (match) {
            const [_, tid, uid, status] = match;
            const exists = (data.tournament_participants || []).find((tp: any) => tp.tournament_id === tid && tp.user_id === uid);
            if (!exists) {
                const newPart = { id: crypto.randomUUID(), tournament_id: tid, user_id: uid, status, created_at: new Date().toISOString() };
                data.tournament_participants.push(newPart);
                this.saveData(data);
                return { data: [newPart], error: null };
            }
        }
    }

    if (sql.includes('SELECT') && sql.includes('FROM profiles')) {
      const parts = sql.split('WHERE ');
      if (parts.length > 1) {
          const condition = parts[1].replace(/;/g, '').trim();
          if (condition.includes('username =')) {
              const username = condition.split("'")[1];
              const user = data.profiles.find((p: any) => p.username === username);
              return { data: user ? [user] : [], error: null };
          }
          if (condition.includes('id =')) {
              const id = condition.split("'")[1];
              const user = data.profiles.find((p: any) => p.id === id);
              return { data: user ? [user] : [], error: null };
          }
      }
      return { data: data.profiles, error: null };
    }

    if (sql.includes('SELECT') && sql.includes('tournaments')) {
      return { data: data.tournaments, error: null };
    }

    return { data: [], error: null };
  }

  auth = {
    signUp: async ({ options, password }: { email: string, password?: string, options: any }) => {
      const { username, full_name, role } = options.data;
      const data = this.getData();
      if (data.profiles.find((p: any) => p.username === username.toLowerCase())) {
        return { error: { message: "Username already exists." } };
      }
      const newUser: Profile = {
        id: crypto.randomUUID(),
        username: username.toLowerCase(),
        full_name,
        role: role as UserRole,
        credits: 500,
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
      if (!profile) return { error: { message: "Invalid credentials." } };
      const user = { ...profile };
      delete user.password_hash;
      localStorage.setItem(this.sessionKey, JSON.stringify(user));
      return { data: { user }, error: null };
    },

    signOut: async () => { localStorage.removeItem(this.sessionKey); },

    getSession: async () => {
      const sessionStr = localStorage.getItem(this.sessionKey);
      const user = sessionStr ? JSON.parse(sessionStr) : null;
      return { data: { session: user ? { user } : null } };
    }
  };

  from(table: string) {
    const service = this;
    return {
      select: (columns: string = '*') => ({
        eq: (col: string, val: any) => ({
          single: async () => {
            const { data, error } = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${val}' LIMIT 1`);
            return { data: data?.[0] || null, error: error || (data?.length === 0 ? { message: 'Row not found' } : null) };
          },
          then: async (resolve: any) => {
            const result = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${val}'`);
            resolve(result);
          }
        }),
        then: async (resolve: any) => {
          const result = await service.execute(`SELECT ${columns} FROM ${table}`);
          resolve(result);
        }
      }),
      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            const keys = Object.keys(record).join(', ');
            const vals = Object.values(record).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
            const { data, error } = await service.execute(`INSERT INTO ${table} (${keys}) VALUES (${vals}) RETURNING *`);
            return { data: data?.[0], error };
          }
        }),
        then: async (resolve: any) => {
            const keys = Object.keys(record).join(', ');
            const vals = Object.values(record).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
            const result = await service.execute(`INSERT INTO ${table} (${keys}) VALUES (${vals}) RETURNING *`);
            resolve(result);
        }
      })
    };
  }

  rpc = async (name: string, params: any) => {
    const data = this.getData();
    if (name === 'get_tournament_details_advanced') {
      const tId = params.tournament_id;
      const tournament = data.tournaments.find((t: any) => t.id === tId);
      if (!tournament) return { data: null, error: { message: "Tournament not found" } };
      
      const participants = (data.tournament_participants || [])
        .filter((tp: any) => tp.tournament_id === tId)
        .map((tp: any) => {
          const p = data.profiles.find((u: any) => u.id === tp.user_id);
          return { ...tp, username: p?.username, full_name: p?.full_name };
        });

      const teams = (data.teams || [])
        .filter((t: any) => t.tournament_id === tId)
        .map((t: any) => {
            const members = (data.team_members || [])
                .filter((tm: any) => tm.team_id === t.id)
                .map((tm: any) => {
                    const p = data.profiles.find((u: any) => u.id === tm.user_id);
                    return { ...tm, username: p?.username, full_name: p?.full_name };
                });
            return { ...t, members, member_count: members.length };
        });

      const matches = (data.matches || [])
        .filter((m: any) => m.tournament_id === tId)
        .map((m: any) => {
            const t1 = teams.find(t => t.id === m.team1_id);
            const t2 = teams.find(t => t.id === m.team2_id);
            return { ...m, team1_name: t1?.name, team2_name: t2?.name };
        });
      
      return { 
        data: { tournament, participants, teams, matches }, 
        error: null 
      };
    }
    
    if (name === 'update_user_credits') {
      const { target_user_id, amount_change } = params;
      const profiles = data.profiles.map((p: any) => 
        p.id === target_user_id ? { ...p, credits: p.credits + amount_change } : p
      );
      data.profiles = profiles;
      this.saveData(data);
      return { data: profiles.find((p:any) => p.id === target_user_id), error: null };
    }

    return { data: null, error: { message: "Procedure not mapped." } };
  };

  channel() { return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }; }
  removeChannel() {}
}

export const supabase = new CockroachService() as any;
export const mapUsernameToEmail = (username: string) => `${username.toLowerCase()}@shuttleup.local`;
