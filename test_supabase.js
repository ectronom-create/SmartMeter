import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();

const supabase = createClient(url, key);

async function checkDiagnostics() {
  console.log("🔍 Checking Shift Types...");
  const shiftRes = await supabase.from("shift_types").select("*");
  console.log("Shift_Types result:", shiftRes.error ? "❌ " + shiftRes.error.message : "✅ Success");

  console.log("🔍 Checking Users...");
  const usersRes = await supabase.from("users").select("*");
  console.log("Users result:", usersRes.error ? "❌ " + usersRes.error.message : "✅ Success");
}

checkDiagnostics();
