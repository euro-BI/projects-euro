import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração da instância principal (atual)
const SUPABASE_URL = "https://kseespnvbkzxxgdjklbi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZWVzcG52Ymt6eHhnZGprbGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODE3MTEsImV4cCI6MjA3NTQ1NzcxMX0.AF24smaQyICKiYQeaJykojCHMniqZJauBwEJpyUMK-8";

// Configuração da segunda instância
const SUPABASE_SECONDARY_URL = import.meta.env.VITE_SUPABASE_SECONDARY_URL;
const SUPABASE_SECONDARY_ANON_KEY = import.meta.env.VITE_SUPABASE_SECONDARY_ANON_KEY;

// Cliente principal (mantém compatibilidade com código existente)
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Cliente secundário para a nova instância
export const supabaseSecondary = createClient(SUPABASE_SECONDARY_URL, SUPABASE_SECONDARY_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Enum para identificar qual instância usar
export enum SupabaseInstance {
  PRIMARY = 'primary',
  SECONDARY = 'secondary'
}

// Função utilitária para obter o cliente correto
export const getSupabaseClient = (instance: SupabaseInstance = SupabaseInstance.PRIMARY) => {
  switch (instance) {
    case SupabaseInstance.PRIMARY:
      return supabase;
    case SupabaseInstance.SECONDARY:
      return supabaseSecondary;
    default:
      return supabase;
  }
};

// Hook personalizado para facilitar o uso
export const useSupabaseClient = (instance: SupabaseInstance = SupabaseInstance.PRIMARY) => {
  return getSupabaseClient(instance);
};

// Exportações para manter compatibilidade
export { supabase as default };