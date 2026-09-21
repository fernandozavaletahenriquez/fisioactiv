import { supabaseConfig } from './supabase.config';

export const environment = {
  production: true,
  supabaseUrl: supabaseConfig.supabaseUrl,
  supabaseAnonKey: supabaseConfig.supabaseAnonKey,
};
