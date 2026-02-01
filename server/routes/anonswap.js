/**
 * Anonymous Swap API Routes
 * 
 * Privacy-preserving swap endpoints:
 * - Quote: Get swap price without revealing intent
 * - Create: Initiate anonymous swap with stealth output
 * - Execute: Complete swap with signed transaction
 * - Status: Check swap progress
 */

const express = require('express');
const router = express.Router();
const RealAnonymousSwapService = require('../services/swap/RealAnonymousSwapService');
const StealthAddressService = require('../services/privacy/StealthAddressService');

// Initialize services
let swapService = null;
let stealthService = null;

const getServices = (req) => {
  if (!stealthService) {
    stealthService = new StealthAddressService(req.app.get('logger'));
  }
  if (!swapService) {
    swapService = new RealAnonymousSwapService(
      req.app.get('logger'),
      stealthService
    );
  }
  return { swapService, stealthService };
};

/**
 * GET /api/v1/anonswap/quote
 * Get a swap quote (no wallet connection needed)
 */
router.get('/quote', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const { inputMint, outputMint, amount, slippageBps } = req.query;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount are required'
      });
    }
    
    const quote = await swapService.getQuote({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      slippageBps: slippageBps ? parseInt(slippageBps) : undefined
    });
    
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/anonswap/create
 * Create an anonymous swap request
 * 
 * Privacy options:
 * - recipientMetaAddress: Receive to stealth address (hidden receiver)
 * - timeDelay: 'none' | 'short' | 'medium' | 'long' | 'random'
 * - splitTransactions: true/false (break amount patterns)
 */
router.post('/create', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const {
      inputMint,
      outputMint,
      amount,
      senderWallet,
      recipientMetaAddress,
      timeDelay,
      splitTransactions,
      slippageBps
    } = req.body;
    
    // Validation
    if (!inputMint || !outputMint || !amount || !senderWallet) {
      return res.status(400).json({
        error: 'inputMint, outputMint, amount, and senderWallet are required'
      });
    }
    
    const result = await swapService.createAnonymousSwap({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      senderWallet,
      recipientMetaAddress,
      timeDelay: timeDelay || 'none',
      splitTransactions: splitTransactions || false,
      slippageBps: slippageBps ? parseInt(slippageBps) : undefined
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/anonswap/execute/:swapId
 * Execute a pending swap
 * 
 * Either:
 * - Get unsigned transaction to sign
 * - Submit signed transaction for broadcast
 */
router.post('/execute/:swapId', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const { swapId } = req.params;
    const { signedTransaction } = req.body;
    
    const result = await swapService.executeSwap(swapId, signedTransaction);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/anonswap/status/:swapId
 * Get status of an anonymous swap
 */
router.get('/status/:swapId', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const { swapId } = req.params;
    
    const status = swapService.getSwapStatus(swapId);
    
    if (!status.found) {
      return res.status(404).json({ error: 'Swap not found' });
    }
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/anonswap/pending
 * Get all pending swaps (for monitoring)
 */
router.get('/pending', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const pending = swapService.getPendingSwaps();
    
    res.json({
      count: pending.length,
      swaps: pending
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/anonswap/stealth-swap
 * One-click anonymous swap with stealth receiving
 * Combines: generate stealth address + create swap
 */
router.post('/stealth-swap', async (req, res, next) => {
  try {
    const { swapService, stealthService } = getServices(req);
    const {
      inputMint,
      outputMint,
      amount,
      senderWallet,
      timeDelay,
      slippageBps
    } = req.body;
    
    // Validation
    if (!inputMint || !outputMint || !amount || !senderWallet) {
      return res.status(400).json({
        error: 'inputMint, outputMint, amount, and senderWallet are required'
      });
    }
    
    // Step 1: Generate stealth meta-address for receiver
    const metaAddress = stealthService.generateStealthMetaAddress();
    
    // Step 2: Create anonymous swap with stealth output
    const swapResult = await swapService.createAnonymousSwap({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      senderWallet,
      recipientMetaAddress: metaAddress.metaAddress,
      timeDelay: timeDelay || 'short', // Default to short delay for privacy
      splitTransactions: false,
      slippageBps: slippageBps ? parseInt(slippageBps) : undefined
    });
    
    res.json({
      success: true,
      swap: swapResult,
      // IMPORTANT: User must save these to claim their tokens!
      stealthKeys: {
        warning: 'SAVE THESE KEYS! You need them to access your swapped tokens.',
        viewingPrivKey: metaAddress.viewingPrivKey,
        spendingPubKey: metaAddress.spendingPubKey,
        spendingPrivKey: metaAddress.spendingPrivKey,
        metaAddress: metaAddress.metaAddress
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/anonswap/tokens/popular
 * Get popular tokens for swapping
 */
router.get('/tokens/popular', async (req, res, next) => {
  try {
    // Return popular Solana tokens for swapping
    const popularTokens = [
      {
        symbol: 'SOL',
        name: 'Solana',
        mint: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      },
      {
        symbol: 'BONK',
        name: 'Bonk',
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        decimals: 5,
        logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
      },
      {
        symbol: 'WIF',
        name: 'dogwifhat',
        mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        decimals: 6,
        logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link'
      },
      {
        symbol: 'JUP',
        name: 'Jupiter',
        mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png'
      },
      {
        symbol: 'POPCAT',
        name: 'Popcat',
        mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        decimals: 9,
        logoURI: 'https://bafkreidvkvuzyslw5jh5z242lgzwzhbi2kxxnpkufi5rvcf5nt5qyxzgpu.ipfs.nftstorage.link'
      },
      {
        symbol: 'RAY',
        name: 'Raydium',
        mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'
      }
    ];
    
    res.json({ tokens: popularTokens });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/anonswap/quote
 * Get swap quote (POST for privacy - no query params in logs)
 */
router.post('/quote', async (req, res, next) => {
  try {
    const { swapService } = getServices(req);
    const { inputMint, outputMint, amount, slippageBps } = req.body;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: 'inputMint, outputMint, and amount are required'
      });
    }
    
    const quote = await swapService.getQuote({
      inputMint,
      outputMint,
      amount: parseInt(amount),
      slippageBps: slippageBps ? parseInt(slippageBps) : undefined
    });
    
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
