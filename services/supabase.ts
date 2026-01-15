
/**
 * ShuttleUp Database Service
 * Hybrid Engine: CockroachDB Data API + LocalStorage Fallback
 */

import { Profile, Tournament, Team, Match, CreditLog, UserRole } from '../types';

// --- COCKROACHDB CLOUD CONFIGURATION ---
export const COCKROACH_CONFIG = {
  ENABLED: true, 
  USE_PROXY: true,
  // Primary CORS Proxies (will rotate if one fails)
  PROXIES: [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
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
  private localDbKey = 'shuttleup_local_db';
  private useLocalFallback = localStorage.getItem('shuttleup_force_local') === 'true';

  // --- LOCAL ENGINE (Mimics SQL for Offline/CORS-Blocked usage) ---
  private getLocalData(table: string): any[] {
    const db = JSON.parse(localStorage.getItem(this.localDbKey) || '{}');
    return db[table] || [];
  }

  private saveLocalData(table: string, data: any[]) {
    const db = JSON.parse(localStorage.getItem(this.localDbKey) || '{}');
    db[table] = data;
    localStorage.setItem(this.localDbKey, JSON.stringify(db));
  }

  public setLocalMode(enabled: boolean) {
    this.useLocalFallback = enabled;
    localStorage.setItem('shuttleup_force_local', enabled.toString());
    window.location.reload();
  }

  private async execute(sql: string): Promise<{ data: any; error: any }> {
    if (this.useLocalFallback) {
        return { data: null, error: { message: "LOCAL_MODE: Cloud bypass active." } };
    }

    // Try primary proxy first, then fallback
    for (const proxyBase of COCKROACH_CONFIG.PROXIES) {
        const targetUrl = proxyBase + encodeURIComponent(COCKROACH_CONFIG.BASE_URL);
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${COCKROACH_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    database: COCKROACH_CONFIG.DATABASE, 
                    statement: sql 
                })
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                const msg = result.message || result.error || `Error ${response.status}`;
                if (msg.toLowerCase().includes("does not exist")) {
                    return { data: null, error: { message: "SCHEMA_MISSING: Run database.txt in Cockroach Console." } };
                }
                continue; // Try next proxy
            }

            const result = await response.json();
            return { data: result.rows || [], error: null };
        } catch (e) {
            console.warn(`Proxy ${proxyBase} failed, trying next...`);
            continue;
        }
    }

    return { 
        data: null, 
        error: { 
            message: "CONNECTION_BLOCKED: Browser/Network is blocking CockroachDB. Switch to 'Local Demo Mode' to continue testing features." 
        } 
    };
  }

  auth = {
    signUp: async ({ options, password }: { email: string, password?: string, options: any }) => {
      const { username, full_name, role } = options.data;
      const usernameLower = username.toLowerCase().trim();
      
      if (this.useLocalFallback) {
        const users = this.getLocalData('profiles');
        if (users.find(u => u.username === usernameLower)) return { error: { message: "Username taken locally." } };
        const newUser = { id: crypto.randomUUID(), username: usernameLower, full_name, password_hash: password, role, credits: 500, created_at: new Date().toISOString() };
        users.push(newUser);
        this.saveLocalData('profiles', users);
        return { data: { user: newUser }, error: null };
      }

      const { data: existing, error: checkError } = await this.execute(`SELECT id FROM profiles WHERE username = '${esc(usernameLower)}' LIMIT 1;`);
      if (checkError) return { error: checkError };
      if (existing && existing.length > 0) return { error: { message: "Username taken." } };

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const insertSql = `INSERT INTO profiles (id, username, full_name, password_hash, role, credits, created_at) VALUES ('${id}', '${esc(usernameLower)}', '${esc(full_name)}', '${esc(password)}', '${role}', 500, '${createdAt}') RETURNING *;`;
      const { data, error } = await this.execute(insertSql);
      return { data: data ? { user: data[0] } : null, error };
    },

    signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
      const username = email.split('@')[0].toLowerCase();
      
      if (this.useLocalFallback) {
        const user = this.getLocalData('profiles').find(u => u.username === username && u.password_hash === password);
        if (!user) return { error: { message: "Invalid local credentials." } };
        localStorage.setItem(this.sessionKey, JSON.stringify(user));
        return { data: { user }, error: null };
      }

      const sql = `SELECT * FROM profiles WHERE username = '${esc(username)}' AND password_hash = '${esc(password)}' LIMIT 1;`;
      const { data, error } = await this.execute(sql);
      if (error) return { error };
      if (!data || data.length === 0) return { error: { message: "Invalid credentials." } };
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
            if (service.useLocalFallback) {
                const row = service.getLocalData(table).find(r => r[col] == val);
                return { data: row || null, error: row ? null : { message: 'Not found' } };
            }
            const { data, error } = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${esc(val)}' LIMIT 1;`);
            return { data: data?.[0] || null, error };
          },
          then: async (resolve: any) => {
            if (service.useLocalFallback) {
                const rows = service.getLocalData(table).filter(r => r[col] == val);
                return resolve({ data: rows, error: null });
            }
            const result = await service.execute(`SELECT ${columns} FROM ${table} WHERE ${col} = '${esc(val)}';`);
            resolve(result);
          }
        }),
        then: async (resolve: any) => {
          if (service.useLocalFallback) return resolve({ data: service.getLocalData(table), error: null });
          const result = await service.execute(`SELECT ${columns} FROM ${table};`);
          resolve(result);
        }
      }),
      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            if (service.useLocalFallback) {
                const data = service.getLocalData(table);
                const newRec = { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() };
                data.push(newRec);
                service.saveLocalData(table, data);
                return { data: newRec, error: null };
            }
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
                if (service.useLocalFallback) {
                    const data = service.getLocalData(table).filter(r => r[col] != val);
                    service.saveLocalData(table, data);
                    return resolve({ data: true, error: null });
                }
                const result = await service.execute(`DELETE FROM ${table} WHERE ${col} = '${esc(val)}';`);
                resolve(result);
            }
        })
      })
    };
  }

  rpc = async (name: string, params: any) => {
    if (this.useLocalFallback) {
        if (name === 'update_user_credits') {
            const users = this.getLocalData('profiles');
            const idx = users.findIndex(u => u.id === params.target_user_id);
            if (idx !== -1) {
                users[idx].credits += params.amount_change;
                this.saveLocalData('profiles', users);
                return { data: users[idx], error: null };
            }
        }
        return { data: null, error: { message: "RPC not simulated locally." } };
    }
    
    // Cloud RPC Logic... (existing)
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
        if (!tournament) return { data: null, error: { message: "Not found." } };
        return { data: { tournament, participants: pRes.data, teams: teamsRes.data, matches: matchRes.data }, error: null };
    }
    return { data: null, error: { message: "Cloud Error" } };
  };

  channel() { return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }; }
  removeChannel() {}
}

export const supabase = new CockroachService() as any;
export const mapUsernameToEmail = (username: string) => `${username.toLowerCase()}@shuttleup.local`;
