const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Ensure environment variables are loaded
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
// Priority: SUPABASE_SERVICE_ROLE_KEY (bypasses RLS on backend) -> SUPABASE_KEY -> SUPABASE_ANON_KEY
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const isPlaceholder =
  !supabaseUrl ||
  !supabaseKey ||
  supabaseUrl.includes('your-project-id') ||
  supabaseUrl.includes('your-supabase-url') ||
  supabaseKey.includes('your-supabase');

let supabase = null;
let isConfigured = !isPlaceholder;
let isLive = false;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Could not instantiate Supabase client:', err.message);
    supabase = null;
    isConfigured = false;
  }
}

/**
 * Test Supabase database connection and update live status
 */
async function testConnection() {
  if (!isConfigured || !supabase) {
    isLive = false;
    return { success: false, mode: 'unconfigured' };
  }

  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      if (
        error.code === '42P01' ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST205' ||
        (error.message && error.message.includes('Could not find the table'))
      ) {
        console.warn('⚠️  [Supabase] Connected to live Supabase project!');
        console.warn('⚠️  [Supabase] The "users" table has not been created yet in your Supabase database.');
        console.warn('⚠️  [Supabase] Action required: Copy & paste "supabase_schema.sql" into your Supabase SQL Editor and click RUN.');
        isLive = false;
        return { success: false, tableMissing: true, error: error.message };
      }
      console.warn(`⚠️  [Supabase] Query error against Supabase: ${error.message}`);
      isLive = false;
      return { success: false, error: error.message };
    }
    isLive = true;
    console.log('✅ [Supabase] Successfully connected to live Supabase PostgreSQL database.');
    return { success: true, mode: 'connected' };
  } catch (err) {
    console.warn(`⚠️  [Supabase] Network/connection check failed: ${err.message}`);
    isLive = false;
    return { success: false, error: err.message };
  }
}

function getIsLive() {
  return isConfigured && isLive && supabase !== null;
}

module.exports = {
  supabase,
  isConfigured,
  getIsLive,
  testConnection,
};
