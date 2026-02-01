/**
 * Stealth Address Service
 * 
 * Generates stealth addresses for privacy-preserving transactions.
 * Uses Ed25519 keypairs for Solana compatibility.
 */

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');

class StealthAddressService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Generate a new stealth meta-address
   * This creates a fresh keypair that can receive stealth transfers
   */
  generateStealthMetaAddress() {
    // Generate a fresh Ed25519 keypair for Solana
    const keypair = Keypair.generate();
    
    // Get the public key and private key in base58
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);
    
    this.logger?.info('Generated new stealth meta-address');
    
    return {
      metaAddress: publicKey,
      spendingPubKey: publicKey,
      viewingPubKey: publicKey,
      spendingPrivKey: privateKey,
      viewingPrivKey: privateKey,
      // Full keypair for internal use
      keypair
    };
  }

  /**
   * Generate a stealth address from a meta-address
   * For simplicity, we just generate a new keypair (recipient gets private key)
   */
  generateStealthAddress(metaAddress) {
    // Generate a new one-time stealth address
    const stealthKeypair = Keypair.generate();
    
    const stealthAddress = stealthKeypair.publicKey.toBase58();
    const stealthPrivateKey = bs58.encode(stealthKeypair.secretKey);
    
    this.logger?.info(`Generated stealth address: ${stealthAddress.slice(0, 8)}...`);
    
    return {
      stealthAddress,
      stealthPrivateKey,
      ephemeralPubKey: stealthAddress, // For compatibility
      keypair: stealthKeypair
    };
  }

  /**
   * Recover the private key for a stealth address
   * (Already returned during generation, this is for documentation)
   */
  recoverStealthPrivateKey(stealthPrivateKey) {
    try {
      const secretKey = bs58.decode(stealthPrivateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      return {
        success: true,
        publicKey: keypair.publicKey.toBase58(),
        keypair
      };
    } catch (error) {
      this.logger?.error('Failed to recover stealth key:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = StealthAddressService;
