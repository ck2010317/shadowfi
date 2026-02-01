// API Service Layer for ShadowFi Frontend
// Connects to backend services on port 3001

const API_BASE = 'http://localhost:3001/api/v1';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      // Extract error message from nested error object
      const errorMsg = data?.error?.message || data?.error || data?.message || 'API request failed';
      throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message || error);
    throw error;
  }
}

// ==========================================
// Dark Pool API
// ==========================================
export const darkPoolAPI = {
  // Get dark pool stats
  getStats: () => apiCall('/darkpool/stats'),

  // Get order book depth (anonymized)
  getDepth: (tokenMint) => 
    apiCall(`/darkpool/depth/${tokenMint}`),

  // Submit an order
  submitOrder: (order) => 
    apiCall('/darkpool/order', {
      method: 'POST',
      body: order
    }),

  // Cancel an order
  cancelOrder: (orderId, encryptedProof) => 
    apiCall(`/darkpool/order/${orderId}`, {
      method: 'DELETE',
      body: { encryptedProof }
    }),

  // Get user's orders (encrypted)
  getOrders: (walletCommitment) => 
    apiCall(`/darkpool/orders/${walletCommitment}`),

  // Get recent matches for a token
  getMatches: (tokenMint) => 
    apiCall(`/darkpool/matches/${tokenMint}`),
};

// ==========================================
// Anonymous Swap API
// ==========================================
export const swapAPI = {
  // Get quote for a swap
  getQuote: (params) => 
    apiCall('/swap/quote', {
      method: 'POST',
      body: params
    }),

  // Initiate a swap
  initiateSwap: (swapData) => 
    apiCall('/swap/initiate', {
      method: 'POST',
      body: swapData
    }),

  // Check swap status
  getStatus: (swapId) => 
    apiCall(`/swap/status/${swapId}`),

  // Complete a swap
  completeSwap: (swapId, proof) => 
    apiCall(`/swap/complete/${swapId}`, {
      method: 'POST',
      body: { proof }
    }),

  // Get swap history for a commitment
  getHistory: (commitment) => 
    apiCall(`/swap/history/${commitment}`),
};

// ==========================================
// Private Presale API
// ==========================================
export const presaleAPI = {
  // Get active presales
  getActive: () => apiCall('/presale/active'),

  // Get presale details
  getDetails: (presaleId) => 
    apiCall(`/presale/${presaleId}`),

  // Submit a commitment to a presale
  commit: (presaleId, commitment, encryptedData) => 
    apiCall(`/presale/${presaleId}/commit`, {
      method: 'POST',
      body: { commitment, encryptedData }
    }),

  // Reveal commitment
  reveal: (presaleId, commitmentId, secret, amount) => 
    apiCall(`/presale/${presaleId}/reveal`, {
      method: 'POST',
      body: { commitmentId, secret, amount }
    }),

  // Claim tokens after presale
  claim: (presaleId, commitmentId, proof) => 
    apiCall(`/presale/${presaleId}/claim`, {
      method: 'POST',
      body: { commitmentId, proof }
    }),

  // Get user's commitments (by commitment hash)
  getCommitments: (userCommitment) => 
    apiCall(`/presale/commitments/${userCommitment}`),

  // Create new presale (for token creators)
  create: (presaleData) => 
    apiCall('/presale/create', {
      method: 'POST',
      body: presaleData
    }),
};

// ==========================================
// ZK Identity API
// ==========================================
export const identityAPI = {
  // Initiate Twitter verification
  initiateTwitterVerification: (walletCommitment, twitterHandle) => 
    apiCall('/identity/twitter/initiate', {
      method: 'POST',
      body: { walletCommitment, twitterHandle }
    }),

  // Complete Twitter verification
  completeTwitterVerification: (verificationId, oauthToken) => 
    apiCall('/identity/twitter/verify', {
      method: 'POST',
      body: { verificationId, oauthToken }
    }),

  // Generate ZK proof for attribute
  generateProof: (walletCommitment, proofType, threshold) => 
    apiCall('/identity/proof/generate', {
      method: 'POST',
      body: { walletCommitment, proofType, threshold }
    }),

  // Verify a proof
  verifyProof: (proof) => 
    apiCall('/identity/proof/verify', {
      method: 'POST',
      body: { proof }
    }),

  // Get user's proofs
  getProofs: (walletCommitment) => 
    apiCall(`/identity/proofs/${walletCommitment}`),
};

// ==========================================
// Token Launch API
// ==========================================
export const tokenAPI = {
  // Deploy a new token (simple)
  deploy: (tokenData) => 
    apiCall('/token/deploy', {
      method: 'POST',
      body: tokenData
    }),

  // Launch token + Pre-buy in one atomic action (BEATS SNIPERS!)
  launchWithPreBuy: (config) => 
    apiCall('/token/launch-with-prebuy', {
      method: 'POST',
      body: config
    }),

  // Pre-buy for existing token
  preBuy: (config) => 
    apiCall('/token/prebuy', {
      method: 'POST',
      body: config
    }),

  // Get token info
  getToken: (tokenAddress) => 
    apiCall(`/token/${tokenAddress}`),

  // Get trending tokens
  getTrending: () => apiCall('/token/trending'),

  // Search tokens
  search: (query) => 
    apiCall(`/token/search?q=${encodeURIComponent(query)}`),

  // Get token price/chart data
  getPrice: (tokenAddress) => 
    apiCall(`/token/${tokenAddress}/price`),
};

