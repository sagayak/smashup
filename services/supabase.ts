
import { createClient } from '@supabase/supabase-js';

// ShuttleUp Supabase Configuration
const supabaseUrl = 'https://yvbvcmfonnbhzwhrzbxt.supabase.co';
const supabaseAnonKey = 'sb_publishable_t3kSHlUw6PyrywqBgZlRUA_w7DFBIPY';

/**
 * ShuttleUp uses Username + Password authentication.
 * Internally, we map `username` to `username@example.com`.
 * @example.com is a reserved domain that passes all strict email validation checks
 * in Supabase/GoTrue because it is a valid, existing TLD.
 */
export const mapUsernameToEmail = (username: string) => {
  // Sanitize: only alphanumeric, lowercase
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `${cleanUsername}@example.com`;
};

// Initialize the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!supabase) {
  console.warn(
    "ShuttleUp: Supabase client failed to initialize. " +
    "Check your connection and credentials."
  );
}
