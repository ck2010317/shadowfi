/**
 * Relayer Anonymous Swap API Routes
 * 
 * TRUE anonymous swaps - user's wallet NOT in swap transaction!
 * 
 * Flow:
 * 1. POST /create - Get deposit address and stealth keys
 * 2. User sends SOL/tokens to deposit address
 * 3. Relayer detects deposit and executes swap
 * 4. Tokens arrive at stealth address
 */

const express = require('express');
const router = express.Router();
const RelayerService = require('../services/swap/RelayerService');
const StealthAddressService = require('../services/privacy/StealthAddressService');

// Initialize services
let relayerService = null;
let stealthService = null;

const getServices = (req) => {
  if (!stealthService) {
    stealthService = new StealthAddressService(req.app.get('logger'));
  }
  if (!relayerService) {
    relayerService = new RelayerService(
      req.app.get('logger'),
      stealthService
    );
  }
  return { relayerService, stealthService };
};

/**
 * GET /api/v1/relayer/info
 * Get relayer pool info
 */
router.get('/info', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const balance = await relayerService.getRelayerBalance();
    
    res.json({
      success: true,
      relayer: {
        poolAddress: relayerService.getRelayerPoolAddress(),
        balance: balance,
        feeBps: relayerService.relayerFeeBps,
        feePercent: `${relayerService.relayerFeeBps / 100}%`,
      },
      privacy: {
        description: 'TRUE anonymous swaps - your wallet does NOT appear in swap transaction',
        flow: [
          'You deposit to shared relayer pool',
          'Relayer executes swap (your wallet not in tx)',
          'Output goes to your stealth address',
          'No on-chain link between you and output!'
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/swap
 * Create anonymous swap via relayer
 * 
 * Body:
 * - inputMint: Token to swap from (SOL = So11111111111111111111111111111111111111112)
 * - outputMint: Token to swap to
 * - amount: Amount in smallest unit (lamports for SOL)
 * - userWallet: Your wallet (only for deposit tracking)
 * - timeDelay: 'none' | 'short' | 'medium' | 'long' | 'random'
 */
router.post('/swap', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount, userWallet, timeDelay } = req.body;
    
    // Validation
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount are required'
      });
    }
    
    const result = await relayerService.createAnonymousSwap({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      userWallet,
      timeDelay: timeDelay || 'short'
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/relayer/status/:swapId
 * Check swap status
 */
router.get('/status/:swapId', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { swapId } = req.params;
    
    const status = relayerService.getSwapStatus(swapId);
    
    if (!status.found) {
      return res.status(404).json({ error: 'Swap not found' });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/simulate/:swapId
 * Simulate deposit for testing (dev only)
 */
router.post('/simulate/:swapId', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    
    const { relayerService } = getServices(req);
    const { swapId } = req.params;
    
    const result = await relayerService.simulateDeposit(swapId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/execute-now
 * Execute a REAL swap using relayer funds NOW
 * This is for demo - shows TRUE anonymous swap
 */
router.post('/execute-now', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount, stealthAddress } = req.body;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount are required'
      });
    }
    
    const result = await relayerService.executeSwapNow({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      stealthAddress // Optional - if not provided, generates new stealth
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/relayer/quote
 * Get swap quote (no privacy yet, just price check)
 */
router.get('/quote', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount } = req.query;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount are required'
      });
    }
    
    const quote = await relayerService.getQuote({
      inputMint,
      outputMint,
      amount: parseInt(amount)
    });
    
    // Add relayer fee info
    const relayerFee = Math.floor(parseInt(amount) * relayerService.relayerFeeBps / 10000);
    
    res.json({
      ...quote,
      fees: {
        relayerFeeBps: relayerService.relayerFeeBps,
        relayerFee,
        youPay: parseInt(amount),
        swapAmount: parseInt(amount) - relayerFee
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
