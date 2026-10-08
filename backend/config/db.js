const { isConfigured, testConnection } = require('./supabase');

const connectDB = async () => {
  console.log('[Database] Initializing Supabase PostgreSQL connection...');
  const result = await testConnection();
  if (result.success) {
    console.log('[Database] Supabase connection established successfully.');
  } else if (result.mode === 'unconfigured') {
    console.log('[Database] Supabase credentials not set or placeholder detected in .env.');
    console.log('[Database] Operating with zero-setup development fallback store for smooth local testing.');
    console.log('[Database] Tip: Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env to connect to live Supabase!');
  } else {
    console.warn(`[Database] Warning during Supabase initialization: ${result.error || 'Check configuration'}`);
  }
};

const disconnectDB = async () => {
  // Supabase client uses stateless HTTP REST / PostgREST connection pools; no persistent socket teardown required.
  console.log('[Database] Database disconnected.');
};

module.exports = { connectDB, disconnectDB };
