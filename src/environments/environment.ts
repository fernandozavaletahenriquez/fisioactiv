import { supabaseConfig } from './supabase.config';

export const environment = {
  production: false,
  supabaseUrl: supabaseConfig.supabaseUrl,
  supabaseAnonKey: supabaseConfig.supabaseAnonKey,
};
