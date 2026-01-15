
/**
 * ShuttleUp Database Service
 * Dedicated for CockroachDB Serverless Data API.
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

// --- COCKROACHDB DATA API CONFIGURATION ---
export const COCKROACH_CONFIG = {
  ENABLED: true, // CLOUD BACKEND ENABLED
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
      // Data API returns { rows: [...] }
      return { data: result.rows || [], error: null };
    } catch (err: any) {
      console.error("Database Execution Error:", err);
      return { data: null, error: err };
    }
  }

  private async executeMock(sql: string, params: any): Promise<any> {
    const data = this.getData();
    
    // Auth related mock
    if (sql.includes('SELECT * FROM profiles WHERE username =')) {
        const username = sql.match(/username = '(.+?)'/)?.[1];
        const user = data.profiles.find((p: any) => p.username === username);
        return { data: user ? [user] : [], error: null };
    }

    if (sql.includes('INSERT INTO profiles')) {
        const match = sql.match(/VALUES \('(.+?)', '(.+?)', '(.+?)', '(.+?)', '(.+?)', (.+?), '(.+?)'\)/);
        if (match) {
            const [_, id, username, full_name, password_hash, role, credits, created_at] = match;
            const newUser = { id, username, full_name, password_hash, role, credits: parseInt(credits), created_at };
            data.profiles.push(newUser);
            this.saveData(data);
            return { data: [newUser], error: null };
        }
    }

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
      const usernameLower = username.toLowerCase();
      
      // Check existing
      const { data: existing } = await this.execute(`SELECT * FROM profiles WHERE username = '${usernameLower}'`);
      if (existing && existing.length > 0) {
        return { error: { message: "Username already exists in the cluster." } };
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const sql = `INSERT INTO profiles (id, username, full_name, password_hash, role, credits, created_at) VALUES ('${id}', '${usernameLower}', '${full_name}', '${password}', '${role}', 500, '${createdAt}') RETURNING *`;
      
      const { data, error } = await this.execute(sql);
      if (error) return { error };
      
      return { data: { user: data[0] }, error: null };
    },

    signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
      const username = email.split('@')[0].toLowerCase();
      const sql = `SELECT * FROM profiles WHERE username = '${username}' AND password_hash = '${password}' LIMIT 1`;
      
      const { data, error } = await this.execute(sql);
      if (error) return { error };
      if (!data || data.length === 0) return { error: { message: "Invalid credentials." } };

      const user = { ...data[0] };
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
      }),
      delete: () => ({
        eq: (col: string, val: any) => ({
            then: async (resolve: any) => {
                const result = await service.execute(`DELETE FROM ${table} WHERE ${col} = '${val}'`);
                resolve(result);
            }
        })
      })
    };
  }

  rpc = async (name: string, params: any) => {
    if (name === 'get_tournament_details_advanced') {
      const tId = params.tournament_id;
      
      // Sequential queries for cloud, combined in memory
      const [tRes, pRes, teamsRes, matchRes, profRes, tmRes] = await Promise.all([
        this.execute(`SELECT * FROM tournaments WHERE id = '${tId}' LIMIT 1`),
        this.execute(`SELECT * FROM tournament_participants WHERE tournament_id = '${tId}'`),
        this.execute(`SELECT * FROM teams WHERE tournament_id = '${tId}'`),
        this.execute(`SELECT * FROM matches WHERE tournament_id = '${tId}'`),
        this.execute(`SELECT id, username, full_name FROM profiles`),
        this.execute(`SELECT tm.*, p.username, p.full_name FROM team_members tm JOIN profiles p ON tm.user_id = p.id`)
      ]);

      const tournament = tRes.data?.[0];
      if (!tournament) return { data: null, error: { message: "Tournament node not found." } };

      const allProfiles = profRes.data || [];
      const participants = (pRes.data || []).map((tp: any) => {
        const p = allProfiles.find((u: any) => u.id === tp.user_id);
        return { ...tp, username: p?.username, full_name: p?.full_name };
      });

      const teams = (teamsRes.data || []).map((t: any) => {
        const members = (tmRes.data || []).filter((tm: any) => tm.team_id === t.id);
        return { ...t, members, member_count: members.length };
      });

      const matches = (matchRes.data || []).map((m: any) => {
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
      const { target_user_id, amount_change, log_description, log_action } = params;
      
      const sql = `UPDATE profiles SET credits = credits + ${amount_change} WHERE id = '${target_user_id}' RETURNING *`;
      const { data, error } = await this.execute(sql);
      
      if (!error && data && data.length > 0) {
        // Log it as well
        const logSql = `INSERT INTO credit_logs (id, user_id, amount, action_type, description, created_at) VALUES ('${crypto.randomUUID()}', '${target_user_id}', ${amount_change}, '${log_action}', '${log_description}', '${new Date().toISOString()}')`;
        await this.execute(logSql);
        return { data: data[0], error: null };
      }
      return { data: null, error: error || { message: "User not found or credit update failed." } };
    }

    return { data: null, error: { message: "Remote Procedure Call not mapped for this environment." } };
  };

  channel() { return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }; }
  removeChannel() {}
}

export const supabase = new CockroachService() as any;
export const mapUsernameToEmail = (username: string) => `${username.toLowerCase()}@shuttleup.local`;
