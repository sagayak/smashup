
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
        credit_logs: []
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

      // In a real app, 'password' would be hashed here.
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
            const data = this.getData()[table];
            const item = data.find((i: any) => i[col] === val);
            return { data: item || null, error: item ? null : { message: "SQL Result: 0 rows" } };
          },
          order: (colOrder: string, { ascending }: { ascending: boolean }) => ({
            then: async (resolve: any) => {
              const data = this.getData()[table].filter((i: any) => i[col] === val);
              data.sort((a: any, b: any) => ascending ? (a[colOrder] > b[colOrder] ? 1 : -1) : (a[colOrder] < b[colOrder] ? 1 : -1));
              resolve({ data, error: null });
            }
          })
        }),
        order: (col: string, { ascending }: { ascending: boolean }) => ({
          then: async (resolve: any) => {
            const data = [...this.getData()[table]];
            data.sort((a: any, b: any) => ascending ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1));
            resolve({ data, error: null });
          }
        }),
        async then(resolve: any) {
          const data = this.getData()[table];
          resolve({ data, error: null });
        }
      }),

      insert: (record: any) => ({
        select: () => ({
          single: async () => {
            const data = this.getData();
            const newRecord = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record };
            data[table].push(newRecord);
            this.saveData(data);
            syncChannel.postMessage({ event: `${table.toUpperCase()}_UPDATE`, payload: newRecord });
            return { data: newRecord, error: null };
          }
        }),
        async then(resolve: any) {
          const data = this.getData();
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
            data[table] = data[table].map((item: any) => 
              item[col] === val ? { ...item, ...updates } : item
            );
            this.saveData(data);
            syncChannel.postMessage({ event: `${table.toUpperCase()}_UPDATE`, payload: { id: val, ...updates } });
            resolve({ error: null });
          }
        })
      })
    };
  }

  rpc = async (name: string, params: any) => {
    if (name === 'update_user_credits') {
      const data = this.getData();
      const profile = data.profiles.find((p: Profile) => p.id === params.target_user_id);
      if (profile) {
        // Atomic transaction simulation
        profile.credits += params.amount_change;
        data.credit_logs.push({
          id: crypto.randomUUID(),
          user_id: params.target_user_id,
          amount: params.amount_change,
          action_type: params.log_action,
          description: params.log_description,
          created_at: new Date().toISOString()
        });
        this.saveData(data);

        // Update session if user is currently logged in
        const session = localStorage.getItem(this.sessionKey);
        if (session) {
          const user = JSON.parse(session);
          if (user.id === profile.id) {
            user.credits = profile.credits;
            localStorage.setItem(this.sessionKey, JSON.stringify(user));
          }
        }

        syncChannel.postMessage({ event: 'CREDIT_UPDATE', payload: profile });
        return { error: null };
      }
      return { error: { message: "User not found in cluster." } };
    }
    return { error: { message: "SQL Function not found." } };
  };

  channel(name: string) {
    return {
      on: (type: string, filter: any, callback: Function) => {
        const handler = (e: any) => {
          if (e.data.event === filter.table.toUpperCase() + '_UPDATE') {
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
