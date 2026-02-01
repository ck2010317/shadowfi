/**
 * Bundled Launch Service
 * 
 * Combines token launch + immediate pre-buy in ONE atomic action
 * - Launch token via Anoncoin API
 * - Immediately execute distributed buys to stealth wallets
 * - Return all private keys to user
 * 
 * This beats snipers because buys happen within seconds of launch!
 */

const { Keypair, Connection, PublicKey, VersionedTransaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const bs58 = require('bs58').default || require('bs58');
const axios = require('axios');
const nacl = require('tweetnacl');

class BundledLaunchService {
  constructor(logger, anoncoinService) {
    this.logger = logger;
    this.anoncoinService = anoncoinService;
    
    // RPC and API config
    this.rpcUrl = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1';
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    this.jupiterApiKey = process.env.JUPITER_API_KEY || 'ea73d3d1-8ba5-4976-a544-332a0ba1fc1a';
    
    // Relayer wallet (same as anonymous swap)
    this.relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY || '5yt73dnAewnwrKTDHeNbyLYGoyvxQ4hhnuKurx4qEUWdP2mibFVW1HSvFWLR3Ys98YpevPrtqcK7L5ifNcaTScmD';
    this.relayerKeypair = Keypair.fromSecretKey(bs58.decode(this.relayerPrivateKey));
    
    // Fee config
    this.relayerFeeLamports = 100000; // 0.0001 SOL per swap
    
    this.logger.info('BundledLaunchService initialized');
  }

  /**
   * Launch token + Pre-buy in one action
   * 
   * @param {Object} config
   * @param {Object} config.token - Token details (name, symbol, description, image)
   * @param {Object} config.preBuy - Pre-buy config (totalSol, numWallets)
   */
  async launchWithPreBuy(config) {
    const { token, preBuy } = config;
    
    this.logger.info('🚀 Starting bundled launch + pre-buy', {
      tokenName: token.name,
      tokenSymbol: token.symbol,
      preBuySol: preBuy.totalSol,
      numWallets: preBuy.numWallets
    });

    // Step 1: Generate stealth wallets FIRST (so we're ready)
    this.logger.info('Generating stealth wallets...');
    const stealthWallets = this.generateStealthWallets(preBuy.numWallets);
    
    // Step 2: Calculate SOL distribution
    const solPerWallet = preBuy.totalSol / preBuy.numWallets;
    const lamportsPerWallet = Math.floor(solPerWallet * 1e9);
    
    this.logger.info(`Will distribute ${solPerWallet} SOL to each of ${preBuy.numWallets} wallets`);

    // Step 3: Launch token via Anoncoin
    this.logger.info('Launching token via Anoncoin API...');
    let tokenResult;
    try {
      tokenResult = await this.anoncoinService.deployToken({
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image: token.image,
        twitter: token.twitter || '',
        telegram: token.telegram || '',
      });
      
      if (!tokenResult.tokenAddress) {
        throw new Error('Token launch failed - no address returned');
      }
      
      this.logger.info('✅ Token launched!', { tokenAddress: tokenResult.tokenAddress });
    } catch (error) {
      this.logger.error('Token launch failed:', error.message);
      throw new Error(`Token launch failed: ${error.message}`);
    }

    const tokenAddress = tokenResult.tokenAddress;

    // Step 4: Wait a moment for token to be indexed
    this.logger.info('Waiting for token to be indexed on Jupiter...');
    await this.sleep(3000);

    // Step 5: Execute pre-buys in parallel (FAST!)
    this.logger.info('🔥 Executing pre-buys...');
    const preBuyResults = await this.executePreBuys(
      tokenAddress,
      stealthWallets,
      lamportsPerWallet
    );

    // Compile results
    const successfulBuys = preBuyResults.filter(r => r.success);
    const failedBuys = preBuyResults.filter(r => !r.success);

    this.logger.info(`Pre-buy complete: ${successfulBuys.length}/${preBuyResults.length} successful`);

    return {
      success: true,
      token: {
        address: tokenAddress,
        name: token.name,
        symbol: token.symbol,
        transactionSignature: tokenResult.transactionSignature,
        confirmed: tokenResult.confirmed
      },
      preBuy: {
        totalWallets: preBuy.numWallets,
        successfulBuys: successfulBuys.length,
        failedBuys: failedBuys.length,
        wallets: stealthWallets.map((w, i) => ({
          address: w.publicKey,
          privateKey: w.privateKey, // User needs this to access tokens!
          solAllocated: solPerWallet,
          buyResult: preBuyResults[i]
        }))
      }
    };
  }

  /**
   * Pre-buy only (for existing tokens)
   * User provides token address, we do distributed buys
   */
  async preBuyOnly(config) {
    const { tokenAddress, totalSol, numWallets } = config;
    
    this.logger.info('🎯 Starting pre-buy for existing token', {
      tokenAddress,
      totalSol,
      numWallets
    });

    // Generate stealth wallets
    const stealthWallets = this.generateStealthWallets(numWallets);
    
    // Calculate distribution
    const solPerWallet = totalSol / numWallets;
    const lamportsPerWallet = Math.floor(solPerWallet * 1e9);

    // Execute pre-buys
    const preBuyResults = await this.executePreBuys(
      tokenAddress,
      stealthWallets,
      lamportsPerWallet
    );

    const successfulBuys = preBuyResults.filter(r => r.success);

    return {
      success: true,
      tokenAddress,
      totalWallets: numWallets,
      successfulBuys: successfulBuys.length,
      wallets: stealthWallets.map((w, i) => ({
        address: w.publicKey,
        privateKey: w.privateKey,
        solAllocated: solPerWallet,
        buyResult: preBuyResults[i]
      }))
    };
  }

  /**
   * Generate stealth wallets with exportable private keys
   */
  generateStealthWallets(count) {
    const wallets = [];
    
    for (let i = 0; i < count; i++) {
      // Generate Ed25519 keypair (Solana native)
      const keypair = Keypair.generate();
      
      wallets.push({
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
        keypair: keypair // Keep for signing
      });
    }
    
    this.logger.info(`Generated ${count} stealth wallets`);
    return wallets;
  }

  /**
   * Execute pre-buys to multiple stealth wallets
   * Swaps run with stagger, transfers run sequentially to avoid race conditions
   */
  async executePreBuys(tokenAddress, stealthWallets, lamportsPerWallet) {
    this.logger.info(`Executing ${stealthWallets.length} buys (staggered swaps, sequential transfers)...`);
    
    const results = [];
    
    // Execute each buy sequentially to avoid race conditions on relayer token account
    for (let i = 0; i < stealthWallets.length; i++) {
      const wallet = stealthWallets[i];
      
      try {
        this.logger.info(`Starting buy ${i + 1}/${stealthWallets.length} to ${wallet.publicKey.substring(0, 8)}...`);
        
        const result = await this.executeSingleBuy(
          tokenAddress,
          wallet,
          lamportsPerWallet
        );
        
        results.push({
          success: true,
          walletIndex: i,
          ...result
        });
        
        // Small delay between buys to let blockchain settle
        if (i < stealthWallets.length - 1) {
          await this.sleep(1000);
        }
        
      } catch (error) {
        this.logger.error(`Buy ${i + 1} failed: ${error.message}`);
        results.push({
          success: false,
          walletIndex: i,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Execute a single swap via Jupiter and send tokens to stealth wallet
   * Uses 2-step approach: Swap to relayer ATA, then transfer to stealth ATA
   */
  async executeSingleBuy(tokenAddress, stealthWallet, lamportsAmount) {
    const { Transaction } = require('@solana/web3.js');
    const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
    
    // Account for relayer fee
    const swapAmount = lamportsAmount - this.relayerFeeLamports;
    
    if (swapAmount <= 0) {
      throw new Error('Amount too small after fee');
    }

    const tokenMint = new PublicKey(tokenAddress);
    const stealthPubkey = new PublicKey(stealthWallet.publicKey);

    // Step 1: Get Jupiter quote
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=${swapAmount}&slippageBps=500`;
    
    const quoteResponse = await axios.get(quoteUrl, {
      headers: { 'x-api-key': this.jupiterApiKey }
    });
    
    const quote = quoteResponse.data;
    
    if (!quote || quote.error) {
      throw new Error(quote?.error || 'Failed to get quote');
    }
    
    this.logger.info(`Quote: ${swapAmount} lamports → ${quote.outAmount} tokens`);

    // Step 2: Get swap transaction (tokens go to RELAYER first)
    const swapResponse = await axios.post('https://api.jup.ag/swap/v1/swap', {
      quoteResponse: quote,
      userPublicKey: this.relayerKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    }, {
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': this.jupiterApiKey
      }
    });

    if (!swapResponse.data.swapTransaction) {
      throw new Error('No swap transaction returned');
    }

    // Step 3: Execute swap (tokens arrive in relayer's ATA)
    const swapTxBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
    const swapTx = VersionedTransaction.deserialize(swapTxBuf);
    swapTx.sign([this.relayerKeypair]);

    const swapSig = await this.connection.sendTransaction(swapTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    this.logger.info(`✅ Swap tx sent: ${swapSig}`);

    await this.connection.confirmTransaction(swapSig, 'confirmed');
    this.logger.info(`✅ Swap confirmed`);

    // Step 4: Transfer tokens from relayer to stealth wallet WITH RETRY
    const transferResult = await this.transferToStealth(
      tokenMint,
      stealthPubkey,
      quote.outAmount,
      stealthWallet.publicKey
    );

    return {
      swapSignature: swapSig,
      transferSignature: transferResult.signature,
      inputAmount: swapAmount,
      outputAmount: quote.outAmount,
      stealthAddress: stealthWallet.publicKey
    };
  }

  /**
   * Transfer tokens from relayer to stealth wallet with aggressive retry
   * Will NOT stop until transfer succeeds or max retries exceeded
   */
  async transferToStealth(tokenMint, stealthPubkey, amount, stealthAddress, maxRetries = 10) {
    const { Transaction } = require('@solana/web3.js');
    const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
    
    const relayerAta = await getAssociatedTokenAddress(tokenMint, this.relayerKeypair.publicKey);
    const stealthAta = await getAssociatedTokenAddress(tokenMint, stealthPubkey);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Transfer attempt ${attempt}/${maxRetries} to ${stealthAddress.substring(0, 8)}...`);
        
        // Get fresh blockhash for each attempt
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
        
        const transferTx = new Transaction();
        transferTx.recentBlockhash = blockhash;
        transferTx.feePayer = this.relayerKeypair.publicKey;
        
        // Check if stealth ATA exists, if not create it
        const stealthAtaInfo = await this.connection.getAccountInfo(stealthAta);
        if (!stealthAtaInfo) {
          transferTx.add(
            createAssociatedTokenAccountInstruction(
              this.relayerKeypair.publicKey, // payer
              stealthAta,                     // ata to create
              stealthPubkey,                  // owner
              tokenMint                       // mint
            )
          );
        }

        // Get current balance in relayer ATA to handle partial transfers
        const relayerAtaInfo = await this.connection.getTokenAccountBalance(relayerAta);
        const availableBalance = BigInt(relayerAtaInfo.value.amount);
        const transferAmount = BigInt(amount) > availableBalance ? availableBalance : BigInt(amount);
        
        if (transferAmount <= 0n) {
          this.logger.warn(`No tokens available to transfer (balance: ${availableBalance})`);
          // Wait and retry - tokens might still be settling
          await this.sleep(2000);
          continue;
        }

        // Add transfer instruction
        transferTx.add(
          createTransferInstruction(
            relayerAta,                       // source
            stealthAta,                       // destination
            this.relayerKeypair.publicKey,    // owner
            transferAmount                    // amount
          )
        );

        transferTx.sign(this.relayerKeypair);

        const transferSig = await this.connection.sendRawTransaction(transferTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });

        // Wait for confirmation with timeout
        const confirmation = await this.connection.confirmTransaction({
          signature: transferSig,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        this.logger.info(`✅ Transfer to stealth: ${transferSig}`);
        return { signature: transferSig, amount: transferAmount.toString() };
        
      } catch (error) {
        this.logger.warn(`Transfer attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          this.logger.error(`All ${maxRetries} transfer attempts failed for ${stealthAddress}`);
          throw new Error(`Transfer failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.info(`Retrying in ${backoff}ms...`);
        await this.sleep(backoff);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BundledLaunchService;
