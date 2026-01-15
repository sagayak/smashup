
/**
 * ShuttleUp Database Service
 * Optimized for CockroachDB Serverless Data API via CORS Proxy.
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

// --- COCKROACHDB DATA API CONFIGURATION ---
export const COCKROACH_CONFIG = {
  ENABLED: true, 
  USE_PROXY: true, // Required for browser-to-CockroachDB communication
  BASE_URL: 'https://api.cockroachlabs.cloud/v1/clusters/981e97c4-344d-4f2c-a9e9-d726f27f6b83/sql',
  API_KEY: 'CCDB1_2saEIW8Qkw8WCo09DvbO9c_zhu4T1zHTImuNmpDpsFabVBE6fpGvWH2HCxQb4LW',
  CLUSTER_NAME: 'badminton',
  DATABASE: 'defaultdb'
};
// ------------------------------------------

const esc = (str: any) => {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
};

class CockroachService {
  private sessionKey = 'shuttleup_session';

  private async execute(sql: string): Promise<{ data: any; error: any }> {
    if (!COCKROACH_CONFIG.ENABLED) {
      return { data: null, error: { message: "Cloud connection disabled." } };
    }

    // Using corsproxy.io which is more reliable for POST + Auth headers
    const targetUrl = COCKROACH_CONFIG.USE_PROXY 
      ? `https://corsproxy.io/?${encodeURIComponent(COCKROACH_CONFIG.BASE_URL)}`
      : COCKROACH_CONFIG.BASE_URL;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COCKROACH_CONFIG.API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          database: COCKROACH_CONFIG.DATABASE, 
          statement: sql 
        })
      });

      if (response.status === 401 || response.status === 403) {
        return { data: null, error: { message: "AUTH_FAILURE: API Key is invalid or restricted. Check Cockroach Console." } };
      }

      const result = await response.json();

      if (!response.ok) {
        const msg = result.message || result.error || `Database Error (${response.status})`;
        // If message contains "table ... does not exist", the user forgot to run SQL
        if (msg.toLowerCase().includes("does not exist")) {
          return { data: null, error: { message: `SCHEMA_MISSING: Table not found. Please run the SQL from database.txt in your CockroachDB SQL Console.` } };
        }
        return { data: null, error: { message: msg, status: response.status } };
      }

      return { data: result.rows || [], error: null };
    } catch (err: any) {
      console.error("Connectivity Diagnostic:", err);
      return { 
        data: null, 
        error: { 
          message: `NETWORK_FAULT: Could not reach the cluster. Possible reasons: 
1. The CORS Proxy is down.
2. Your network blocks requests to CockroachDB.
3. The SQL Schema (database.txt) has not been deployed to the '${COCKROACH_CONFIG.DATABASE}' database.` 
        } 
      };
    }
  }

  auth = {
    signUp: async ({ options, password }: { email: string, password?: string, options: any }) => {
      const { username, full_name, role } = options.data;
      const usernameLower = username.toLowerCase().trim();
      
      const checkSql = `SELECT id FROM profiles WHERE username = '${esc(usernameLower)}' LIMIT 1;`;
      const { data: existing, error: checkError } = await this.execute(checkSql);
      
      if (checkError) return { error: checkError };
      if (existing && existing.length > 0) {
        return { error: { message: "Username already taken." } };
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const insertSql = `
        INSERT INTO profiles (id, username, full_name, password_hash, role, credits, created_at) 
        VALUES ('${id}', '${esc(usernameLower)}', '${esc(full_name)}', '${esc(password)}', '${role}', 500, '${createdAt}') 
        RETURNING id, username, full_name, role, credits, created_at;
      `;
      
      const { data, error: insertError } = await this.execute(insertSql);
      if (insertError) return { error: insertError };
      
      return { data: { user: data[0] }, error: null };
    },

    signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
      const username = email.split('@')[0].toLowerCase();
      const sql = `SELECT id, username, full_name, role, credits, created_at FROM profiles WHERE username = '${esc(username)}' AND password_hash = '${esc(password)}' LIMIT 1;`;
      
      const { data, error } = await this.execute(sql);
      if (error) return { error };
      if (!data || data.length === 0) return { error: { message: "Invalid credentials." } };

      const user = data[0];
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
            const { data, error } = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${esc(val)}' LIMIT 1;`);
            return { data: data?.[0] || null, error: error || (data?.length === 0 ? { message: 'Row not found' } : null) };
          },
          then: async (resolve: any) => {
            const result = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${esc(val)}';`);
            resolve(result);
          }
        }),
        then: async (resolve: any) => {
          const result = await service.execute(`SELECT ${columns} FROM ${table};`);
          resolve(result);
        }
      }),
      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            const keys = Object.keys(record).join(', ');
            const vals = Object.values(record).map(v => typeof v === 'string' ? `'${esc(v)}'` : v).join(', ');
            const { data, error } = await service.execute(`INSERT INTO ${table} (${keys}) VALUES (${vals}) RETURNING *;`);
            return { data: data?.[0], error };
          }
        })
      }),
      delete: () => ({
        eq: (col: string, val: any) => ({
            then: async (resolve: any) => {
                const result = await service.execute(`DELETE FROM ${table} WHERE ${col} = '${esc(val)}';`);
                resolve(result);
            }
        })
      })
    };
  }

  rpc = async (name: string, params: any) => {
    if (name === 'get_tournament_details_advanced') {
      const tId = params.tournament_id;
      const [tRes, pRes, teamsRes, matchRes, profRes, tmRes] = await Promise.all([
        this.execute(`SELECT * FROM tournaments WHERE id = '${esc(tId)}' LIMIT 1;`),
        this.execute(`SELECT * FROM tournament_participants WHERE tournament_id = '${esc(tId)}';`),
        this.execute(`SELECT * FROM teams WHERE tournament_id = '${esc(tId)}';`),
        this.execute(`SELECT * FROM matches WHERE tournament_id = '${esc(tId)}';`),
        this.execute(`SELECT id, username, full_name FROM profiles;`),
        this.execute(`SELECT tm.*, p.username, p.full_name FROM team_members tm JOIN profiles p ON tm.user_id = p.id;`)
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

      return { data: { tournament, participants, teams, matches }, error: null };
    }
    
    if (name === 'update_user_credits') {
      const { target_user_id, amount_change, log_description, log_action } = params;
      const sql = `UPDATE profiles SET credits = credits + ${amount_change} WHERE id = '${esc(target_user_id)}' RETURNING *;`;
      const { data, error } = await this.execute(sql);
      
      if (!error && data && data.length > 0) {
        const logSql = `INSERT INTO credit_logs (id, user_id, amount, action_type, description, created_at) VALUES ('${crypto.randomUUID()}', '${esc(target_user_id)}', ${amount_change}, '${esc(log_action)}', '${esc(log_description)}', '${new Date().toISOString()}');`;
        await this.execute(logSql);
        return { data: data[0], error: null };
      }
      return { data: null, error: error || { message: "Credit update failed." } };
    }

    return { data: null, error: { message: "RPC Error" } };
  };

  channel() { return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }; }
  removeChannel() {}
}

export const supabase = new CockroachService() as any;
export const mapUsernameToEmail = (username: string) => `${username.toLowerCase()}@shuttleup.local`;
