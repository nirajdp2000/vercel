import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtnubimeoawyjkvkkxaz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnViaW1lb2F3eWprdmtreGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA3NjkzOCwiZXhwIjoyMDg5NjUyOTM4fQ.Hbh36YJlr0pPUrix97v28JsImgTsADIrsgUHTnGhoXU';
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Decode JWT to get project ref and check expiry
const payload = JSON.parse(Buffer.from(SERVICE_KEY.split('.')[1], 'base64').toString());
console.log('JWT payload:', payload);

// Try Supabase's internal pg endpoint (used by their dashboard)
const pgEndpoints = [
  `${SUPABASE_URL}/pg/query`,
  `${SUPABASE_URL}/pg`,
  `https://xtnubimeoawyjkvkkxaz.supabase.co/rest/v1/`,
];

for (const ep of pgEndpoints) {
  try {
    const r = await axios.post(ep, { query: 'SELECT 1 as test' }, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      timeout: 5000, validateStatus: () => true
    });
    console.log(`${ep}: ${r.status}`, JSON.stringify(r.data).substring(0, 200));
  } catch(e) { console.log(`${ep}: ERROR`, e.message); }
}

// Try creating a function via a POST to /rest/v1/ with special headers
// Supabase service role can bypass RLS — try inserting into pg_catalog via a view
const { data: schemas, error: schErr } = await sb
  .from('information_schema.schemata')
  .select('schema_name');
console.log('\nSchemas:', schErr?.message ?? JSON.stringify(schemas?.map(s => s.schema_name)));

// Check if we can query pg_catalog directly
const { data: pgTables, error: pgErr } = await sb
  .schema('pg_catalog')
  .from('pg_tables')
  .select('tablename,schemaname')
  .eq('schemaname', 'public')
  .limit(20);
console.log('\npg_catalog.pg_tables:', pgErr?.message ?? JSON.stringify(pgTables?.map(t => t.tablename)));
