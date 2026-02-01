/**
 * Private Presale API Routes
 */

const express = require('express');
const router = express.Router();
const PrivatePresaleService = require('../services/presale/PrivatePresaleService');

// Initialize service
let presaleService = null;

const getPresaleService = (req) => {
  if (!presaleService) {
    presaleService = new PrivatePresaleService(req.app.get('logger'));
  }
  return presaleService;
};

/**
 * POST /api/v1/presale/create
 * Create a new private presale
 */
router.post('/create', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const presaleConfig = req.body;
    
    // Validate required fields
    if (!presaleConfig.tokenAddress || !presaleConfig.totalAllocation) {
      return res.status(400).json({
        error: 'Missing required fields: tokenAddress, totalAllocation'
      });
    }
    
    const result = await service.createPresale(presaleConfig);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/presale/:presaleId/commit
 * Submit a commitment to participate
 */
router.post('/:presaleId/commit', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const { presaleId } = req.params;
    const { commitment, nullifier, identityCommitment, identityProof } = req.body;
    
    if (!commitment || !nullifier) {
      return res.status(400).json({
        error: 'Missing required fields: commitment, nullifier'
      });
    }
    
    const result = await service.submitCommitment(presaleId, {
      commitment,
      nullifier,
      identityCommitment,
      identityProof
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/presale/:presaleId/reveal
 * Reveal a commitment
 */
router.post('/:presaleId/reveal', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const { presaleId } = req.params;
    const { amount, secret, nullifier, stealthAddress } = req.body;
    
    if (!amount || !secret || !nullifier || !stealthAddress) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }
    
    const result = await service.revealCommitment(presaleId, {
      amount,
      secret,
      nullifier,
      stealthAddress
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/presale/:presaleId
 * Get presale status
 */
router.get('/:presaleId', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const { presaleId } = req.params;
    
    const status = service.getPresaleStatus(presaleId);
    
    if (!status) {
      return res.status(404).json({
        error: 'Presale not found'
      });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/presale
 * List active presales
 */
router.get('/', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const presales = service.listActivePresales();
    res.json({ presales });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/presale/:presaleId/claim
 * Claim vested tokens
 */
router.post('/:presaleId/claim', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const { presaleId } = req.params;
    const { nullifier, stealthAddress } = req.body;
    
    if (!nullifier || !stealthAddress) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }
    
    const result = await service.claimVestedTokens(presaleId, nullifier, stealthAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/presale/commitment
 * Generate a commitment hash
 */
router.post('/commitment', async (req, res, next) => {
  try {
    const service = getPresaleService(req);
    const { amount, secret } = req.body;
    
    if (!amount || !secret) {
      return res.status(400).json({
        error: 'Amount and secret required'
      });
    }
    
    const commitment = service.computeCommitment(amount, secret);
    res.json({ commitment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
