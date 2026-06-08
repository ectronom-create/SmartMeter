import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();

const supabase = createClient(url, key);

async function checkDiagnostics() {
  const res = await supabase.from("error_codes").select("*").eq("stage_id", "STG-01");
  const filtered = res.data?.filter(e => e.code.startsWith("-6")) || [];
  console.log("Details of all STG-01 codes starting with -6:");
  console.log(JSON.stringify(filtered.map(e => ({ code: e.code, title_en: e.title_en, description: e.description })), null, 2));
}

checkDiagnostics();
