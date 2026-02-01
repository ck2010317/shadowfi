import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  Upload,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  Loader,
  Twitter,
  MessageCircle,
  Globe,
  Zap,
  Wallet,
  Shield,
  Key,
  AlertTriangle
} from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { tokenAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Relayer wallet that executes pre-buys
const RELAYER_WALLET = '3JP7VYq4iqtZH5tx6KsVGCvckFQtUgXipo5bnQr7yQPZ';
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1';

export default function TokenLaunch() {
  const { connected, connect, publicKey, signAndSendTransaction } = useWallet();
  
  const [step, setStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState(null);
  
  const [tokenData, setTokenData] = useState({
    name: '',
    symbol: '',
    description: '',
    image: null,
    imagePreview: null,
    twitter: '',
    telegram: '',
    website: '',
  });

  const [preBuyData, setPreBuyData] = useState({
    enabled: true,
    totalSol: '0.1',
    numWallets: '5',
  });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTokenData(prev => ({
          ...prev,
          image: file,
          imagePreview: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLaunch = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!tokenData.name || !tokenData.symbol) {
      toast.error('Token name and symbol are required');
      return;
    }

    if (!tokenData.imagePreview) {
      toast.error('Token image is required');
      return;
    }

    if (!tokenData.description) {
      toast.error('Token description is required');
      return;
    }

    setIsLaunching(true);

    try {
      let result;

      if (preBuyData.enabled) {
        const totalSol = parseFloat(preBuyData.totalSol);
        const numWallets = parseInt(preBuyData.numWallets);
        
        // Add buffer for fees (0.01 SOL per wallet for ATA creation + tx fees)
        const feeBuffer = numWallets * 0.01;
        const totalNeeded = totalSol + feeBuffer;
        
        // Step 1: Send SOL to relayer for pre-buys
        toast.loading(`Sending ${totalNeeded.toFixed(3)} SOL for pre-buys...`, { id: 'payment' });
        
        try {
          const connection = new Connection(RPC_URL, 'confirmed');
          const relayerPubkey = new PublicKey(RELAYER_WALLET);
          const userPubkey = new PublicKey(publicKey);
          
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: userPubkey,
              toPubkey: relayerPubkey,
              lamports: Math.floor(totalNeeded * LAMPORTS_PER_SOL)
            })
          );
          
          // Get recent blockhash
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = userPubkey;
          
          // Sign and send via wallet
          const paymentSig = await signAndSendTransaction(transaction);
          console.log('Payment sent:', paymentSig);
          
          toast.dismiss('payment');
          toast.success(`Payment sent! TX: ${paymentSig.slice(0, 8)}...`);
          
        } catch (paymentError) {
          toast.dismiss('payment');
          throw new Error(`Payment failed: ${paymentError.message}`);
        }
        
        // Step 2: Launch + Pre-buy bundled
        toast.loading('Launching token + executing pre-buys...', { id: 'launch' });
        
        result = await tokenAPI.launchWithPreBuy({
          token: {
            name: tokenData.name,
            symbol: tokenData.symbol.toUpperCase(),
            description: tokenData.description,
            image: tokenData.imagePreview,
            twitter: tokenData.twitter || '',
            telegram: tokenData.telegram || '',
          },
          preBuy: {
            totalSol: totalSol,
            numWallets: numWallets,
          }
        });

        toast.dismiss('launch');
        
        if (result.success) {
          toast.success(
            <div>
              <p className="font-semibold">🚀 Token Launched + Pre-Buy Complete!</p>
              <p className="text-xs mt-1">{result.preBuy.successfulBuys}/{result.preBuy.totalWallets} buys succeeded</p>
            </div>
          );
        }
      } else {
        // Just launch (no pre-buy)
        result = await tokenAPI.deploy({
          name: tokenData.name,
          symbol: tokenData.symbol.toUpperCase(),
          description: tokenData.description,
          image: tokenData.imagePreview,
          twitter: tokenData.twitter || '',
          telegram: tokenData.telegram || '',
        });

        if (result.tokenAddress) {
          result = {
            success: true,
            token: {
              address: result.tokenAddress,
              name: tokenData.name,
              symbol: tokenData.symbol,
              transactionSignature: result.transactionSignature,
              confirmed: result.confirmed
            },
            preBuy: null
          };
          toast.success('Token launched!');
        }
      }

      setLaunchResult(result);
      setStep(2);

    } catch (error) {
      console.error('Launch failed:', error);
      toast.dismiss('launch');
      toast.error(error.message || 'Launch failed. Please try again.');
    } finally {
      setIsLaunching(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyAllPrivateKeys = () => {
    if (!launchResult?.preBuy?.wallets) return;
    
    const keys = launchResult.preBuy.wallets.map((w, i) => 
      `Wallet ${i + 1}: ${w.privateKey}`
    ).join('\n');
    
    navigator.clipboard.writeText(keys);
    toast.success('All private keys copied!');
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-shadow-400" />
              Token Details
            </h2>

            {/* Image Upload */}
            <div>
              <label className="block text-sm text-dark-400 mb-2">Token Image *</label>
              <div className="flex items-center gap-4">
                <div 
                  className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden ${
                    tokenData.imagePreview ? 'border-shadow-500' : 'border-dark-300'
                  }`}
                >
                  {tokenData.imagePreview ? (
                    <img src={tokenData.imagePreview} alt="Token" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-8 h-8 text-dark-400" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="token-image"
                  />
                  <label 
                    htmlFor="token-image"
                    className="btn-secondary cursor-pointer inline-block"
                  >
                    Upload Image
                  </label>
                  <p className="text-xs text-dark-400 mt-1">PNG, JPG up to 2MB</p>
                </div>
              </div>
            </div>

            {/* Name & Symbol */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2">Token Name *</label>
                <input
                  type="text"
                  value={tokenData.name}
                  onChange={(e) => setTokenData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Shadow Token"
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-2">Symbol *</label>
                <input
                  type="text"
                  value={tokenData.symbol}
                  onChange={(e) => setTokenData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder="SHDW"
                  maxLength={8}
                  className="input-dark"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-dark-400 mb-2">Description *</label>
              <textarea
                value={tokenData.description}
                onChange={(e) => setTokenData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your token..."
                rows={3}
                className="input-dark resize-none"
              />
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <label className="block text-sm text-dark-400">Social Links (Optional)</label>
              
              <div className="flex items-center gap-3">
                <Twitter className="w-5 h-5 text-dark-400 flex-shrink-0" />
                <input
                  type="text"
                  value={tokenData.twitter}
                  onChange={(e) => setTokenData(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="https://twitter.com/yourtoken"
                  className="input-dark flex-1"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-dark-400 flex-shrink-0" />
                <input
                  type="text"
                  value={tokenData.telegram}
                  onChange={(e) => setTokenData(prev => ({ ...prev, telegram: e.target.value }))}
                  placeholder="https://t.me/yourtoken"
                  className="input-dark flex-1"
                />
              </div>
            </div>

            {/* PRE-BUY SECTION */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-shadow-500/10 to-neon-green/10 border border-shadow-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-neon-green" />
                  <div>
                    <p className="font-semibold">Anonymous Pre-Buy</p>
                    <p className="text-xs text-dark-400">Buy your token instantly via stealth wallets</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreBuyData(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    preBuyData.enabled ? 'bg-neon-green' : 'bg-dark-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    preBuyData.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {preBuyData.enabled && (
                <div className="space-y-4 pt-2 border-t border-dark-200">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Total SOL to Buy</label>
                      <input
                        type="text"
                        value={preBuyData.totalSol}
                        onChange={(e) => setPreBuyData(prev => ({ ...prev, totalSol: e.target.value }))}
                        placeholder="0.1"
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Number of Wallets</label>
                      <select
                        value={preBuyData.numWallets}
                        onChange={(e) => setPreBuyData(prev => ({ ...prev, numWallets: e.target.value }))}
                        className="input-dark"
                      >
                        {[1, 2, 3, 5, 10, 15, 20].map(n => (
                          <option key={n} value={n}>{n} wallets</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-200/50 text-sm">
                    <div className="flex justify-between text-dark-400">
                      <span>SOL per wallet:</span>
                      <span className="text-white">
                        {(parseFloat(preBuyData.totalSol || 0) / parseInt(preBuyData.numWallets || 1)).toFixed(4)} SOL
                      </span>
                    </div>
                    <div className="flex justify-between text-dark-400 mt-1">
                      <span>Fee buffer (ATA + tx fees):</span>
                      <span className="text-white">
                        ~{(parseInt(preBuyData.numWallets || 1) * 0.01).toFixed(3)} SOL
                      </span>
                    </div>
                    <div className="flex justify-between text-neon-green font-semibold mt-2 pt-2 border-t border-dark-300">
                      <span>Total you'll pay:</span>
                      <span>
                        {(parseFloat(preBuyData.totalSol || 0) + parseInt(preBuyData.numWallets || 1) * 0.01).toFixed(3)} SOL
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mt-2">
                      <Shield className="w-3 h-3 inline mr-1" />
                      You pay for your pre-buys. Buys execute immediately after launch via stealth wallets. You get private keys to access tokens.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Button */}
            {connected ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLaunch}
                disabled={isLaunching || !tokenData.name || !tokenData.symbol || !tokenData.imagePreview || !tokenData.description}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-shadow-600 to-neon-green font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLaunching ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>{preBuyData.enabled ? 'Launching + Pre-Buying...' : 'Deploying...'}</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    <span>{preBuyData.enabled ? 'Launch + Pre-Buy' : 'Launch Token'}</span>
                  </>
                )}
              </motion.button>
            ) : (
              <button onClick={connect} className="w-full btn-neon py-4">
                Connect Wallet to Launch
              </button>
            )}
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-shadow-500 to-neon-green flex items-center justify-center"
            >
              <Check className="w-10 h-10" />
            </motion.div>

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                {launchResult?.preBuy ? '🚀 Launched + Pre-Buy Complete!' : '🚀 Token Launched!'}
              </h2>
              <p className="text-dark-400">
                {launchResult?.preBuy 
                  ? `${launchResult.preBuy.successfulBuys} wallets bought your token`
                  : 'Your token is now live on Solana'}
              </p>
            </div>

            {/* Token Info */}
            <div className="p-4 rounded-xl bg-dark-100 border border-dark-200">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-shadow-400" />
                Token Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-dark-400">Name</span>
                  <span>{launchResult?.token?.name} ({launchResult?.token?.symbol})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-dark-400">Address</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-shadow-400 bg-dark-200 px-2 py-1 rounded truncate max-w-[200px]">
                      {launchResult?.token?.address}
                    </code>
                    <button onClick={() => copyToClipboard(launchResult?.token?.address)} className="p-1 hover:bg-dark-200 rounded">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Buy Results */}
            {launchResult?.preBuy && (
              <div className="p-4 rounded-xl bg-dark-100 border border-neon-green/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 text-neon-green" />
                    Stealth Wallets ({launchResult.preBuy.successfulBuys}/{launchResult.preBuy.totalWallets})
                  </h3>
                  <button
                    onClick={copyAllPrivateKeys}
                    className="text-xs bg-neon-green/20 text-neon-green px-3 py-1 rounded-lg hover:bg-neon-green/30"
                  >
                    Copy All Keys
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {launchResult.preBuy.wallets.map((wallet, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg ${wallet.buyResult?.success ? 'bg-dark-200' : 'bg-red-500/10'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Wallet {i + 1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${wallet.buyResult?.success ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-400'}`}>
                          {wallet.buyResult?.success ? '✓ Bought' : '✗ Failed'}
                        </span>
                      </div>
                      <div className="text-xs text-dark-400 mb-1">
                        Address: {wallet.address?.substring(0, 20)}...
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-dark-300 px-2 py-1 rounded flex-1 truncate font-mono">
                          {wallet.privateKey?.substring(0, 30)}...
                        </code>
                        <button 
                          onClick={() => copyToClipboard(wallet.privateKey)}
                          className="p-1 hover:bg-dark-300 rounded"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs text-yellow-500 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Save these private keys!</strong> Import them into Phantom or Solflare to access your tokens.
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(1);
                  setLaunchResult(null);
                  setTokenData({
                    name: '', symbol: '', description: '',
                    image: null, imagePreview: null,
                    twitter: '', telegram: '', website: '',
                  });
                }}
                className="flex-1 btn-secondary"
              >
                Launch Another
              </button>
              <a 
                href={`https://solscan.io/token/${launchResult?.token?.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-neon flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on Solscan
              </a>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
          <Rocket className="w-8 h-8 text-shadow-500" />
          Launch Token
        </h1>
        <p className="text-dark-400 mt-1">
          Deploy + Pre-buy in one action — beat the snipers!
        </p>
      </div>

      {/* Main Content */}
      <div className="card">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      {/* Info */}
      {step === 1 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-dark-100 border border-dark-200">
            <Zap className="w-6 h-6 text-neon-green mb-2" />
            <h3 className="font-medium mb-1">Instant Pre-Buy</h3>
            <p className="text-xs text-dark-400">
              Your stealth wallets buy immediately after launch — before snipers can react.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-dark-100 border border-dark-200">
            <Shield className="w-6 h-6 text-shadow-400 mb-2" />
            <h3 className="font-medium mb-1">Stealth Wallets</h3>
            <p className="text-xs text-dark-400">
              Each wallet is unique. Export private keys to Phantom to access your tokens.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
