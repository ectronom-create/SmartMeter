import { createClient } from "@supabase/supabase-js";

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

console.log("=== SUPABASE CONFIG DEBUG ===");
console.log("URL:", supabaseUrl);
console.log("Anon Key Length:", supabaseAnonKey?.length || 0);
console.log("Is Configured:", !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== "YOUR_SUPABASE_URL"));
console.log("=============================");

// Export integration state flag
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== "YOUR_SUPABASE_URL");

// Always create Supabase client instance (throws clear network errors instead of null crashes)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseAnonKey || "placeholder-key"
);
