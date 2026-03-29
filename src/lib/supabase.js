import { createClient } from '@supabase/supabase-js';

// Vite inlines these at build time from VITE_ prefixed env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cbspstyxdqtimliwabbw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic3BzdHl4ZHF0aW1saXdhYmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjAyNzYsImV4cCI6MjA5MDMzNjI3Nn0.zl17XlIp-zzq8ngZGqRT2oDGr_Lz-qWDtf33kIICaQM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