// ==========================================
// Pre-Buy Rails API
// ==========================================
export const prebuyAPI = {
  // Create a new pre-buy campaign
  createCampaign: (campaignData) => 
    apiCall('/prebuy/campaign', {
      method: 'POST',
      body: campaignData
    }),

  // Execute a campaign
  executeCampaign: (campaignId) => 
    apiCall(`/prebuy/campaign/${campaignId}/execute`, {
      method: 'POST'
    }),

  // Get campaign status
  getCampaignStatus: (campaignId) => 
    apiCall(`/prebuy/campaign/${campaignId}`),

  // Get all campaigns for a wallet
  getCampaigns: (walletCommitment) => 
    apiCall(`/prebuy/campaigns/${walletCommitment}`),

  // Cancel a campaign
  cancelCampaign: (campaignId) => 
    apiCall(`/prebuy/campaign/${campaignId}`, {
      method: 'DELETE'
    }),

  // Consolidate tokens from campaign
  consolidate: (campaignId, destinationWallet, proof) => 
    apiCall(`/prebuy/campaign/${campaignId}/consolidate`, {
      method: 'POST',
      body: { destinationWallet, proof }
    }),
};

// ==========================================
// Privacy Utilities API
// ==========================================
export const privacyAPI = {
  // Get mixnet status
  getMixnetStatus: () => apiCall('/privacy/mixnet/status'),

  // Route request through mixnet
  routeRequest: (encryptedRequest) => 
    apiCall('/privacy/mixnet/route', {
      method: 'POST',
      body: { encryptedRequest }
    }),

  // Generate stealth address
  generateStealthAddress: (publicKey) => 
    apiCall('/privacy/stealth/generate', {
      method: 'POST',
      body: { publicKey }
    }),

  // Create ring signature
  createRingSignature: (message, keyIndex, publicKeys) => 
    apiCall('/privacy/ring/sign', {
      method: 'POST',
      body: { message, keyIndex, publicKeys }
    }),
};

// ==========================================
// Real Anonymous Swap API (with stealth)
// ==========================================
export const anonSwapAPI = {
  // Get swap quote from Jupiter
  getQuote: (params) =>
    apiCall('/anonswap/quote', {
      method: 'POST',
      body: params
    }),

  // Create swap with stealth receiving
  createStealthSwap: (swapData) =>
    apiCall('/anonswap/stealth-swap', {
      method: 'POST',
      body: swapData
    }),

  // Execute a prepared swap
  executeSwap: (swapId, signedTransaction) =>
    apiCall(`/anonswap/execute/${swapId}`, {
      method: 'POST',
      body: { signedTransaction }
    }),

  // Get swap status
  getStatus: (swapId) =>
    apiCall(`/anonswap/status/${swapId}`),

  // Get popular tokens
  getPopularTokens: () =>
    apiCall('/anonswap/tokens/popular'),
};

// ==========================================
// WebSocket Connection
// ==========================================
export function createWebSocketConnection(handlers = {}) {
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    handlers.onConnect?.();
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'DARK_POOL_UPDATE':
          handlers.onDarkPoolUpdate?.(data.payload);
          break;
        case 'PRESALE_UPDATE':
          handlers.onPresaleUpdate?.(data.payload);
          break;
        case 'SWAP_STATUS':
          handlers.onSwapStatus?.(data.payload);
          break;
        case 'PRICE_UPDATE':
          handlers.onPriceUpdate?.(data.payload);
          break;
        case 'CAMPAIGN_PROGRESS':
          handlers.onCampaignProgress?.(data.payload);
          break;
        default:
          handlers.onMessage?.(data);
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    handlers.onError?.(error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    handlers.onDisconnect?.();
    
    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      handlers.onReconnecting?.();
      createWebSocketConnection(handlers);
    }, 3000);
  };
  
  return {
    send: (type, payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
      }
    },
    subscribe: (channel, params) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'SUBSCRIBE', 
          channel, 
          params 
        }));
      }
    },
    unsubscribe: (channel) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'UNSUBSCRIBE', 
          channel 
        }));
      }
    },
    close: () => ws.close(),
  };
}

// ==========================================
// Default Export
// ==========================================
export default {
  darkPool: darkPoolAPI,
  swap: swapAPI,
  presale: presaleAPI,
  identity: identityAPI,
  token: tokenAPI,
  prebuy: prebuyAPI,
  privacy: privacyAPI,
  anonSwap: anonSwapAPI,
  createWebSocketConnection,
};
