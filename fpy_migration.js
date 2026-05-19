import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();
const supabase = createClient(url, key);

async function migrateFPYTable() {
  console.log("⏳ Creating fpy_reports table in Supabase...");
  
  const sql = `
    CREATE TABLE IF NOT EXISTS fpy_reports (
      id SERIAL PRIMARY KEY,
      date DATE UNIQUE NOT NULL,
      product VARCHAR(255) NOT NULL,
      target INT NOT NULL DEFAULT 320,
      overall_fpy NUMERIC,
      total_boards INT,
      achieved INT,
      stations JSONB NOT NULL DEFAULT '[]',
      defects JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE fpy_reports ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Enable all read access for fpy_reports" ON fpy_reports;
    CREATE POLICY "Enable all read access for fpy_reports" ON fpy_reports FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Enable all write access for fpy_reports" ON fpy_reports;
    CREATE POLICY "Enable all write access for fpy_reports" ON fpy_reports FOR ALL USING (true);

    GRANT ALL ON TABLE fpy_reports TO anon;
    GRANT ALL ON TABLE fpy_reports TO authenticated;
    GRANT ALL ON SEQUENCE fpy_reports_id_seq TO anon;
    GRANT ALL ON SEQUENCE fpy_reports_id_seq TO authenticated;
    
    NOTIFY pgrst, 'reload schema';
  `;

  // We execute this via the REST endpoint indirectly if we had the service key, 
  // but since we only have anon key, we cannot execute arbitrary DDL natively through supabase-js v2
  // So I will just instruct the user to run this small script in the SQL editor, while I update the React component!
}
