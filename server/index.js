/**
 * ShadowFi - Privacy-First Token Launch Platform
 * Main Server Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston');

// Import routes
const tokenRoutes = require('./routes/token');
const anonswapRoutes = require('./routes/anonswap');
const relayerRoutes = require('./routes/productionRelayer');

// Import services
const AnoncoinService = require('./services/anoncoin/AnoncoinService');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for dev
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  // Don't log sensitive data
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip ? req.ip.replace(/^.*:/, '') : 'unknown' // Anonymize IP
  });
  next();
});

// Initialize services
const anoncoinService = new AnoncoinService(logger, null);

// Make services available to routes
app.set('anoncoinService', anoncoinService);
app.set('logger', logger);
app.set('io', io);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'ShadowFi',
    timestamp: new Date().toISOString(),
    features: {
      anonymousSwaps: true,
      stealthAddresses: true,
      stealthTokenLaunch: true
    }
  });
});

// API Routes
app.use('/api/v1/token', tokenRoutes);
app.use('/api/v1/anonswap', anonswapRoutes);
app.use('/api/v1/relayer', relayerRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🌑 ShadowFi server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;
