import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side client — uses anon key, respects public-read RLS policies
export const supabase = createClient(supabaseUrl, supabaseAnon);
