import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://fsmyzpdcmkkirfuomerv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-cLLegmFa_xiLkho-t0A-A_COMTgjrT";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);