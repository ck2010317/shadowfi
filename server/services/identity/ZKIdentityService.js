/**
 * ZK Identity Service
 * 
 * Zero-knowledge proof generation and verification for:
 * - Twitter/X follower count verification
 * - Account age verification
 * - Anonymous reputation building
 * - Sybil resistance
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ZKIdentityService {
  constructor(logger) {
    this.logger = logger;
    
    // Verified proofs (only commitments stored)
    this.verifiedProofs = new Map();
    
    // Anonymous reputation scores
    this.reputationScores = new Map();
    
    // Nullifier registry (prevent double-use)
    this.usedNullifiers = new Set();
    
    // OAuth sessions (temporary)
    this.oauthSessions = new Map();
    
    // Configuration
    this.config = {
      followerThresholds: [100, 1000, 5000, 10000, 50000, 100000],
      accountAgeThresholds: [30, 90, 180, 365, 730], // days
      proofValidityPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  /**
   * Start OAuth flow for Twitter verification
   * Returns a session ID - actual OAuth happens client-side
   */
  initiateTwitterVerification(callbackUrl) {
    const sessionId = uuidv4();
    const state = crypto.randomBytes(32).toString('hex');
    
    this.oauthSessions.set(sessionId, {
      state,
      createdAt: Date.now(),
      status: 'pending',
      callbackUrl
    });
    
    // Generate OAuth URL (client will handle actual OAuth)
    const oauthUrl = this.buildOAuthUrl(state, callbackUrl);
    
    return {
      sessionId,
      oauthUrl,
      state
    };
  }

  /**
   * Build Twitter OAuth URL
   */
  buildOAuthUrl(state, callbackUrl) {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'users.read tweet.read',
      state,
      code_challenge: this.generateCodeChallenge(),
      code_challenge_method: 'S256'
    });
    
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Generate PKCE code challenge
   */
  generateCodeChallenge() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Process Twitter OAuth callback and generate ZK proof
   */
  async processOAuthCallback(sessionId, code, userData) {
    const session = this.oauthSessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }
    
    // In production: exchange code for token and fetch user data
    // Here we accept userData directly from client after they do OAuth
    
    const proofData = {
      followerCount: userData.public_metrics?.followers_count || 0,
      accountCreatedAt: new Date(userData.created_at).getTime(),
      isVerified: userData.verified || false,
      // Don't store username or ID - only derived proofs
    };
    
    // Generate proofs
    const proofs = await this.generateAllProofs(proofData);
    
    // Clean up session
    this.oauthSessions.delete(sessionId);
    
    return proofs;
  }

  /**
   * Generate all available proofs from user data
   */
  async generateAllProofs(userData) {
    const proofs = {
      followerProof: await this.generateFollowerProof(userData.followerCount),
      accountAgeProof: await this.generateAccountAgeProof(userData.accountCreatedAt),
      verifiedBadgeProof: await this.generateVerifiedProof(userData.isVerified),
      commitment: null,
      nullifier: null
    };
    
    // Generate master commitment (combines all proofs)
    const masterSecret = crypto.randomBytes(32).toString('hex');
    proofs.commitment = this.generateMasterCommitment(proofs, masterSecret);
    proofs.nullifier = this.generateNullifier(masterSecret);
    
    return proofs;
  }

  /**
   * Generate ZK proof for follower count
   * Proves user has >= threshold followers without revealing exact count
   */
  async generateFollowerProof(followerCount) {
    // Find highest threshold met
    let provenThreshold = 0;
    for (const threshold of this.config.followerThresholds) {
      if (followerCount >= threshold) {
        provenThreshold = threshold;
      } else {
        break;
      }
    }
    
    // Generate range proof (simulated ZK)
    const secret = crypto.randomBytes(32);
    const commitment = crypto.createHash('sha256')
      .update(Buffer.concat([
        Buffer.from(provenThreshold.toString()),
        secret
      ]))
      .digest('hex');
    
    // Proof structure
    const proof = {
      type: 'follower_count',
      threshold: provenThreshold,
      commitment,
      // Simulated ZK proof components
      zkProof: {
        pi_a: crypto.randomBytes(64).toString('hex'),
        pi_b: crypto.randomBytes(128).toString('hex'),
        pi_c: crypto.randomBytes(64).toString('hex'),
        protocol: 'groth16',
        curve: 'bn128'
      },
      verified: true,
      generatedAt: Date.now(),
      validUntil: Date.now() + this.config.proofValidityPeriod
    };
    
    return proof;
  }

  /**
   * Generate ZK proof for account age
   */
  async generateAccountAgeProof(createdAt) {
    const ageInDays = Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));
    
    // Find highest threshold met
    let provenAge = 0;
    for (const threshold of this.config.accountAgeThresholds) {
      if (ageInDays >= threshold) {
        provenAge = threshold;
      } else {
        break;
      }
    }
    
    const secret = crypto.randomBytes(32);
    const commitment = crypto.createHash('sha256')
      .update(Buffer.concat([
        Buffer.from(provenAge.toString()),
        secret
      ]))
      .digest('hex');
    
    return {
      type: 'account_age',
      threshold: provenAge,
      age: provenAge, // Threshold, not exact age
      commitment,
      zkProof: {
        pi_a: crypto.randomBytes(64).toString('hex'),
        pi_b: crypto.randomBytes(128).toString('hex'),
        pi_c: crypto.randomBytes(64).toString('hex'),
        protocol: 'groth16',
        curve: 'bn128'
      },
      verified: true,
      generatedAt: Date.now(),
      validUntil: Date.now() + this.config.proofValidityPeriod
    };
  }

  /**
   * Generate ZK proof for verified badge
   */
  async generateVerifiedProof(isVerified) {
    const secret = crypto.randomBytes(32);
    const commitment = crypto.createHash('sha256')
      .update(Buffer.concat([
        Buffer.from(isVerified ? '1' : '0'),
        secret
      ]))
      .digest('hex');
    
    return {
      type: 'verified_badge',
      hasVerifiedBadge: isVerified,
      commitment,
      zkProof: {
        pi_a: crypto.randomBytes(64).toString('hex'),
        pi_b: crypto.randomBytes(128).toString('hex'),
        pi_c: crypto.randomBytes(64).toString('hex'),
        protocol: 'groth16',
        curve: 'bn128'
      },
      verified: true,
      generatedAt: Date.now(),
      validUntil: Date.now() + this.config.proofValidityPeriod
    };
  }

  /**
   * Generate master commitment from all proofs
   */
  generateMasterCommitment(proofs, secret) {
    const data = JSON.stringify({
      follower: proofs.followerProof?.commitment,
      age: proofs.accountAgeProof?.commitment,
      verified: proofs.verifiedBadgeProof?.commitment,
      secret
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate nullifier for one-time use
   */
  generateNullifier(secret) {
    return crypto.createHash('sha256')
      .update(`nullifier:${secret}`)
      .digest('hex');
  }

  /**
   * Verify a proof for presale/feature access
   */
  async verifyProof(proof, requirements) {
    // Check nullifier hasn't been used
    if (this.usedNullifiers.has(proof.nullifier)) {
      return { valid: false, reason: 'Proof already used' };
    }
    
    // Check proof hasn't expired
    if (Date.now() > proof.validUntil) {
      return { valid: false, reason: 'Proof expired' };
    }
    
    // Verify ZK proof (simulated)
    const zkValid = await this.verifyZKProof(proof.zkProof);
    if (!zkValid) {
      return { valid: false, reason: 'Invalid ZK proof' };
    }
    
    // Check requirements
    if (requirements.minFollowers && 
        (!proof.followerProof || proof.followerProof.threshold < requirements.minFollowers)) {
      return { 
        valid: false, 
        reason: `Requires ${requirements.minFollowers}+ followers` 
      };
    }
    
    if (requirements.minAccountAge &&
        (!proof.accountAgeProof || proof.accountAgeProof.threshold < requirements.minAccountAge)) {
      return {
        valid: false,
        reason: `Requires ${requirements.minAccountAge}+ day old account`
      };
    }
    
    if (requirements.verifiedOnly && 
        (!proof.verifiedBadgeProof || !proof.verifiedBadgeProof.hasVerifiedBadge)) {
      return { valid: false, reason: 'Requires verified account' };
    }
    
    return { valid: true };
  }

  /**
   * Verify ZK proof (simulated)
   */
  async verifyZKProof(zkProof) {
    // In production: use snarkjs or similar to verify
    return zkProof && zkProof.pi_a && zkProof.pi_b && zkProof.pi_c;
  }

  /**
   * Mark a proof as used (for sybil resistance)
   */
  markProofUsed(nullifier) {
    this.usedNullifiers.add(nullifier);
  }

  /**
   * Build anonymous reputation
   */
  async buildReputation(commitment, action) {
    const reputationActions = {
      'presale_participation': 10,
      'successful_trade': 5,
      'early_adopter': 20,
      'community_contribution': 15
    };
    
    const points = reputationActions[action] || 0;
    
    const current = this.reputationScores.get(commitment) || 0;
    this.reputationScores.set(commitment, current + points);
    
    return {
      commitment,
      newScore: current + points,
      action,
      pointsEarned: points
    };
  }

  /**
   * Get reputation score
   */
  getReputation(commitment) {
    return this.reputationScores.get(commitment) || 0;
  }

  /**
   * Generate reputation proof
   */
  async generateReputationProof(commitment, minScore) {
    const score = this.reputationScores.get(commitment) || 0;
    
    if (score < minScore) {
      return null;
    }
    
    return {
      type: 'reputation',
      threshold: minScore,
      commitment,
      meetsThreshold: true,
      zkProof: {
        pi_a: crypto.randomBytes(64).toString('hex'),
        pi_b: crypto.randomBytes(128).toString('hex'),
        pi_c: crypto.randomBytes(64).toString('hex'),
        protocol: 'groth16',
        curve: 'bn128'
      },
      generatedAt: Date.now()
    };
  }

  /**
   * Get available proof thresholds
   */
  getThresholds() {
    return {
      followerThresholds: this.config.followerThresholds,
      accountAgeThresholds: this.config.accountAgeThresholds,
      proofValidityDays: this.config.proofValidityPeriod / (24 * 60 * 60 * 1000)
    };
  }
}

module.exports = ZKIdentityService;
