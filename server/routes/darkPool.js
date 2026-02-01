/**
 * Dark Pool API Routes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Middleware to get services
const getServices = (req) => ({
  darkPool: req.app.get('darkPoolEngine'),
  logger: req.app.get('logger')
});

/**
 * POST /api/v1/darkpool/order
 * Submit an encrypted order to the dark pool
 */
router.post('/order', async (req, res, next) => {
  try {
    const { darkPool } = getServices(req);
    const { encryptedPayload, commitment, nullifier, tokenAddress, encryptedSide } = req.body;
    
    if (!encryptedPayload || !commitment || !nullifier || !tokenAddress) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }
    
    const result = await darkPool.submitOrder({
      payload: encryptedPayload,
      commitment,
      nullifier,
      tokenAddress,
      encryptedSide
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/darkpool/status/:nullifier
 * Check order status using nullifier (privacy-preserving)
 */
router.get('/status/:nullifier', async (req, res, next) => {
  try {
    const { darkPool } = getServices(req);
    const { nullifier } = req.params;
    
    const status = darkPool.checkMatchStatus(nullifier);
    
    if (!status) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Order not found or not yet matched'
      });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/darkpool/order
 * Cancel an order using nullifier and commitment
 */
router.delete('/order', async (req, res, next) => {
  try {
    const { darkPool } = getServices(req);
    const { nullifier, commitment } = req.body;
    
    if (!nullifier || !commitment) {
      return res.status(400).json({
        error: 'Nullifier and commitment required'
      });
    }
    
    const result = darkPool.cancelOrder(nullifier, commitment);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/darkpool/stats
 * Get anonymized pool statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { darkPool } = getServices(req);
    const stats = darkPool.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/darkpool/pool/:tokenAddress
 * Get pool info for a specific token (anonymized)
 */
router.get('/pool/:tokenAddress', async (req, res, next) => {
  try {
    const { darkPool } = getServices(req);
    const { tokenAddress } = req.params;
    
    const stats = darkPool.getStats();
    const poolInfo = stats.pools[tokenAddress];
    
    if (!poolInfo) {
      return res.json({
        tokenAddress,
        hasPool: false,
        pendingOrders: 0,
        hasLiquidity: false
      });
    }
    
    res.json({
      tokenAddress,
      hasPool: true,
      ...poolInfo
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/darkpool/encrypt
 * Helper endpoint to encrypt order data (client-side recommended)
 */
router.post('/encrypt', async (req, res, next) => {
  try {
    const { orderData, publicKey } = req.body;
    
    // Generate encryption keys
    const iv = crypto.randomBytes(16);
    const key = crypto.randomBytes(32);
    
    // Encrypt order data
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(orderData), 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    // Generate commitment and nullifier
    const secret = crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256')
      .update(JSON.stringify(orderData) + secret)
      .digest('hex');
    const nullifier = crypto.createHash('sha256')
      .update(`nullifier:${secret}`)
      .digest('hex');
    
    // Encrypt side indicator
    const sideBuffer = Buffer.alloc(1);
    sideBuffer[0] = orderData.side === 'buy' ? 0 : 1;
    const encryptedSide = crypto.randomBytes(32);
    encryptedSide[0] = sideBuffer[0];
    
    res.json({
      encryptedPayload: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      commitment,
      nullifier,
      encryptedSide: encryptedSide.toString('base64'),
      // Return secret to client (they need it to claim)
      secret
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
