
import { createClient } from '@supabase/supabase-js';

// ShuttleUp Supabase Configuration
const supabaseUrl = 'https://yvbvcmfonnbhzwhrzbxt.supabase.co';
const supabaseAnonKey = 'sb_publishable_t3kSHlUw6PyrywqBgZlRUA_w7DFBIPY';

/**
 * Supabase Auth requires an identifier (Email or Phone).
 * To provide a "Username-only" experience, we map:
 * 'sagayak' -> 'sagayak@shuttleup.co'
 * 
 * IMPORTANT: In your Supabase Dashboard (Auth > Settings):
 * 1. Disable "Confirm Email"
 * 2. Ensure "Email" provider is enabled
 */
export const mapUsernameToEmail = (username: string) => {
  // Ensure username is clean (lowercase, no special chars)
  const clean = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (!clean) return 'user@shuttleup.co';
  return `${clean}@shuttleup.co`;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
