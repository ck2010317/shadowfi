/**
 * Stealth Address API Routes
 * 
 * REAL privacy feature for:
 * - Generating stealth meta-addresses
 * - Creating one-time stealth addresses for receiving
 * - Scanning for incoming stealth payments
 * - Stealth token launches (hidden creator)
 */

const express = require('express');
const router = express.Router();
const StealthAddressService = require('../services/privacy/StealthAddressService');

// Initialize service
let stealthService = null;

const getStealthService = (req) => {
  if (!stealthService) {
    stealthService = new StealthAddressService(req.app.get('logger'));
  }
  return stealthService;
};

/**
 * POST /api/v1/stealth/generate-meta-address
 * Generate a new stealth meta-address (one-time setup for user)
 */
router.post('/generate-meta-address', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const metaAddress = service.generateStealthMetaAddress();
    
    // WARNING: Private keys included - user must save these securely!
    res.json({
      success: true,
      warning: 'SAVE YOUR PRIVATE KEYS SECURELY! They cannot be recovered.',
      metaAddress: {
        // Public - can be shared
        metaAddress: metaAddress.metaAddress,
        spendingPubKey: metaAddress.spendingPubKey,
        viewingPubKey: metaAddress.viewingPubKey,
        
        // Private - MUST BE SAVED BY USER
        spendingPrivKey: metaAddress.spendingPrivKey,
        viewingPrivKey: metaAddress.viewingPrivKey,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/stealth/generate-address
 * Generate a one-time stealth address for sending to someone
 */
router.post('/generate-address', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const { recipientMetaAddress } = req.body;
    
    if (!recipientMetaAddress) {
      return res.status(400).json({
        error: 'recipientMetaAddress is required'
      });
    }
    
    const stealthAddress = service.generateStealthAddress(recipientMetaAddress);
    
    res.json({
      success: true,
      stealthAddress: stealthAddress.stealthAddress,
      announcement: stealthAddress.announcement,
      viewTag: stealthAddress.viewTag
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/stealth/scan
 * Scan for incoming stealth payments
 */
router.post('/scan', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const { viewingPrivKey, spendingPubKey, announcements } = req.body;
    
    if (!viewingPrivKey || !spendingPubKey) {
      return res.status(400).json({
        error: 'viewingPrivKey and spendingPubKey are required'
      });
    }
    
    // If no announcements provided, get all from registry
    const announcementsToScan = announcements || service.getAllAnnouncements();
    
    const detected = service.scanForPayments(
      viewingPrivKey,
      spendingPubKey,
      announcementsToScan
    );
    
    res.json({
      success: true,
      scanned: announcementsToScan.length,
      detected: detected.length,
      payments: detected
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/stealth/token-launch
 * Create a stealth token launch (hidden creator)
 */
router.post('/token-launch', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const logger = req.app.get('logger');
    const { tokenConfig, creatorMetaAddress } = req.body;
    
    if (!tokenConfig || !tokenConfig.name || !tokenConfig.symbol) {
      return res.status(400).json({
        error: 'tokenConfig with name and symbol is required'
      });
    }
    
    if (!creatorMetaAddress) {
      return res.status(400).json({
        error: 'creatorMetaAddress is required for stealth launch'
      });
    }
    
    // Generate stealth data for the creator
    const stealthLaunch = await service.createStealthTokenLaunch(
      tokenConfig,
      creatorMetaAddress
    );
    
    // Now launch the token via Anoncoin with stealth creator address
    const AnoncoinService = require('../services/anoncoin/AnoncoinService');
    const anoncoinService = new AnoncoinService(logger, req.app.get('mixnetRouter'));
    
    const deployResult = await anoncoinService.deployToken({
      ...stealthLaunch.tokenConfig,
      image: tokenConfig.image
    });
    
    // Store announcement for later scanning
    if (deployResult.success && deployResult.mintAddress) {
      service.storeAnnouncement(stealthLaunch.announcement, deployResult.mintAddress);
    }
    
    res.json({
      success: deployResult.success,
      token: {
        address: deployResult.mintAddress,
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        transactionSignature: deployResult.transactionSignature,
        broadcasted: deployResult.broadcasted
      },
      privacy: {
        type: 'stealth-launch',
        creatorHidden: true,
        stealthAddress: stealthLaunch.royaltyAddress,
        announcement: stealthLaunch.announcement,
        message: 'Creator identity is hidden. Save your meta-address keys to claim royalties later.'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/stealth/store-announcement
 * Store a stealth announcement in the registry
 */
router.post('/store-announcement', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const { announcement, tokenAddress } = req.body;
    
    if (!announcement || !tokenAddress) {
      return res.status(400).json({
        error: 'announcement and tokenAddress are required'
      });
    }
    
    const key = service.storeAnnouncement(announcement, tokenAddress);
    
    res.json({
      success: true,
      key,
      message: 'Announcement stored. Creator can scan for it later.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/stealth/announcements/:tokenAddress
 * Get all stealth announcements for a token
 */
router.get('/announcements/:tokenAddress', async (req, res, next) => {
  try {
    const service = getStealthService(req);
    const { tokenAddress } = req.params;
    
    const announcements = service.getAnnouncementsForToken(tokenAddress);
    
    res.json({
      success: true,
      tokenAddress,
      announcements
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
