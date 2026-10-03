import mongoose from 'mongoose';
import dns from 'dns';

// Ensure cloud container environments (Render/Linux) can resolve external Atlas hostnames
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch {
  // Ignore if running in a restricted sandbox
}

const DIRECT_REPLICA_URI = 'mongodb://241fa07004_db_user:5LQDEc8yuZRbqoLd@ac-sizguus-shard-00-00.vz6sekr.mongodb.net:27017,ac-sizguus-shard-00-01.vz6sekr.mongodb.net:27017,ac-sizguus-shard-00-02.vz6sekr.mongodb.net:27017/multivendor_ecommerce?ssl=true&replicaSet=atlas-tv07rm-shard-0&authSource=admin&retryWrites=true&w=majority';
const CLOUD_ATLAS_SRV_URI = 'mongodb+srv://241fa07004_db_user:5LQDEc8yuZRbqoLd@cluster0.vz6sekr.mongodb.net/multivendor_ecommerce?retryWrites=true&w=majority';

let isRetrying = false;

export const connectionAttemptsLog = [];

export const connectDB = async () => {
  // If already connected, do nothing
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  const configuredUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
  const isCloudOrProd = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER) || Boolean(process.env.VERCEL);

  const uriCandidates = [];

  // 1. If user explicitly provided a non-localhost URI in Render environment variables
  if (configuredUri && !configuredUri.includes('127.0.0.1') && !configuredUri.includes('localhost')) {
    uriCandidates.push(configuredUri);
  }

  // 2. Direct replica set URI (fastest, most reliable in cloud containers, bypasses SRV lookup)
  uriCandidates.push(DIRECT_REPLICA_URI);

  // 3. Atlas SRV URI
  uriCandidates.push(CLOUD_ATLAS_SRV_URI);

  // 4. Local MongoDB (only attempted when running locally, never on Render)
  if (!isCloudOrProd) {
    if (configuredUri) uriCandidates.push(configuredUri);
    uriCandidates.push('mongodb://127.0.0.1:27017/multivendor_ecommerce');
    uriCandidates.push('mongodb://localhost:27017/multivendor_ecommerce');
  }

  const uniqueUris = [...new Set(uriCandidates.filter(Boolean))];

  let isConnected = false;

  for (const uri of uniqueUris) {
    const safeDisplayUri = uri.replace(/:([^@]+)@/, ':****@');
    try {
      console.log(`🔌 Attempting MongoDB connection to: ${safeDisplayUri}...`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000
      });

      console.log(`===========================================================`);
      console.log(`✅ [MongoDB Connected]: Successfully connected to database!`);
      console.log(`📡 Host:     ${conn.connection.host}`);
      console.log(`📂 Database: ${conn.connection.name}`);
      console.log(`🔗 Endpoint: ${safeDisplayUri}`);
      console.log(`===========================================================`);

      connectionAttemptsLog.push({ uri: safeDisplayUri, success: true, host: conn.connection.host, time: new Date().toISOString() });
      isConnected = true;
      break;
    } catch (error) {
      console.warn(`⚠️ [MongoDB Connection Attempt]: Failed connecting to ${safeDisplayUri}: ${error.message}`);
      connectionAttemptsLog.push({ uri: safeDisplayUri, success: false, error: error.message, time: new Date().toISOString() });
    }
  }

  if (!isConnected) {
    console.error(`===========================================================`);
    console.error(`❌ [MongoDB Error]: Could not establish a connection to MongoDB.`);
    console.error(`👉 Solution Checklist:`);
    console.error(`  1. Ensure MongoDB Atlas Network Access has 0.0.0.0/0 (Allow access from anywhere).`);
    console.error(`  2. In Render Dashboard -> novakart -> Environment, set MONGO_URI to your Atlas URI.`);
    console.error(`  3. Auto-reconnect worker is active in the background and will keep trying.`);
    console.error(`===========================================================`);

    // Launch background auto-reconnect worker if not already running
    if (!isRetrying) {
      isRetrying = true;
      const retryInterval = setInterval(async () => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(retryInterval);
          isRetrying = false;
          return;
        }
        console.log(`🔄 [MongoDB Auto-Reconnect Worker]: Retrying database connection...`);
        const ok = await connectDB();
        if (ok) {
          clearInterval(retryInterval);
          isRetrying = false;
        }
      }, 7000);
    }
  }

  // Register Connection Lifecycle Handlers
  mongoose.connection.on('disconnected', () => {
    console.warn(`⚠️ [MongoDB Warning]: Connection disconnected. Attempting auto-reconnect...`);
  });

  mongoose.connection.on('reconnected', () => {
    console.log(`🔄 [MongoDB]: Auto-reconnected to database.`);
  });

  return isConnected;
};
