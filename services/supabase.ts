
/**
 * ShuttleUp Database Service
 * Strictly Cloud-Driven: CockroachDB Data API via Resilient Proxy Rotation
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

// --- COCKROACHDB CLOUD CONFIGURATION ---
export const COCKROACH_CONFIG = {
  ENABLED: true, 
  // Prioritized list of proxies for handling Authorization headers
  PROXIES: [
    '', // Attempt direct connection first (some environments allow it)
    'https://api.allorigins.win/raw?url=', // High reliability
    'https://api.codetabs.com/v1/proxy?quest=', // Good performance
    'https://thingproxy.freeboard.io/fetch/', // Old but gold
    'https://corsproxy.io/?' // Last resort
  ],
  BASE_URL: 'https://api.cockroachlabs.cloud/v1/clusters/981e97c4-344d-4f2c-a9e9-d726f27f6b83/sql',
  API_KEY: 'CCDB1_2saEIW8Qkw8WCo09DvbO9c_zhu4T1zHTImuNmpDpsFabVBE6fpGvWH2HCxQb4LW',
  CLUSTER_NAME: 'badminton',
  DATABASE: 'defaultdb'
};

const esc = (str: any) => {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
};

class CockroachService {
  private sessionKey = 'shuttleup_session';

  private async execute(sql: string): Promise<{ data: any; error: any }> {
    let lastError = "";

    for (const proxyBase of COCKROACH_CONFIG.PROXIES) {
        const isDirect = proxyBase === '';
        const targetUrl = isDirect ? COCKROACH_CONFIG.BASE_URL : proxyBase + encodeURIComponent(COCKROACH_CONFIG.BASE_URL);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), isDirect ? 2000 : 8000); 

            const response = await fetch(targetUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Authorization': `Bearer ${COCKROACH_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    database: COCKROACH_CONFIG.DATABASE, 
                    statement: sql 
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                lastError = result.message || result.error || `HTTP ${response.status}`;
                continue; 
            }

            const result = await response.json();
            return { data: result.rows || [], error: null };
        } catch (e: any) {
            lastError = e.name === 'AbortError' ? 'Connection timed out' : e.message;
            console.warn(`Connection via [${proxyBase || 'DIRECT'}] failed:`, lastError);
            continue;
        }
    }

    return { 
        data: null, 
        error: { 
            message: `ARENA_LINK_FAILED: No stable path to CockroachDB cloud. Diagnostic: ${lastError}.`
        } 
    };
  }

  auth = {
    signUp: async ({ options, password }: { email: string, password?: string, options: any }) => {
      const { username, full_name, role } = options.data;
      const usernameLower = username.toLowerCase().trim();
      
      const { data: existing, error: checkError } = await this.execute(`SELECT id FROM profiles WHERE username = '${esc(usernameLower)}' LIMIT 1;`);
      if (checkError) return { error: checkError };
      if (existing && existing.length > 0) return { error: { message: "Username already exists in the Arena." } };

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const insertSql = `INSERT INTO profiles (id, username, full_name, password_hash, role, credits, created_at) VALUES ('${id}', '${esc(usernameLower)}', '${esc(full_name)}', '${esc(password)}', '${role}', 500, '${createdAt}') RETURNING *;`;
      const { data, error } = await this.execute(insertSql);
      return { data: data ? { user: data[0] } : null, error };
    },

    signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
      const username = email.split('@')[0].toLowerCase();
      const sql = `SELECT * FROM profiles WHERE username = '${esc(username)}' AND password_hash = '${esc(password)}' LIMIT 1;`;
      const { data, error } = await this.execute(sql);
      if (error) return { error };
      if (!data || data.length === 0) return { error: { message: "Invalid credentials. Please verify your username and password." } };
      localStorage.setItem(this.sessionKey, JSON.stringify(data[0]));
      return { data: { user: data[0] }, error: null };
    },

    signOut: async () => { localStorage.removeItem(this.sessionKey); },
    getSession: async () => {
      const sessionStr = localStorage.getItem(this.sessionKey);
      return { data: { session: sessionStr ? { user: JSON.parse(sessionStr) } : null } };
    }
  };

  from(table: string) {
    const service = this;
    return {
      select: (columns: string = '*') => ({
        eq: (col: string, val: any) => ({
          single: async () => {
            const { data, error } = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${esc(val)}' LIMIT 1;`);
            return { data: data?.[0] || null, error };
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
        const [tRes, pRes, teamsRes, matchRes] = await Promise.all([
          this.execute(`SELECT * FROM tournaments WHERE id = '${esc(tId)}' LIMIT 1;`),
          this.execute(`SELECT * FROM tournament_participants WHERE tournament_id = '${esc(tId)}';`),
          this.execute(`SELECT * FROM teams WHERE tournament_id = '${esc(tId)}';`),
          this.execute(`SELECT * FROM matches WHERE tournament_id = '${esc(tId)}';`)
        ]);
        const tournament = tRes.data?.[0];
        if (!tournament) return { data: null, error: { message: "Tournament node not found." } };
        return { data: { tournament, participants: pRes.data, teams: teamsRes.data, matches: matchRes.data }, error: null };
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
      return { data: null, error: error || { message: "Credit transaction failed." } };
    }

    return { data: null, error: { message: "Cloud Operation Error" } };
  };

  channel() { return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }; }
  removeChannel() {}
}

export const supabase = new CockroachService() as any;
export const mapUsernameToEmail = (username: string) => `${username.toLowerCase()}@shuttleup.local`;
