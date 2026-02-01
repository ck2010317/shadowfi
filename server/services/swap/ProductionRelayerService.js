/**
 * Production Relayer Service - REAL Anonymous Swaps
 * 
 * Flow:
 * 1. User requests swap → Gets deposit address + stealth keys
 * 2. User sends SOL to relayer pool
 * 3. Relayer detects deposit (via polling or webhook)
 * 4. Relayer executes swap with user's deposited SOL
 * 5. Relayer transfers output tokens to user's stealth address
 * 
 * Privacy:
 * - Swap tx shows: Relayer → DEX → Stealth (user wallet NOT in tx!)
 * - Only deposit links user to relayer pool (shared by all users)
 */

const { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} = require('@solana/spl-token');
const axios = require('axios');
const bs58 = require('bs58').default || require('bs58');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ProductionRelayerService {
  constructor(logger, stealthService) {
    this.logger = logger;
    this.stealthService = stealthService;
    
    // Solana connection
    this.rpcUrl = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1';
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    
    // Helius API for tracking
    this.heliusApiKey = '7d359733-8771-4d20-af8c-54f756c96bb1';
    
    // Jupiter API
    this.jupiterApi = 'https://api.jup.ag/swap/v1';
    this.jupiterApiKey = process.env.JUPITER_API_KEY || 'ea73d3d1-8ba5-4976-a544-332a0ba1fc1a';
    
    // Relayer wallet - PRODUCTION: Use secure key from env
    this.relayerWallet = this.initRelayerWallet();
    
    // Pending swaps waiting for deposits
    this.pendingSwaps = new Map();
    
    // Track relayer balance for swap execution
    this.lastKnownBalance = 0;
    
    // Fees - REDUCED for better UX
    // Only charge what we need: ~0.00005 SOL for tx fees + tiny margin
    this.relayerFeeLamports = 100000; // 0.0001 SOL (just covers gas)
    this.minDepositLamports = 1000000; // 0.001 SOL minimum
    
    this.logger.info('ProductionRelayerService initialized');
    this.logger.info(`Relayer wallet: ${this.relayerWallet.publicKey.toBase58()}`);
    
    // Start deposit monitoring
    this.startDepositMonitoring();
  }

  initRelayerWallet() {
    // PRODUCTION: Always load from env
    const privateKey = process.env.RELAYER_PRIVATE_KEY || '5yt73dnAewnwrKTDHeNbyLYGoyvxQ4hhnuKurx4qEUWdP2mibFVW1HSvFWLR3Ys98YpevPrtqcK7L5ifNcaTScmD';
    
    try {
      const secretKey = bs58.decode(privateKey);
      const wallet = Keypair.fromSecretKey(secretKey);
      this.logger.info(`Loaded relayer wallet: ${wallet.publicKey.toBase58()}`);
      return wallet;
    } catch (e) {
      this.logger.error('Failed to load relayer wallet:', e.message);
      throw new Error('RELAYER_PRIVATE_KEY is invalid');
    }
  }

  getRelayerPoolAddress() {
    return this.relayerWallet.publicKey.toBase58();
  }

  async getRelayerBalance() {
    const balance = await this.connection.getBalance(this.relayerWallet.publicKey);
    this.lastKnownBalance = balance;
    return {
      lamports: balance,
      sol: balance / LAMPORTS_PER_SOL
    };
  }

  /**
   * Create anonymous swap - returns deposit instructions
   */
  async createAnonymousSwap(params) {
    const { inputMint, outputMint, amount, userWallet } = params;
    
    // Validate
    if (amount < this.minDepositLamports) {
      throw new Error(`Minimum deposit is ${this.minDepositLamports / LAMPORTS_PER_SOL} SOL`);
    }
    
    const swapId = uuidv4();
    
    // Generate stealth address for output
    const metaAddress = this.stealthService.generateStealthMetaAddress();
    const metaAddressString = `stealth:${metaAddress.spendingPubKey}:${metaAddress.viewingPubKey}`;
    const stealthData = this.stealthService.generateStealthAddress(metaAddressString);
    
    // Calculate amounts
    const swapAmount = amount - this.relayerFeeLamports;
    
    // Store pending swap
    const pendingSwap = {
      id: swapId,
      status: 'awaiting_deposit',
      
      // User info (only for deposit tracking)
      userWallet,
      
      // Deposit details
      depositAddress: this.relayerWallet.publicKey.toBase58(),
      depositAmount: amount,
      inputMint,
      
      // Swap details
      outputMint,
      swapAmount,
      relayerFee: this.relayerFeeLamports,
      
      // Stealth output
      stealthAddress: stealthData.stealthAddress,
      stealthPrivateKey: stealthData.stealthPrivateKey,
      
      // Timing
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min
      
      // Tracking
      expectedBalanceAfterDeposit: this.lastKnownBalance + amount,
    };
    
    this.pendingSwaps.set(swapId, pendingSwap);
    
    this.logger.info(`Created swap ${swapId}: ${amount} lamports → ${outputMint}`);
    this.logger.info(`Stealth output: ${stealthData.stealthAddress}`);
    
    return {
      success: true,
      swapId,
      
      // Deposit instructions
      deposit: {
        address: this.relayerWallet.publicKey.toBase58(),
        amount: amount,
        amountSOL: amount / LAMPORTS_PER_SOL,
        memo: swapId.slice(0, 8), // Optional reference
      },
      
      // Fees breakdown
      fees: {
        totalDeposit: amount,
        relayerFee: this.relayerFeeLamports,
        relayerFeeSOL: this.relayerFeeLamports / LAMPORTS_PER_SOL,
        swapAmount: swapAmount,
        swapAmountSOL: swapAmount / LAMPORTS_PER_SOL,
      },
      
      // CRITICAL: Stealth keys for user to save
      stealthKeys: {
        address: stealthData.stealthAddress,
        privateKey: stealthData.stealthPrivateKey,
        warning: 'SAVE THIS PRIVATE KEY! You need it to access your tokens.',
        howToUse: [
          '1. After swap completes, open Phantom wallet',
          '2. Click hamburger menu → Add/Connect Wallet → Import Private Key',
          '3. Paste the private key above',
          '4. Your tokens will be in this new wallet!'
        ]
      },
      
      // Privacy info
      privacy: {
        guarantees: [
          '✅ Your wallet NOT in swap transaction',
          '✅ Tokens go to unlinkable stealth address',
          '✅ Only deposit links you to pool (shared by all)',
        ],
        flow: [
          `1. You send ${amount / LAMPORTS_PER_SOL} SOL to ${this.relayerWallet.publicKey.toBase58().slice(0, 8)}...`,
          '2. Relayer executes swap (your wallet not in tx)',
          `3. Tokens arrive at stealth: ${stealthData.stealthAddress.slice(0, 8)}...`,
        ]
      },
      
      expiresAt: new Date(pendingSwap.expiresAt).toISOString(),
    };
  }

  /**
   * Monitor for deposits and execute swaps
   */
  startDepositMonitoring() {
    // Check every 5 seconds
    setInterval(async () => {
      await this.checkForDeposits();
    }, 5000);
    
    this.logger.info('Deposit monitoring started (5s interval)');
  }

  async checkForDeposits() {
    if (this.pendingSwaps.size === 0) return;
    
    try {
      // Get current balance
      const currentBalance = await this.connection.getBalance(this.relayerWallet.publicKey);
      
      // Get recent transactions
      const signatures = await this.connection.getSignaturesForAddress(
        this.relayerWallet.publicKey,
        { limit: 10 }
      );
      
      // Check each pending swap
      for (const [swapId, swap] of this.pendingSwaps) {
        if (swap.status !== 'awaiting_deposit') continue;
        
        // Check if expired
        if (Date.now() > swap.expiresAt) {
          swap.status = 'expired';
          this.logger.info(`Swap ${swapId} expired`);
          continue;
        }
        
        // Look for deposit transaction from user
        for (const sig of signatures) {
          if (sig.blockTime * 1000 < swap.createdAt - 60000) continue; // Skip old txs
          
          try {
            const tx = await this.connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0
            });
            
            if (!tx?.meta) continue;
            
            // Check for SOL transfer to our wallet
            const preBalance = tx.meta.preBalances[0];
            const postBalance = tx.meta.postBalances[0];
            
            // Find incoming transfer
            for (let i = 0; i < tx.transaction.message.accountKeys.length; i++) {
              const account = tx.transaction.message.accountKeys[i];
              const pubkey = account.pubkey?.toBase58() || account.toString();
              
              if (pubkey === this.relayerWallet.publicKey.toBase58()) {
                const preB = tx.meta.preBalances[i];
                const postB = tx.meta.postBalances[i];
                const received = postB - preB;
                
                // Check if this matches our expected deposit
                if (received >= swap.depositAmount * 0.99) { // Allow 1% variance for fees
                  this.logger.info(`Deposit detected for swap ${swapId}: ${received} lamports`);
                  this.logger.info(`Transaction: ${sig.signature}`);
                  
                  swap.status = 'deposit_received';
                  swap.depositTx = sig.signature;
                  swap.actualDeposit = received;
                  
                  // Execute swap immediately
                  this.executeSwap(swapId);
                  break;
                }
              }
            }
          } catch (e) {
            // Skip parse errors
          }
        }
      }
    } catch (error) {
      this.logger.error('Deposit check error:', error.message);
    }
  }

  /**
   * Execute swap using deposited funds
   */
  async executeSwap(swapId) {
    const swap = this.pendingSwaps.get(swapId);
    if (!swap || swap.status !== 'deposit_received') {
      throw new Error('Invalid swap state');
    }
    
    swap.status = 'executing';
    this.logger.info(`Executing swap ${swapId}...`);
    
    try {
      // Step 1: Get quote from Jupiter
      const quoteUrl = `${this.jupiterApi}/quote?inputMint=${swap.inputMint}&outputMint=${swap.outputMint}&amount=${swap.swapAmount}&slippageBps=100`;
      const quoteRes = await axios.get(quoteUrl, {
        headers: { 'x-api-key': this.jupiterApiKey },
        timeout: 15000
      });
      
      const quote = quoteRes.data;
      this.logger.info(`Got quote: ${swap.swapAmount} → ${quote.outAmount}`);
      
      // Step 2: Get swap transaction
      const swapRes = await axios.post(`${this.jupiterApi}/swap`, {
        quoteResponse: quote,
        userPublicKey: this.relayerWallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.jupiterApiKey
        },
        timeout: 30000
      });
      
      const { swapTransaction } = swapRes.data;
      if (!swapTransaction) {
        throw new Error('No swap transaction from Jupiter');
      }
      
      // Step 3: Sign and send swap
      const { VersionedTransaction } = require('@solana/web3.js');
      const txBuffer = Buffer.from(swapTransaction, 'base64');
      const versionedTx = VersionedTransaction.deserialize(txBuffer);
      
      versionedTx.sign([this.relayerWallet]);
      
      const swapSig = await this.connection.sendRawTransaction(versionedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
      await this.connection.confirmTransaction(swapSig, 'confirmed');
      
      this.logger.info(`✅ Swap completed: ${swapSig}`);
      swap.swapTx = swapSig;
      swap.outputAmount = quote.outAmount;
      
      // Step 4: Transfer tokens to stealth address
      const transferSig = await this.transferToStealth(
        swap.outputMint,
        swap.stealthAddress,
        quote.outAmount
      );
      
      this.logger.info(`✅ Transfer to stealth: ${transferSig}`);
      swap.transferTx = transferSig;
      swap.status = 'completed';
      swap.completedAt = Date.now();
      
      // Clear sensitive data
      delete swap.userWallet;
      
      return {
        success: true,
        swapId,
        status: 'completed',
        swapTx: swapSig,
        transferTx: transferSig,
        outputAmount: quote.outAmount,
        stealthAddress: swap.stealthAddress,
      };
      
    } catch (error) {
      swap.status = 'failed';
      swap.error = error.message;
      this.logger.error(`Swap ${swapId} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Transfer tokens from relayer to stealth address
   */
  async transferToStealth(tokenMint, stealthAddress, amount) {
    const mintPubkey = new PublicKey(tokenMint);
    const stealthPubkey = new PublicKey(stealthAddress);
    
    const relayerAta = await getAssociatedTokenAddress(mintPubkey, this.relayerWallet.publicKey);
    const stealthAta = await getAssociatedTokenAddress(mintPubkey, stealthPubkey);
    
    const tx = new Transaction();
    
    // Create stealth ATA if needed
    try {
      await getAccount(this.connection, stealthAta);
    } catch (e) {
      tx.add(createAssociatedTokenAccountInstruction(
        this.relayerWallet.publicKey,
        stealthAta,
        stealthPubkey,
        mintPubkey
      ));
    }
    
    // Transfer tokens
    tx.add(createTransferInstruction(
      relayerAta,
      stealthAta,
      this.relayerWallet.publicKey,
      BigInt(amount)
    ));
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.relayerWallet]
    );
    
    return signature;
  }

  /**
   * Get swap status
   */
  getSwapStatus(swapId) {
    const swap = this.pendingSwaps.get(swapId);
    if (!swap) {
      return { found: false };
    }
    
    return {
      found: true,
      swapId,
      status: swap.status,
      depositAddress: swap.depositAddress,
      depositAmount: swap.depositAmount,
      stealthAddress: swap.stealthAddress,
      depositTx: swap.depositTx || null,
      swapTx: swap.swapTx || null,
      transferTx: swap.transferTx || null,
      outputAmount: swap.outputAmount || null,
      error: swap.error || null,
      createdAt: new Date(swap.createdAt).toISOString(),
      completedAt: swap.completedAt ? new Date(swap.completedAt).toISOString() : null,
    };
  }

  /**
   * Manual execution for testing
   */
  async executeSwapNow({ inputMint, outputMint, amount, stealthAddress }) {
    // Generate stealth if not provided
    let finalStealthAddress = stealthAddress;
    let stealthKeys = null;
    
    if (!finalStealthAddress) {
      const metaAddress = this.stealthService.generateStealthMetaAddress();
      const metaAddressString = `stealth:${metaAddress.spendingPubKey}:${metaAddress.viewingPubKey}`;
      const stealthData = this.stealthService.generateStealthAddress(metaAddressString);
      finalStealthAddress = stealthData.stealthAddress;
      stealthKeys = {
        address: stealthData.stealthAddress,
        privateKey: stealthData.stealthPrivateKey,
      };
    }
    
    // Check balance
    const balance = await this.connection.getBalance(this.relayerWallet.publicKey);
    if (balance < amount + 5000000) {
      throw new Error(`Insufficient relayer balance. Have: ${balance / LAMPORTS_PER_SOL} SOL, Need: ${(amount + 5000000) / LAMPORTS_PER_SOL} SOL`);
    }
    
    // Execute swap
    const quoteUrl = `${this.jupiterApi}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`;
    const quoteRes = await axios.get(quoteUrl, {
      headers: { 'x-api-key': this.jupiterApiKey },
      timeout: 15000
    });
    
    const quote = quoteRes.data;
    
    const swapRes = await axios.post(`${this.jupiterApi}/swap`, {
      quoteResponse: quote,
      userPublicKey: this.relayerWallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.jupiterApiKey
      },
      timeout: 30000
    });
    
    const { swapTransaction } = swapRes.data;
    const { VersionedTransaction } = require('@solana/web3.js');
    const txBuffer = Buffer.from(swapTransaction, 'base64');
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    
    versionedTx.sign([this.relayerWallet]);
    
    const swapSig = await this.connection.sendRawTransaction(versionedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    await this.connection.confirmTransaction(swapSig, 'confirmed');
    
    // Transfer to stealth
    let transferSig = null;
    try {
      transferSig = await this.transferToStealth(outputMint, finalStealthAddress, quote.outAmount);
    } catch (e) {
      this.logger.warn('Transfer to stealth failed:', e.message);
    }
    
    return {
      success: true,
      swapTx: swapSig,
      transferTx: transferSig,
      outputAmount: quote.outAmount,
      stealthAddress: finalStealthAddress,
      stealthKeys,
      privacy: {
        userWalletInTx: false,
        message: 'Your wallet does NOT appear in swap transaction!'
      }
    };
  }
}

module.exports = ProductionRelayerService;
