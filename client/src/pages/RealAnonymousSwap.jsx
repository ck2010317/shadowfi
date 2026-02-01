import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRightLeft, 
  ArrowDown,
  Shield, 
  RefreshCw,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  Info,
  Loader,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  Lock,
  Download,
  ExternalLink
} from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { Connection, VersionedTransaction, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';

// Solana connection
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1';

// Base tokens for swapping
const BASE_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: '◎', isBase: true },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: '$', isBase: true },
];

// Anoncoin-launched tokens (privacy tokens!)
const ANONCOIN_TOKENS = [
  { symbol: 'SHADOW', mint: 'E2wwdzHgdX6T68V4AFAk2f3ya6ctEU5gkAhhaxUidoge', decimals: 9, logo: '🥷', isAnoncoin: true, launchedAt: '2026-02-01' },
];

// Popular memecoins for reference
const MEMECOIN_TOKENS = [
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, logo: '🐕' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6, logo: '🐶' },
  { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', decimals: 9, logo: '🐱' },
];

const API_BASE = 'http://localhost:3001/api/v1';

export default function RealAnonymousSwap() {
  const { connected, connect, publicKey, signTransaction, sendTransaction } = useWallet();
  
  // Solana connection - memoized
  const connection = useMemo(() => new Connection(HELIUS_RPC, 'confirmed'), []);
  
  // Swap state - default to SOL input
  const [inputToken, setInputToken] = useState(BASE_TOKENS[0]);
  const [outputToken, setOutputToken] = useState(ANONCOIN_TOKENS[0] || null); // Default to first Anoncoin token
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [customOutputMint, setCustomOutputMint] = useState('');
  
  // Privacy settings
  const [useStealthReceiving, setUseStealthReceiving] = useState(true);
  const [useRelayer, setUseRelayer] = useState(true); // TRUE anonymous - relayer mode!
  const [timeDelay, setTimeDelay] = useState('short'); // none, short, medium, long
  const [slippage, setSlippage] = useState(1); // 1%
  
  // Relayer deposit state
  const [relayerDeposit, setRelayerDeposit] = useState(null);
  const [depositSent, setDepositSent] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState(null); // 'input' | 'output'
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  
  // Swap result
  const [swapResult, setSwapResult] = useState(null);
  const [stealthKeys, setStealthKeys] = useState(null);

  // Get quote when input changes
  const getQuote = useCallback(async () => {
    if (!inputAmount || !outputToken || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      return;
    }

    setIsGettingQuote(true);
    try {
      const inputMint = inputToken.mint;
      const outputMint = outputToken.mint || customOutputMint;
      const amountInSmallestUnit = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputToken.decimals));

      const response = await fetch(
        `${API_BASE}/anonswap/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=${slippage * 100}`
      );
      const data = await response.json();

      if (data.success) {
        const outDecimals = outputToken.decimals || 9;
        const outputFormatted = (parseInt(data.outputAmount) / Math.pow(10, outDecimals)).toFixed(6);
        setOutputAmount(outputFormatted);
      } else {
        // Use estimate
        setOutputAmount('~' + (parseFloat(inputAmount) * 0.95).toFixed(4));
      }
    } catch (error) {
      console.error('Quote error:', error);
      setOutputAmount('~' + (parseFloat(inputAmount) * 0.95).toFixed(4));
    } finally {
      setIsGettingQuote(false);
    }
  }, [inputAmount, inputToken, outputToken, customOutputMint, slippage]);

  useEffect(() => {
    const timer = setTimeout(getQuote, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);

  // Execute TRUE anonymous swap via relayer
  const executeRelayerSwap = async () => {
    if (!connected) {
      connect();
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Enter an amount');
      return;
    }

    if (!outputToken && !customOutputMint) {
      toast.error('Select output token');
      return;
    }

    setIsLoading(true);
    setSwapResult(null);
    setStealthKeys(null);
    setRelayerDeposit(null);
    setDepositSent(false);

    try {
      const inputMint = inputToken.mint;
      const outputMint = outputToken?.mint || customOutputMint;
      const amountInSmallestUnit = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputToken.decimals));

      // Step 1: Create relayer swap - get deposit address and stealth keys
      toast.loading('Creating anonymous swap via relayer...', { id: 'relayer' });
      
      const response = await fetch(`${API_BASE}/relayer/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amountInSmallestUnit,
          userWallet: publicKey.toString(),
          timeDelay
        })
      });

      const data = await response.json();
      toast.dismiss('relayer');

      if (!data.success) {
        throw new Error(data.error?.message || 'Relayer swap creation failed');
      }

      // Save stealth keys
      if (data.stealthKeys) {
        setStealthKeys(data.stealthKeys);
      }

      // Save deposit info
      setRelayerDeposit(data);
      setSwapResult(data);

      toast.success(
        <div>
          <p className="font-semibold">🥷 TRUE Anonymous Swap Ready!</p>
          <p className="text-xs mt-1">Deposit to relayer pool to execute</p>
        </div>
      );

    } catch (error) {
      console.error('Relayer swap error:', error);
      toast.error(error.message || 'Relayer swap failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Send deposit to relayer pool
  const sendDepositToRelayer = async () => {
    if (!relayerDeposit || !connected) return;

    try {
      setIsLoading(true);
      toast.loading('Preparing deposit transaction...', { id: 'deposit' });

      const depositAddress = new PublicKey(relayerDeposit.deposit.address);
      const amountLamports = relayerDeposit.deposit.amount;

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: depositAddress,
          lamports: amountLamports
        })
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      toast.dismiss('deposit');
      toast.loading('Please sign deposit transaction...', { id: 'sign' });

      // Sign and send
      const signed = await signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize());

      // Wait for confirmation
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txid
      });

      toast.dismiss('sign');
      toast.success(
        <div>
          <p className="font-semibold">✅ Deposit Sent!</p>
          <p className="text-xs mt-1 font-mono">{txid.slice(0, 20)}...</p>
          <p className="text-xs text-purple-400 mt-1">
            🥷 Relayer will execute swap privately...
          </p>
        </div>
      );

      setDepositSent(true);

      // Update result
      setSwapResult(prev => ({
        ...prev,
        depositTxid: txid,
        status: 'deposit_sent'
      }));

      // Start polling for swap completion
      pollSwapStatus(relayerDeposit.swapId, txid);

    } catch (error) {
      toast.dismiss('deposit');
      toast.dismiss('sign');
      console.error('Deposit error:', error);
      toast.error(error.message || 'Deposit failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for swap status after deposit
  const pollSwapStatus = async (swapId, depositTxid) => {
    const maxPolls = 60; // 5 minutes max
    let polls = 0;
    
    const checkStatus = async () => {
      polls++;
      if (polls > maxPolls) {
        toast.error('Swap taking longer than expected. Check status manually.');
        return;
      }
      
      try {
        const response = await fetch(`${API_BASE}/relayer/status/${swapId}`);
        const status = await response.json();
        
        if (status.status === 'completed') {
          toast.success(
            <div>
              <p className="font-semibold">🎉 Anonymous Swap Complete!</p>
              <p className="text-xs mt-1">Tokens are in your stealth wallet</p>
              <p className="text-xs text-green-400 mt-1">
                Import the private key to Phantom to access
              </p>
            </div>,
            { duration: 10000 }
          );
          
          setSwapResult(prev => ({
            ...prev,
            ...status,
            status: 'completed'
          }));
          return;
        }
        
        if (status.status === 'failed') {
          toast.error(`Swap failed: ${status.error}`);
          return;
        }
        
        // Keep polling
        setTimeout(checkStatus, 5000);
      } catch (e) {
        // Keep trying
        setTimeout(checkStatus, 5000);
      }
    };
    
    // Start polling after a brief delay
    setTimeout(checkStatus, 3000);
  };

  // Execute the anonymous swap (old mode)
  const executeSwap = async () => {
    // If relayer mode is enabled, use relayer
    if (useRelayer) {
      return executeRelayerSwap();
    }

    if (!connected) {
      connect();
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Enter an amount');
      return;
    }

    if (!outputToken && !customOutputMint) {
      toast.error('Select output token');
      return;
    }

    setIsLoading(true);
    setSwapResult(null);
    setStealthKeys(null);

    try {
      const inputMint = inputToken.mint;
      const outputMint = outputToken?.mint || customOutputMint;
      const amountInSmallestUnit = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputToken.decimals));

      // Step 1: Create anonymous swap with stealth receiving
      const endpoint = useStealthReceiving ? '/anonswap/stealth-swap' : '/anonswap/create';
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amountInSmallestUnit.toString(),
          senderWallet: publicKey.toString(),
          timeDelay,
          slippageBps: slippage * 100,
          ...(useStealthReceiving ? {} : { recipientMetaAddress: null })
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Swap creation failed');
      }

      // Save stealth keys if provided
      if (data.stealthKeys) {
        setStealthKeys(data.stealthKeys);
      }

      // Step 2: If swap is ready, get transaction and sign it
      if (data.swap?.status === 'ready') {
        toast.loading('Getting swap transaction...', { id: 'exec' });
        
        const execResponse = await fetch(`${API_BASE}/anonswap/execute/${data.swap.swapId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const execData = await execResponse.json();
        toast.dismiss('exec');

        if (execData.swapTransaction) {
          // We have a real transaction to sign!
          toast.loading('Please sign the transaction in your wallet...', { id: 'sign' });
          
          try {
            // Decode the base64 transaction
            const swapTransactionBuf = Buffer.from(execData.swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
            
            // Sign with wallet
            const signedTransaction = await signTransaction(transaction);
            
            // Send the signed transaction
            const rawTransaction = signedTransaction.serialize();
            const txid = await sendTransaction(signedTransaction, connection);
            
            toast.dismiss('sign');
            toast.success(
              <div>
                <p className="font-semibold">✅ Swap executed!</p>
                <p className="text-xs mt-1 font-mono">{txid.slice(0, 20)}...</p>
              </div>
            );
            
            // Update result with txid
            data.transactionSignature = txid;
            data.swap.status = 'completed';
          } catch (signError) {
            toast.dismiss('sign');
            console.error('Sign error:', signError);
            toast.error('Transaction signing failed: ' + signError.message);
          }
        } else if (execData.demoMode) {
          // Demo mode - privacy layer worked but Jupiter swap unavailable
          toast.success(
            <div>
              <p className="font-semibold">🥷 Privacy Layer Complete!</p>
              <p className="text-xs mt-1">Stealth address generated. Jupiter swap pending.</p>
            </div>
          );
        }
      }

      setSwapResult(data);

      if (!data.swap?.status?.includes('complete')) {
        toast.success(
          <div>
            <p className="font-semibold">🥷 Anonymous Swap Created!</p>
            <p className="text-xs mt-1">
              {data.swap?.privacy?.stealthReceiving 
                ? 'Output will go to stealth address' 
                : 'Swap initiated'}
            </p>
            {data.swap?.delaySeconds > 0 && (
              <p className="text-xs text-yellow-400">
                ⏱️ Executing in {data.swap.delaySeconds}s (privacy delay)
              </p>
            )}
          </div>
        );
      }

    } catch (error) {
      console.error('Swap error:', error);
      toast.error(error.message || 'Swap failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const swapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken || POPULAR_TOKENS[0]);
    setOutputToken(temp);
    setInputAmount(outputAmount.replace('~', ''));
    setOutputAmount('');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
          <Shield className="w-8 h-8 text-purple-500" />
          Anoncoin Swap
        </h1>
        <p className="text-gray-400 mt-2">
          Privacy-preserving swaps for Anoncoin-launched tokens
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-purple-900/30 rounded-full text-xs text-purple-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Stealth addresses • Timing obfuscation • Hidden receivers
        </div>
      </div>

      {/* Main Swap Card */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        
        {/* Input Token */}
        <div className="bg-gray-800 rounded-xl p-4 mb-2">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-400">You pay</span>
            <span className="text-sm text-gray-400">
              Balance: {connected ? '...' : '0'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-semibold outline-none"
            />
            <button
              onClick={() => setShowTokenSelect('input')}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2 transition-colors"
            >
              <span className="text-xl">{inputToken.logo}</span>
              <span className="font-semibold">{inputToken.symbol}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={swapTokens}
            className="bg-gray-700 hover:bg-gray-600 rounded-xl p-2 border-4 border-gray-900 transition-colors"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        {/* Output Token */}
        <div className="bg-gray-800 rounded-xl p-4 mt-2">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-400">You receive</span>
            {useStealthReceiving && (
              <span className="text-xs text-purple-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Stealth address
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={isGettingQuote ? '...' : outputAmount}
              readOnly
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-semibold outline-none text-gray-300"
            />
            {outputToken ? (
              <button
                onClick={() => setShowTokenSelect('output')}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2 transition-colors"
              >
                <span className="text-xl">{outputToken.logo}</span>
                <span className="font-semibold">{outputToken.symbol}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowTokenSelect('output')}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 rounded-xl px-4 py-2 transition-colors"
              >
                Select token
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Custom token input */}
          {!outputToken && (
            <input
              type="text"
              value={customOutputMint}
              onChange={(e) => setCustomOutputMint(e.target.value)}
              placeholder="Or paste token mint address..."
              className="w-full mt-3 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
          )}
        </div>

        {/* Privacy Options */}
        <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              Privacy Settings
            </span>
            <button
              onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
              className="text-gray-400 hover:text-white"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {showPrivacyInfo && (
            <div className="mb-4 p-3 bg-purple-900/30 rounded-lg text-sm text-gray-300 space-y-2">
              <p className="text-purple-400 font-semibold">🛡️ What's Protected:</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li><strong>Receiver identity</strong> - Stealth address is not linked to your wallet</li>
                <li><strong>Timing correlation</strong> - Random delays break chain analysis</li>
                <li><strong>Wallet connection</strong> - No on-chain link between you and stealth address</li>
              </ul>
              <p className="text-yellow-400 font-semibold mt-2">⚠️ What's Still Visible:</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li><strong>Stealth balance</strong> - Anyone can see tokens at the stealth address</li>
                <li><strong>Swap amounts</strong> - Transaction amounts visible on DEX</li>
              </ul>
              <p className="text-xs text-gray-400 mt-2">
                💡 Tip: Use time delays and withdraw at different times for maximum privacy.
              </p>
            </div>
          )}

          {/* TRUE Anonymous Mode (Relayer) */}
          <div className="flex items-center justify-between py-2 border-b border-gray-700 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium">TRUE Anonymous (Relayer)</span>
              {useRelayer && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
            </div>
            <button
              onClick={() => setUseRelayer(!useRelayer)}
              className={`w-12 h-6 rounded-full transition-colors ${
                useRelayer ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                useRelayer ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {useRelayer && (
            <div className="mb-3 p-3 bg-green-900/20 rounded-lg border border-green-800/50">
              <p className="text-xs text-green-400 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Maximum Privacy
              </p>
              <ul className="text-xs text-gray-300 mt-2 space-y-1">
                <li>✓ Your wallet is <strong>NOT</strong> in swap transaction</li>
                <li>✓ You deposit to shared relayer pool</li>
                <li>✓ Relayer executes swap → stealth address</li>
                <li>✓ No on-chain link between you and output!</li>
              </ul>
            </div>
          )}

          {/* Stealth Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Stealth Receiving</span>
            </div>
            <button
              onClick={() => setUseStealthReceiving(!useStealthReceiving)}
              className={`w-12 h-6 rounded-full transition-colors ${
                useStealthReceiving ? 'bg-purple-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                useStealthReceiving ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Time Delay */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Privacy Delay</span>
            </div>
            <select
              value={timeDelay}
              onChange={(e) => setTimeDelay(e.target.value)}
              className="bg-gray-700 rounded-lg px-3 py-1 text-sm outline-none"
            >
              <option value="none">None</option>
              <option value="short">Short (30-60s)</option>
              <option value="medium">Medium (1-3min)</option>
              <option value="long">Long (3-5min)</option>
              <option value="random">Random</option>
            </select>
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Slippage</span>
            </div>
            <div className="flex gap-1">
              {[0.5, 1, 2].map(val => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    slippage === val
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={isLoading || !inputAmount || (useRelayer && relayerDeposit && !depositSent)}
          className={`w-full mt-4 py-4 rounded-xl font-semibold text-lg transition-all ${
            connected
              ? useRelayer 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
              : 'bg-purple-600 hover:bg-purple-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : !connected ? (
            'Connect Wallet'
          ) : useRelayer && relayerDeposit && !depositSent ? (
            <span className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              Deposit Required (see below)
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              {useRelayer ? '🥷 TRUE Anonymous Swap' : outputToken?.isAnoncoin ? '🥷 Swap to Anoncoin Token' : 'Anonymous Swap'}
            </span>
          )}
        </button>
      </div>

      {/* Relayer Deposit Step */}
      <AnimatePresence>
        {useRelayer && relayerDeposit && !depositSent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gray-900 rounded-2xl p-6 border border-green-500/30"
          >
            <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" />
              Step 2: Deposit to Relayer Pool
            </h3>

            <div className="space-y-4">
              {/* Privacy Explanation */}
              <div className="p-3 bg-green-900/20 rounded-lg border border-green-800/50">
                <p className="text-xs text-green-400 mb-2">🥷 TRUE ANONYMOUS FLOW:</p>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                  <li>You deposit to shared pool (below)</li>
                  <li>Relayer executes swap (your wallet NOT in tx)</li>
                  <li>Output arrives at your stealth address</li>
                </ol>
              </div>

              {/* Deposit Info */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Deposit Address (Relayer Pool)</span>
                  <button 
                    onClick={() => copyToClipboard(relayerDeposit.deposit.address, 'Address')}
                    className="text-gray-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-sm break-all text-green-400">
                  {relayerDeposit.deposit.address}
                </p>
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <span className="text-gray-400 text-sm">Deposit Amount</span>
                <p className="font-semibold text-xl mt-1">
                  {relayerDeposit.deposit.amountSOL || (relayerDeposit.deposit.amount / 1e9).toFixed(4)} SOL
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Fee: {relayerDeposit.fees?.relayerFeeSOL || 0.0025} SOL | Swap: {relayerDeposit.fees?.swapAmountSOL || (relayerDeposit.deposit.amount / 1e9 - 0.0025).toFixed(4)} SOL
                </p>
              </div>

              {/* Stealth Output */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Output Stealth Address</span>
                  <button 
                    onClick={() => copyToClipboard(relayerDeposit.stealthKeys?.address || relayerDeposit.privacy?.stealthAddress, 'Stealth Address')}
                    className="text-gray-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-xs break-all text-purple-400">
                  {relayerDeposit.stealthKeys?.address || relayerDeposit.privacy?.stealthAddress}
                </p>
              </div>

              {/* Privacy Guarantees */}
              <div className="text-xs text-gray-400 space-y-1">
                {relayerDeposit.privacy.guarantees?.map((g, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    {g}
                  </p>
                ))}
              </div>

              {/* Deposit Button */}
              <button
                onClick={sendDepositToRelayer}
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-5 h-5 animate-spin" />
                    Sending deposit...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    Send Deposit & Execute Swap
                  </span>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                After deposit, relayer will execute your swap privately in ~{relayerDeposit.privacy?.delaySeconds || 30} seconds
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit Sent Confirmation */}
      <AnimatePresence>
        {useRelayer && depositSent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gray-900 rounded-2xl p-6 border border-green-500/30"
          >
            <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-4">
              <Check className="w-5 h-5" />
              ✅ Deposit Sent - Swap Executing!
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-green-900/20 rounded-lg">
                <p className="text-green-400 text-sm font-semibold mb-2">🥷 TRUE Anonymous Swap in Progress</p>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li>✓ Deposit received by relayer pool</li>
                  <li>⏳ Relayer executing swap (your wallet NOT in tx)</li>
                  <li>🎯 Output will arrive at stealth address</li>
                </ul>
              </div>

              {swapResult?.depositTxid && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <span className="text-gray-400 text-sm">Deposit Transaction</span>
                  <a 
                    href={`https://solscan.io/tx/${swapResult.depositTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                  >
                    {swapResult.depositTxid.slice(0, 20)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="bg-gray-800 rounded-xl p-4">
                <span className="text-gray-400 text-sm">Output Stealth Address</span>
                <p className="font-mono text-xs break-all text-purple-400 mt-1">
                  {relayerDeposit?.privacy?.stealthAddress}
                </p>
              </div>

              <p className="text-xs text-center text-gray-500">
                ⏱️ Allow ~{relayerDeposit?.privacy?.delaySeconds || 30}s for swap execution
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Result */}
      <AnimatePresence>
        {swapResult && !useRelayer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gray-900 rounded-2xl p-6 border border-green-500/30"
          >
            <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-4">
              <Check className="w-5 h-5" />
              Swap Created Successfully
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Swap ID</span>
                <span className="font-mono">{swapResult.swap?.swapId?.substring(0, 12)}...</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`${swapResult.swap?.status === 'scheduled' ? 'text-yellow-400' : 'text-green-400'}`}>
                  {swapResult.swap?.status}
                </span>
              </div>

              {swapResult.swap?.delaySeconds > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Executing in</span>
                  <span className="text-yellow-400">{swapResult.swap.delaySeconds} seconds</span>
                </div>
              )}

              {swapResult.swap?.privacy?.stealthAddress && (
                <div className="mt-4 p-3 bg-purple-900/30 rounded-lg">
                  <p className="text-purple-400 text-xs mb-2">🔒 Stealth Output Address</p>
                  <p className="font-mono text-xs break-all">{swapResult.swap.privacy.stealthAddress}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stealth Keys Warning */}
      <AnimatePresence>
        {stealthKeys && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-yellow-900/30 rounded-2xl p-6 border border-yellow-500/50"
          >
            <h3 className="font-semibold text-yellow-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              SAVE YOUR STEALTH KEYS!
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              You need these keys to access your swapped tokens. Save them securely!
            </p>

            <div className="space-y-3">
              {/* STEALTH ADDRESS */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Stealth Address (where tokens go)</span>
                  <button
                    onClick={() => copyToClipboard(stealthKeys.stealthAddress || stealthKeys.address, 'Stealth address')}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-xs break-all text-green-400">{stealthKeys.stealthAddress || stealthKeys.address}</p>
              </div>

              {/* STEALTH PRIVATE KEY - THE IMPORTANT ONE! */}
              <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-purple-400 font-semibold">🔑 WALLET PRIVATE KEY (import to Phantom!)</span>
                  <button
                    onClick={() => copyToClipboard(stealthKeys.stealthPrivateKey || stealthKeys.privateKey, 'Wallet Private Key')}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-xs break-all text-purple-300">{stealthKeys.stealthPrivateKey || stealthKeys.privateKey}</p>
                <p className="text-xs text-purple-400/70 mt-2">
                  ⚠️ Import this into Phantom/Solflare to access your tokens!
                </p>
              </div>

              {/* Viewing Key */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Viewing Key (for scanning)</span>
                  <button
                    onClick={() => copyToClipboard(stealthKeys.viewingPrivKey, 'Viewing key')}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-xs break-all">{stealthKeys.viewingPrivKey}</p>
              </div>

              <button
                onClick={() => {
                  const addr = stealthKeys.stealthAddress || stealthKeys.address;
                  const privKey = stealthKeys.stealthPrivateKey || stealthKeys.privateKey;
                  const keysText = `ShadowFi Stealth Wallet Keys\n\n⚠️ NEVER SHARE THESE KEYS!\n\nStealth Address: ${addr}\n\n🔑 WALLET PRIVATE KEY (import to Phantom):\n${privKey}\n\nViewing Key: ${stealthKeys.viewingPrivKey || 'N/A'}\nMeta Address: ${stealthKeys.metaAddress || 'N/A'}`;
                  copyToClipboard(keysText, 'All keys');
                }}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-semibold transition-colors"
              >
                Copy All Keys
              </button>
              
              <button
                onClick={() => {
                  const addr = stealthKeys.stealthAddress || stealthKeys.address;
                  const privKey = stealthKeys.stealthPrivateKey || stealthKeys.privateKey;
                  const keysJson = JSON.stringify({
                    warning: "NEVER SHARE THESE KEYS! Anyone with these can spend your tokens.",
                    createdAt: new Date().toISOString(),
                    stealthAddress: addr,
                    stealthPrivateKey: privKey,
                    viewingKey: stealthKeys.viewingPrivKey || null,
                    spendingPubKey: stealthKeys.spendingPubKey || null,
                    metaAddress: stealthKeys.metaAddress || null
                  }, null, 2);
                  const blob = new Blob([keysJson], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `stealth-wallet-${addr?.slice(0,8)}-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Keys downloaded!');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition-colors"
              >
                📥 Download Keys as File
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Select Modal */}
      <AnimatePresence>
        {showTokenSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowTokenSelect(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-4">Select Token</h3>
              
              {/* Anoncoin-launched tokens - highlighted! */}
              {ANONCOIN_TOKENS.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Anoncoin-Launched (Privacy Tokens)
                  </p>
                  <div className="space-y-2">
                    {ANONCOIN_TOKENS.map(token => (
                      <button
                        key={token.mint}
                        onClick={() => {
                          if (showTokenSelect === 'input') {
                            setInputToken(token);
                          } else {
                            setOutputToken(token);
                            setCustomOutputMint('');
                          }
                          setShowTokenSelect(null);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-900/30 border border-purple-500/30 hover:border-purple-500/60 transition-colors"
                      >
                        <span className="text-2xl">{token.logo}</span>
                        <div className="text-left flex-1">
                          <p className="font-semibold text-purple-300">{token.symbol}</p>
                          <p className="text-xs text-gray-400">{token.mint.substring(0, 8)}...</p>
                        </div>
                        <span className="text-xs bg-purple-500 px-2 py-0.5 rounded">ANONCOIN</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Base tokens */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Base Tokens</p>
                <div className="space-y-2">
                  {BASE_TOKENS.map(token => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        if (showTokenSelect === 'input') {
                          setInputToken(token);
                        } else {
                          setOutputToken(token);
                          setCustomOutputMint('');
                        }
                        setShowTokenSelect(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-2xl">{token.logo}</span>
                      <div className="text-left">
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-gray-400">{token.mint.substring(0, 8)}...</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular memecoins */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Popular Memecoins</p>
                <div className="space-y-2">
                  {MEMECOIN_TOKENS.map(token => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        if (showTokenSelect === 'input') {
                          setInputToken(token);
                        } else {
                          setOutputToken(token);
                          setCustomOutputMint('');
                        }
                        setShowTokenSelect(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-2xl">{token.logo}</span>
                      <div className="text-left">
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-gray-400">{token.mint.substring(0, 8)}...</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Custom mint input */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Or paste any token mint address</p>
                <input
                  type="text"
                  placeholder="Enter mint address..."
                  value={customOutputMint}
                  onChange={(e) => setCustomOutputMint(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                />
                {customOutputMint && (
                  <button
                    onClick={() => {
                      setOutputToken({ symbol: 'CUSTOM', mint: customOutputMint, decimals: 9, logo: '🪙' });
                      setShowTokenSelect(null);
                    }}
                    className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Use This Token
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowTokenSelect(null)}
                className="w-full mt-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
