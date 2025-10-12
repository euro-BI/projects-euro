// MIGRADO PARA NOVA INSTÂNCIA - 2024-12-12
// Cliente principal agora usa a nova instância do Supabase
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://rzdepoejfchewvjzojan.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZGVwb2VqZmNoZXd2anpvamFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODM4NTIsImV4cCI6MjA3NTg1OTg1Mn0.hRwcQaZsT8wuDofhwrLvoXRjH0p2bXejjmqdqglHU7g";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});