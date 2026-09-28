const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { validateEnvironment } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const db = require('./config/db');

const app = express();
app.disable('x-powered-by');

// 1. Trust proxy when behind reverse proxy
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 2. Security HTTP Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 3. CORS Configuration
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : defaultDevOrigins;

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*'))
      ) {
        return callback(null, true);
      }
      const corsError = new Error('Not allowed by CORS.');
      corsError.status = 403;
      return callback(corsError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 4. Request Limiters and Parsers
app.use(apiLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'campus-complaint-api',
    environment: process.env.NODE_ENV || 'development',
  });
});

// 6. API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/studentComplaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// 7. 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// 8. Centralized Error Handler with Production Sanitization
app.use((err, _req, res, _next) => {
  // Log error details on server side without leaking sensitive data
  console.error('Unhandled server error:', {
    message: err.message,
    status: err.status || 500,
    code: err.code,
  });

  // Handle SyntaxError from malformed JSON payloads
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Malformed JSON payload in request body.' });
  }

  // Handle client-level 4xx errors
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  const databaseUnavailableCodes = new Set([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
  ]);

  if (
    err.message?.startsWith('Missing MySQL configuration:') ||
    err.message?.startsWith('DB_PORT must be') ||
    databaseUnavailableCodes.has(err.code)
  ) {
    return res.status(503).json({
      message: 'Service is temporarily unavailable due to a database connection issue. Please try again shortly.',
    });
  }

  // Never expose raw SQL errors, stack traces, or internal paths in responses
  return res.status(500).json({ message: 'An unexpected internal server error occurred.' });
});

// 9. Graceful Server Startup & Lifecycle Management
if (require.main === module) {
  try {
    const config = validateEnvironment();
    const server = app.listen(config.port, () => {
      console.log(`[CampusCare API] Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`[CampusCare API] Received ${signal}. Starting graceful shutdown...`);
      if (server?.closeAllConnections) server.closeAllConnections();
      server.close(async () => {
        console.log('[CampusCare API] HTTP server closed.');
        try {
          await db.end();
          console.log('[CampusCare API] Database connections drained.');
        } catch (dbErr) {
          console.error('[CampusCare API] Error draining database connections:', dbErr.message);
        }
        process.exit(0);
      });

      // Force exit after 10s if shutdown hangs
      setTimeout(() => {
        console.error('[CampusCare API] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (startupError) {
    console.error('[CampusCare API] Fatal configuration error during startup:', startupError.message);
    process.exit(1);
  }
}

module.exports = app;
