/**
 * ZK Identity API Routes
 */

const express = require('express');
const router = express.Router();
const ZKIdentityService = require('../services/identity/ZKIdentityService');

// Initialize service
let identityService = null;

const getIdentityService = (req) => {
  if (!identityService) {
    identityService = new ZKIdentityService(req.app.get('logger'));
  }
  return identityService;
};

/**
 * POST /api/v1/identity/twitter/init
 * Initialize Twitter OAuth flow
 */
router.post('/twitter/init', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { callbackUrl } = req.body;
    
    if (!callbackUrl) {
      return res.status(400).json({
        error: 'Callback URL required'
      });
    }
    
    const result = service.initiateTwitterVerification(callbackUrl);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/identity/twitter/callback
 * Process OAuth callback and generate proofs
 */
router.post('/twitter/callback', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { sessionId, code, userData } = req.body;
    
    if (!sessionId || !userData) {
      return res.status(400).json({
        error: 'Session ID and user data required'
      });
    }
    
    const proofs = await service.processOAuthCallback(sessionId, code, userData);
    res.json(proofs);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/identity/verify
 * Verify a proof against requirements
 */
router.post('/verify', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { proof, requirements } = req.body;
    
    if (!proof || !requirements) {
      return res.status(400).json({
        error: 'Proof and requirements required'
      });
    }
    
    const result = await service.verifyProof(proof, requirements);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/identity/use
 * Mark a proof as used (for sybil resistance)
 */
router.post('/use', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { nullifier } = req.body;
    
    if (!nullifier) {
      return res.status(400).json({
        error: 'Nullifier required'
      });
    }
    
    service.markProofUsed(nullifier);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/identity/reputation/add
 * Add reputation points
 */
router.post('/reputation/add', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { commitment, action } = req.body;
    
    if (!commitment || !action) {
      return res.status(400).json({
        error: 'Commitment and action required'
      });
    }
    
    const result = await service.buildReputation(commitment, action);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/identity/reputation/:commitment
 * Get reputation score
 */
router.get('/reputation/:commitment', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { commitment } = req.params;
    
    const score = service.getReputation(commitment);
    res.json({ commitment, score });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/identity/reputation/proof
 * Generate a reputation proof
 */
router.post('/reputation/proof', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const { commitment, minScore } = req.body;
    
    if (!commitment || !minScore) {
      return res.status(400).json({
        error: 'Commitment and minimum score required'
      });
    }
    
    const proof = await service.generateReputationProof(commitment, minScore);
    
    if (!proof) {
      return res.status(400).json({
        error: 'Insufficient reputation score'
      });
    }
    
    res.json(proof);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/identity/thresholds
 * Get available proof thresholds
 */
router.get('/thresholds', async (req, res, next) => {
  try {
    const service = getIdentityService(req);
    const thresholds = service.getThresholds();
    res.json(thresholds);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
