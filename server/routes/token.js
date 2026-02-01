/**
 * Token API Routes - Anoncoin Integration
 */

const express = require('express');
const router = express.Router();
const AnoncoinService = require('../services/anoncoin/AnoncoinService');
const BundledLaunchService = require('../services/launch/BundledLaunchService');

// Initialize services
let anoncoinService = null;
let bundledLaunchService = null;

const getAnoncoinService = (req) => {
  if (!anoncoinService) {
    anoncoinService = new AnoncoinService(
      req.app.get('logger'),
      req.app.get('mixnetRouter')
    );
  }
  return anoncoinService;
};

const getBundledLaunchService = (req) => {
  if (!bundledLaunchService) {
    bundledLaunchService = new BundledLaunchService(
      req.app.get('logger'),
      getAnoncoinService(req)
    );
  }
  return bundledLaunchService;
};

/**
 * POST /api/v1/token/deploy
 * Deploy a new token
 */
router.post('/deploy', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const tokenConfig = req.body;
    
    // Validate required fields
    if (!tokenConfig.name || !tokenConfig.symbol) {
      return res.status(400).json({
        error: 'Name and symbol required'
      });
    }
    
    const result = await service.deployToken(tokenConfig);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/token/launch-with-prebuy
 * Launch token + Execute pre-buy in one atomic action
 * This beats snipers by buying immediately after launch!
 */
router.post('/launch-with-prebuy', async (req, res, next) => {
  try {
    const service = getBundledLaunchService(req);
    const { token, preBuy } = req.body;
    
    // Validate token details
    if (!token?.name || !token?.symbol || !token?.description) {
      return res.status(400).json({
        error: 'Token name, symbol, and description required'
      });
    }
    
    // Validate pre-buy config
    if (!preBuy?.totalSol || !preBuy?.numWallets) {
      return res.status(400).json({
        error: 'Pre-buy totalSol and numWallets required'
      });
    }
    
    if (preBuy.numWallets < 1 || preBuy.numWallets > 20) {
      return res.status(400).json({
        error: 'Number of wallets must be between 1 and 20'
      });
    }
    
    if (preBuy.totalSol < 0.01) {
      return res.status(400).json({
        error: 'Minimum pre-buy is 0.01 SOL'
      });
    }
    
    const result = await service.launchWithPreBuy({ token, preBuy });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/token/prebuy
 * Pre-buy for an existing token (distributed stealth wallets)
 */
router.post('/prebuy', async (req, res, next) => {
  try {
    const service = getBundledLaunchService(req);
    const { tokenAddress, totalSol, numWallets } = req.body;
    
    // Validate
    if (!tokenAddress) {
      return res.status(400).json({
        error: 'Token address required'
      });
    }
    
    if (!totalSol || totalSol < 0.001) {
      return res.status(400).json({
        error: 'Minimum pre-buy is 0.001 SOL'
      });
    }
    
    if (!numWallets || numWallets < 1 || numWallets > 20) {
      return res.status(400).json({
        error: 'Number of wallets must be between 1 and 20'
      });
    }
    
    const result = await service.preBuyOnly({ tokenAddress, totalSol, numWallets });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/:address
 * Get token information
 */
router.get('/:address', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { address } = req.params;
    
    const tokenInfo = await service.getTokenInfo(address);
    res.json(tokenInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/:address/price
 * Get token price
 */
router.get('/:address/price', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { address } = req.params;
    const { amount } = req.query;
    
    const price = await service.getTokenPrice(address, parseFloat(amount) || 1);
    res.json(price);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/token/buy
 * Buy tokens
 */
router.post('/buy', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const buyParams = req.body;
    
    if (!buyParams.tokenAddress || !buyParams.amount) {
      return res.status(400).json({
        error: 'Token address and amount required'
      });
    }
    
    const result = await service.buyToken(buyParams);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/token/sell
 * Sell tokens
 */
router.post('/sell', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const sellParams = req.body;
    
    if (!sellParams.tokenAddress || !sellParams.amount) {
      return res.status(400).json({
        error: 'Token address and amount required'
      });
    }
    
    const result = await service.sellToken(sellParams);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/:address/market
 * Get market data
 */
router.get('/:address/market', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { address } = req.params;
    
    const marketData = await service.getMarketData(address);
    res.json(marketData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/:address/bonding-curve
 * Get bonding curve progress
 */
router.get('/:address/bonding-curve', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { address } = req.params;
    
    const progress = await service.getBondingCurveProgress(address);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/:address/trades
 * Get trade history (anonymized)
 */
router.get('/:address/trades', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { address } = req.params;
    const { limit } = req.query;
    
    const trades = await service.getTradeHistory(address, parseInt(limit) || 50);
    res.json({ trades });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/trending
 * Get trending tokens
 */
router.get('/list/trending', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { limit } = req.query;
    
    const tokens = await service.getTrendingTokens(parseInt(limit) || 20);
    res.json({ tokens });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/new
 * Get new launches
 */
router.get('/list/new', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { limit } = req.query;
    
    const tokens = await service.getNewLaunches(parseInt(limit) || 20);
    res.json({ tokens });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/token/search
 * Search tokens
 */
router.get('/search', async (req, res, next) => {
  try {
    const service = getAnoncoinService(req);
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Search query required'
      });
    }
    
    const results = await service.searchTokens(q);
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
