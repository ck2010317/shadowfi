/**
 * Production Relayer API Routes
 * 
 * TRUE anonymous swaps:
 * 1. POST /create → Get deposit address + stealth keys
 * 2. User sends SOL to deposit address
 * 3. Backend auto-detects deposit and executes swap
 * 4. Tokens arrive at user's stealth address
 */

const express = require('express');
const router = express.Router();
const ProductionRelayerService = require('../services/swap/ProductionRelayerService');
const StealthAddressService = require('../services/privacy/StealthAddressService');

let relayerService = null;
let stealthService = null;

const getServices = (req) => {
  if (!stealthService) {
    stealthService = new StealthAddressService(req.app.get('logger'));
  }
  if (!relayerService) {
    relayerService = new ProductionRelayerService(
      req.app.get('logger'),
      stealthService
    );
  }
  return { relayerService, stealthService };
};

/**
 * GET /api/v1/relayer/info
 * Get relayer info and balance
 */
router.get('/info', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const balance = await relayerService.getRelayerBalance();
    
    res.json({
      success: true,
      relayer: {
        address: relayerService.getRelayerPoolAddress(),
        balance: balance,
        minDeposit: relayerService.minDepositLamports / 1e9,
        fee: relayerService.relayerFeeLamports / 1e9,
      },
      howItWorks: [
        '1. Call POST /create with swap details',
        '2. Send SOL to the deposit address returned',
        '3. We auto-detect your deposit',
        '4. We execute swap privately (your wallet NOT in tx)',
        '5. Tokens arrive at your stealth address',
        '6. Import stealth private key to Phantom',
      ]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/create
 * Create anonymous swap - get deposit instructions
 */
router.post('/create', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount, userWallet } = req.body;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount required',
        example: {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'E2wwdzHgdX6T68V4AFAk2f3ya6ctEU5gkAhhaxUidoge',
          amount: 10000000
        }
      });
    }
    
    const result = await relayerService.createAnonymousSwap({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      userWallet
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/swap
 * Alias for /create (backwards compatibility)
 */
router.post('/swap', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount, userWallet } = req.body;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'inputMint, outputMint, and amount required' });
    }
    
    const result = await relayerService.createAnonymousSwap({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      userWallet
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
    const status = relayerService.getSwapStatus(req.params.swapId);
    
    if (!status.found) {
      return res.status(404).json({ error: 'Swap not found' });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/relayer/execute-now
 * Execute swap immediately (for testing - uses relayer funds)
 */
router.post('/execute-now', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount, stealthAddress } = req.body;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'inputMint, outputMint, and amount required' });
    }
    
    const result = await relayerService.executeSwapNow({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      stealthAddress
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/relayer/quote
 * Get swap quote
 */
router.get('/quote', async (req, res, next) => {
  try {
    const { relayerService } = getServices(req);
    const { inputMint, outputMint, amount } = req.query;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'inputMint, outputMint, and amount required' });
    }
    
    const axios = require('axios');
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`;
    const quoteRes = await axios.get(quoteUrl, {
      headers: { 'x-api-key': relayerService.jupiterApiKey },
      timeout: 15000
    });
    
    const quote = quoteRes.data;
    const relayerFee = relayerService.relayerFeeLamports;
    const swapAmount = parseInt(amount) - relayerFee;
    
    res.json({
      success: true,
      inputMint,
      outputMint,
      inputAmount: amount,
      outputAmount: quote.outAmount,
      fees: {
        relayerFee,
        relayerFeeSOL: relayerFee / 1e9,
        swapAmount,
        swapAmountSOL: swapAmount / 1e9
      },
      priceImpactPct: quote.priceImpactPct,
      route: quote.routePlan?.map(r => r.swapInfo?.label).filter(Boolean) || []
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
