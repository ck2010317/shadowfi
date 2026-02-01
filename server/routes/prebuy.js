/**
 * Anonymous Pre-buy API Routes
 */

const express = require('express');
const router = express.Router();
const AnonymousPreBuyService = require('../services/prebuy/AnonymousPreBuyService');

// Initialize service
let prebuyService = null;

const getPrebuyService = (req) => {
  if (!prebuyService) {
    prebuyService = new AnonymousPreBuyService(req.app.get('logger'));
    prebuyService.startProcessor();
  }
  return prebuyService;
};

/**
 * POST /api/v1/prebuy/campaign
 * Create a distributed pre-buy campaign
 */
router.post('/campaign', async (req, res, next) => {
  try {
    const service = getPrebuyService(req);
    const campaignConfig = req.body;
    
    // Validate required fields
    if (!campaignConfig.tokenAddress || !campaignConfig.totalAmount || !campaignConfig.creatorCommitment) {
      return res.status(400).json({
        error: 'Missing required fields: tokenAddress, totalAmount, creatorCommitment'
      });
    }
    
    const result = await service.createCampaign(campaignConfig);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prebuy/campaign/:campaignId
 * Get campaign status
 */
router.get('/campaign/:campaignId', async (req, res, next) => {
  try {
    const service = getPrebuyService(req);
    const { campaignId } = req.params;
    const { commitment } = req.query;
    
    if (!commitment) {
      return res.status(400).json({
        error: 'Commitment required for verification'
      });
    }
    
    const status = service.getCampaignStatus(campaignId, commitment);
    
    if (!status) {
      return res.status(404).json({
        error: 'Campaign not found'
      });
    }
    
    if (status.error) {
      return res.status(403).json({
        error: status.error
      });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/prebuy/campaign/:campaignId
 * Cancel a campaign
 */
router.delete('/campaign/:campaignId', async (req, res, next) => {
  try {
    const service = getPrebuyService(req);
    const { campaignId } = req.params;
    const { commitment } = req.body;
    
    if (!commitment) {
      return res.status(400).json({
        error: 'Commitment required'
      });
    }
    
    const result = service.cancelCampaign(campaignId, commitment);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prebuy/stats
 * Get service statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const service = getPrebuyService(req);
    const stats = service.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/prebuy/estimate
 * Estimate campaign parameters
 */
router.post('/estimate', async (req, res, next) => {
  try {
    const { totalAmount, numWallets, distributionStrategy } = req.body;
    
    if (!totalAmount) {
      return res.status(400).json({
        error: 'Total amount required'
      });
    }
    
    const walletCount = numWallets || 10;
    const splitAmount = totalAmount / walletCount;
    
    // Estimate timing
    const estimatedDuration = walletCount * 60000; // ~1 minute per wallet average
    
    res.json({
      totalAmount,
      numWallets: walletCount,
      avgSplitAmount: splitAmount,
      minSplitAmount: splitAmount * 0.85,
      maxSplitAmount: splitAmount * 1.15,
      estimatedDuration,
      estimatedGasCost: walletCount * 0.001, // Simulated
      distributionStrategy: distributionStrategy || 'random'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
