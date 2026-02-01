import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';

const WalletContext = createContext(null);

// Solana RPC endpoints
const RPC_ENDPOINTS = {
  mainnet: 'https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1',
  devnet: 'https://api.devnet.solana.com',
};

// Use mainnet for production
const NETWORK = process.env.REACT_APP_NETWORK || 'mainnet';
const RPC_URL = RPC_ENDPOINTS[NETWORK];

// Create a singleton connection
let globalConnection = null;
const getConnection = () => {
  if (!globalConnection) {
    globalConnection = new Connection(RPC_URL, 'confirmed');
  }
  return globalConnection;
};

export function WalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState(0);
  const [provider, setProvider] = useState(null);
  const [connection, setConnection] = useState(null);
  const [network, setNetwork] = useState(NETWORK);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize connection
  useEffect(() => {
    const conn = getConnection();
    setConnection(conn);
    console.log('[Wallet] Connection initialized:', RPC_URL);
  }, []);

  // Check if Phantom is installed and accessible
  const isPhantomInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Wait a bit for Phantom to inject
    const hasSolana = !!window.solana;
    const isPhantom = hasSolana && window.solana?.isPhantom === true;
    
    console.log('[Wallet] Phantom detection:', {
      hasSolana,
      isPhantom,
      phantomReady: isPhantom,
    });
    
    return isPhantom;
  }, []);

  // Fetch real balance from Solana
  const fetchBalance = useCallback(async (pubKey) => {
    if (!pubKey) return;
    
    try {
      const conn = getConnection();
      console.log('[Wallet] Fetching balance for:', pubKey);
      console.log('[Wallet] Network:', NETWORK);
      console.log('[Wallet] RPC URL:', RPC_URL);
      
      const balanceLamports = await conn.getBalance(new PublicKey(pubKey));
      const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
      
      console.log('[Wallet] Balance result:', {
        lamports: balanceLamports,
        sol: balanceSOL,
        network: NETWORK
      });
      
      setBalance(balanceSOL);
      return balanceSOL;
    } catch (error) {
      console.error('[Wallet] Balance fetch error:', error?.message || error);
      setBalance(0);
    }
  }, []);

  // Connect wallet - REAL CONNECTION
  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[Wallet] Attempting to connect to', NETWORK, '...');
      
      if (!isPhantomInstalled()) {
        alert('❌ Phantom wallet not found!\n\n1. Install: https://phantom.app/\n2. Refresh page\n3. Try again');
        window.open('https://phantom.app/', '_blank');
        setIsLoading(false);
        return;
      }

      const solana = window.solana;
      console.log('[Wallet] Phantom detected, calling connect...');
      
      // Simple connect call
      const response = await solana.connect();
      const pubKey = response.publicKey;
      
      console.log('[Wallet] ✅ Connected:', pubKey.toString());
      
      setPublicKey(pubKey);
      setAddress(pubKey.toString());
      setConnected(true);
      setProvider(solana);

      // Fetch balance
      const bal = await fetchBalance(pubKey.toString());
      console.log('[Wallet] ✅ Balance:', bal, 'SOL');

      // Listen for account changes
      const handleAccountChange = (newPublicKey) => {
        console.log('[Wallet] Account changed:', newPublicKey?.toString());
        if (newPublicKey) {
          setPublicKey(newPublicKey);
          setAddress(newPublicKey.toString());
          fetchBalance(newPublicKey.toString());
        } else {
          setConnected(false);
          setAddress(null);
          setPublicKey(null);
          setBalance(0);
        }
      };
      
      solana.on('accountChanged', handleAccountChange);

    } catch (error) {
      console.error('[Wallet] ❌ Connection error:', error?.message || error);
      alert('⚠️ Connection failed:\n\n' + (error?.message || 'Unknown error') + '\n\nMake sure:\n1. Phantom is unlocked\n2. Phantom is on MAINNET\n3. Refresh and try again');
    } finally {
      setIsLoading(false);
    }
  }, [isPhantomInstalled, fetchBalance]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      console.log('[Wallet] Disconnecting...');
      if (provider) {
        await provider.disconnect();
      }
      setConnected(false);
      setAddress(null);
      setPublicKey(null);
      setBalance(0);
      setProvider(null);
      console.log('[Wallet] Disconnected');
    } catch (error) {
      console.error('[Wallet] Disconnect failed:', error);
    }
  }, [provider]);

  // Sign message - REAL SIGNING
  const signMessage = useCallback(async (message) => {
    if (!provider || !connected) {
      throw new Error('Wallet not connected');
    }

    const encodedMessage = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encodedMessage, 'utf8');
    return signature;
  }, [provider, connected]);

  // Sign and send transaction - REAL TX
  const signAndSendTransaction = useCallback(async (transaction) => {
    if (!provider || !connected || !connection) {
      throw new Error('Wallet not connected');
    }

    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signed = await provider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      // Refresh balance
      await fetchBalance(address);

      return signature;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }, [provider, connected, connection, publicKey, address, fetchBalance]);

  // Sign transaction without sending
  const signTransaction = useCallback(async (transaction) => {
    if (!provider || !connected) {
      throw new Error('Wallet not connected');
    }
    return await provider.signTransaction(transaction);
  }, [provider, connected]);

  // Sign multiple transactions
  const signAllTransactions = useCallback(async (transactions) => {
    if (!provider || !connected) {
      throw new Error('Wallet not connected');
    }
    return await provider.signAllTransactions(transactions);
  }, [provider, connected]);

  // Refresh balance manually
  const refreshBalance = useCallback(async () => {
    if (address) {
      await fetchBalance(address);
    }
  }, [address, fetchBalance]);

  // Get shortened address
  const shortenedAddress = address 
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      console.log('[Wallet] Attempting auto-connect...');
      if (isPhantomInstalled()) {
        try {
          const { solana } = window;
          const response = await solana.connect({ onlyIfTrusted: true });
          const pubKey = response.publicKey;
          console.log('[Wallet] Auto-connected! Public key:', pubKey.toString());
          setPublicKey(pubKey);
          setAddress(pubKey.toString());
          setConnected(true);
          setProvider(solana);
          
          // Fetch balance after connecting
          await fetchBalance(pubKey.toString());
        } catch (error) {
          console.log('[Wallet] Auto-connect skipped (not trusted yet)', error?.message);
          // User hasn't trusted yet - that's fine
        }
      } else {
        console.warn('[Wallet] Phantom not installed during auto-connect');
      }
    };
    autoConnect();
  }, [isPhantomInstalled, fetchBalance]);

  // Refresh balance periodically
  useEffect(() => {
    if (!connected || !address) return;
    
    const interval = setInterval(() => {
      fetchBalance(address);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [connected, address, fetchBalance]);

  const value = {
    // State
    connected,
    address,
    publicKey,
    shortenedAddress,
    balance,
    provider,
    connection,
    network,
    isLoading,
    // Actions
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAllTransactions,
    signAndSendTransaction,
    refreshBalance,
    isPhantomInstalled,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
