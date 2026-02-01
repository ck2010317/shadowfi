import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// App Store - Global state management
export const useAppStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // Privacy settings
      privacyLevel: 'maximum', // 'standard', 'enhanced', 'maximum'
      setPrivacyLevel: (level) => set({ privacyLevel: level }),
      
      // Favorite tokens
      favoriteTokens: [],
      addFavorite: (token) => set((state) => ({
        favoriteTokens: [...state.favoriteTokens, token]
      })),
      removeFavorite: (tokenAddress) => set((state) => ({
        favoriteTokens: state.favoriteTokens.filter(t => t.address !== tokenAddress)
      })),
      
      // Recent transactions (local, anonymized)
      recentTxs: [],
      addTx: (tx) => set((state) => ({
        recentTxs: [tx, ...state.recentTxs].slice(0, 50)
      })),
      clearTxs: () => set({ recentTxs: [] }),
      
      // Notifications
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [
          { id: Date.now(), ...notification },
          ...state.notifications
        ].slice(0, 20)
      })),
      dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      clearNotifications: () => set({ notifications: [] }),
      
      // Connection status
      isServerConnected: false,
      setServerConnected: (connected) => set({ isServerConnected: connected }),
      
      // WebSocket status
      isWebSocketConnected: false,
      setWebSocketConnected: (connected) => set({ isWebSocketConnected: connected }),
    }),
    {
      name: 'shadowfi-storage',
      partialize: (state) => ({
        theme: state.theme,
        privacyLevel: state.privacyLevel,
        favoriteTokens: state.favoriteTokens,
      }),
    }
  )
);

// Dark Pool Store
export const useDarkPoolStore = create((set, get) => ({
  // Current pool stats
  stats: {
    pendingOrders: 0,
    totalMatches: 0,
    totalVolume: 0,
    avgMatchTime: 0,
  },
  setStats: (stats) => set({ stats }),
  
  // Order book depth (anonymized)
  depth: {
    bids: [],
    asks: [],
  },
  setDepth: (depth) => set({ depth }),
  
  // User's orders (local tracking)
  userOrders: [],
  addOrder: (order) => set((state) => ({
    userOrders: [order, ...state.userOrders]
  })),
  updateOrder: (orderId, update) => set((state) => ({
    userOrders: state.userOrders.map(o => 
      o.id === orderId ? { ...o, ...update } : o
    )
  })),
  removeOrder: (orderId) => set((state) => ({
    userOrders: state.userOrders.filter(o => o.id !== orderId)
  })),
  
  // Recent matches
  recentMatches: [],
  addMatch: (match) => set((state) => ({
    recentMatches: [match, ...state.recentMatches].slice(0, 50)
  })),
}));

// Presale Store
export const usePresaleStore = create((set, get) => ({
  // Active presales
  activePresales: [],
  setActivePresales: (presales) => set({ activePresales: presales }),
  
  // User commitments
  userCommitments: [],
  addCommitment: (commitment) => set((state) => ({
    userCommitments: [commitment, ...state.userCommitments]
  })),
  updateCommitment: (id, update) => set((state) => ({
    userCommitments: state.userCommitments.map(c =>
      c.id === id ? { ...c, ...update } : c
    )
  })),
  
  // Selected presale for detail view
  selectedPresale: null,
  setSelectedPresale: (presale) => set({ selectedPresale: presale }),
}));

// Pre-buy Campaign Store
export const usePrebuyStore = create((set, get) => ({
  // Campaigns
  campaigns: [],
  setCampaigns: (campaigns) => set({ campaigns }),
  addCampaign: (campaign) => set((state) => ({
    campaigns: [campaign, ...state.campaigns]
  })),
  updateCampaign: (campaignId, update) => set((state) => ({
    campaigns: state.campaigns.map(c =>
      c.campaignId === campaignId ? { ...c, ...update } : c
    )
  })),
  
  // Active campaign progress
  activeProgress: {},
  setProgress: (campaignId, progress) => set((state) => ({
    activeProgress: { ...state.activeProgress, [campaignId]: progress }
  })),
}));

// Token Store
export const useTokenStore = create((set, get) => ({
  // Trending tokens
  trendingTokens: [],
  setTrendingTokens: (tokens) => set({ trendingTokens: tokens }),
  
  // User's deployed tokens
  userTokens: [],
  setUserTokens: (tokens) => set({ userTokens: tokens }),
  addUserToken: (token) => set((state) => ({
    userTokens: [token, ...state.userTokens]
  })),
  
  // Token search results
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),
  
  // Token prices cache
  prices: {},
  setPrice: (tokenAddress, price) => set((state) => ({
    prices: { ...state.prices, [tokenAddress]: price }
  })),
}));

// Identity Store
export const useIdentityStore = create(
  persist(
    (set, get) => ({
      // Verification status
      isVerified: false,
      setVerified: (verified) => set({ isVerified: verified }),
      
      // ZK Proofs
      proofs: [],
      addProof: (proof) => set((state) => ({
        proofs: [...state.proofs, proof]
      })),
      
      // Reputation
      reputation: 0,
      setReputation: (rep) => set({ reputation: rep }),
      addReputation: (amount) => set((state) => ({
        reputation: state.reputation + amount
      })),
      
      // Used proof tracking
      usedProofs: [],
      markProofUsed: (proofId, purpose) => set((state) => ({
        usedProofs: [...state.usedProofs, { proofId, purpose, timestamp: Date.now() }]
      })),
    }),
    {
      name: 'shadowfi-identity',
      partialize: (state) => ({
        proofs: state.proofs,
        reputation: state.reputation,
        usedProofs: state.usedProofs,
      }),
    }
  )
);

export default {
  useAppStore,
  useDarkPoolStore,
  usePresaleStore,
  usePrebuyStore,
  useTokenStore,
  useIdentityStore,
};
