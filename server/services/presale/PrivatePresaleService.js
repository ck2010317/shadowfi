/**
 * Private Presale Service
 * 
 * Enables anonymous early participation in token launches:
 * - Commitment-reveal scheme for contributions
 * - ZK proofs for eligibility
 * - Anonymous allocation
 * - Private vesting
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class PrivatePresaleService {
  constructor(logger) {
    this.logger = logger;
    
    // Active presales
    this.presales = new Map();
    
    // Commitments (before reveal)
    this.commitments = new Map();
    
    // Allocations (after reveal)
    this.allocations = new Map();
    
    // Configuration
    this.config = {
      minCommitmentPeriod: 3600000, // 1 hour
      revealPeriod: 1800000, // 30 minutes
      maxParticipants: 1000,
    };
  }

  /**
   * Create a new private presale
   */
  async createPresale(presaleConfig) {
    const presaleId = uuidv4();
    
    const presale = {
      id: presaleId,
      tokenAddress: presaleConfig.tokenAddress,
      tokenName: presaleConfig.tokenName,
      tokenSymbol: presaleConfig.tokenSymbol,
      
      // Allocation settings
      totalAllocation: presaleConfig.totalAllocation,
      minContribution: presaleConfig.minContribution,
      maxContribution: presaleConfig.maxContribution,
      
      // Privacy settings
      requireIdentityProof: presaleConfig.requireIdentityProof || false,
      identityRequirements: presaleConfig.identityRequirements || {},
      
      // Timing
      commitmentStartTime: presaleConfig.commitmentStartTime || Date.now(),
      commitmentEndTime: presaleConfig.commitmentEndTime,
      revealStartTime: presaleConfig.revealStartTime,
      revealEndTime: presaleConfig.revealEndTime,
      
      // State
      status: 'created',
      totalCommitments: 0,
      revealedAmount: 0,
      
      // For verification
      merkleRoot: null,
      
      createdAt: Date.now()
    };
    
    this.presales.set(presaleId, presale);
    this.commitments.set(presaleId, []);
    this.allocations.set(presaleId, []);
    
    this.logger.info(`Presale created: ${presaleId} for ${presaleConfig.tokenSymbol}`);
    
    return {
      presaleId,
      status: 'created',
      commitmentStartTime: presale.commitmentStartTime,
      commitmentEndTime: presale.commitmentEndTime
    };
  }

  /**
   * Submit a commitment to participate in presale
   * Uses commit-reveal scheme to hide contribution amounts
   */
  async submitCommitment(presaleId, commitmentData) {
    const presale = this.presales.get(presaleId);
    if (!presale) {
      throw new Error('Presale not found');
    }
    
    const now = Date.now();
    if (now < presale.commitmentStartTime || now > presale.commitmentEndTime) {
      throw new Error('Commitment period not active');
    }
    
    // Verify identity proof if required
    if (presale.requireIdentityProof) {
      const isValid = await this.verifyIdentityProof(
        commitmentData.identityProof,
        presale.identityRequirements
      );
      if (!isValid) {
        throw new Error('Invalid identity proof');
      }
    }
    
    // Check for duplicate nullifier (prevent double commitment)
    const commitments = this.commitments.get(presaleId);
    if (commitments.some(c => c.nullifier === commitmentData.nullifier)) {
      throw new Error('Commitment already exists');
    }
    
    const commitment = {
      id: uuidv4(),
      commitment: commitmentData.commitment, // hash(amount + secret)
      nullifier: commitmentData.nullifier,
      identityCommitment: commitmentData.identityCommitment,
      timestamp: now,
      revealed: false
    };
    
    commitments.push(commitment);
    presale.totalCommitments++;
    
    this.logger.info(`Commitment submitted to presale ${presaleId.substring(0, 8)}...`);
    
    return {
      commitmentId: commitment.id,
      status: 'committed',
      revealStartTime: presale.revealStartTime
    };
  }

  /**
   * Reveal a commitment (during reveal phase)
   */
  async revealCommitment(presaleId, revealData) {
    const presale = this.presales.get(presaleId);
    if (!presale) {
      throw new Error('Presale not found');
    }
    
    const now = Date.now();
    if (now < presale.revealStartTime || now > presale.revealEndTime) {
      throw new Error('Reveal period not active');
    }
    
    // Find the commitment
    const commitments = this.commitments.get(presaleId);
    const commitment = commitments.find(c => c.nullifier === revealData.nullifier);
    
    if (!commitment) {
      throw new Error('Commitment not found');
    }
    
    if (commitment.revealed) {
      throw new Error('Already revealed');
    }
    
    // Verify the commitment matches
    const expectedCommitment = this.computeCommitment(
      revealData.amount,
      revealData.secret
    );
    
    if (expectedCommitment !== commitment.commitment) {
      throw new Error('Invalid reveal - commitment mismatch');
    }
    
    // Validate amount
    if (revealData.amount < presale.minContribution || 
        revealData.amount > presale.maxContribution) {
      throw new Error('Invalid contribution amount');
    }
    
    // Mark as revealed and create allocation
    commitment.revealed = true;
    commitment.revealedAmount = revealData.amount;
    
    const allocation = {
      id: uuidv4(),
      nullifier: revealData.nullifier,
      amount: revealData.amount,
      tokenAllocation: this.calculateAllocation(presale, revealData.amount),
      stealthAddress: revealData.stealthAddress,
      vestingSchedule: this.createVestingSchedule(presale, revealData.amount),
      timestamp: now
    };
    
    this.allocations.get(presaleId).push(allocation);
    presale.revealedAmount += revealData.amount;
    
    this.logger.info(`Commitment revealed for presale ${presaleId.substring(0, 8)}...`);
    
    return {
      allocationId: allocation.id,
      tokenAllocation: allocation.tokenAllocation,
      vestingSchedule: allocation.vestingSchedule
    };
  }

  /**
   * Compute a commitment hash
   */
  computeCommitment(amount, secret) {
    return crypto.createHash('sha256')
      .update(`${amount}:${secret}`)
      .digest('hex');
  }

  /**
   * Calculate token allocation based on contribution
   */
  calculateAllocation(presale, contributionAmount) {
    // Pro-rata allocation (simplified)
    const rate = presale.totalAllocation / (presale.revealedAmount + contributionAmount + 1);
    return Math.floor(contributionAmount * rate);
  }

  /**
   * Create a vesting schedule
   */
  createVestingSchedule(presale, amount) {
    // Default: 25% immediate, 75% vested over 3 months
    return {
      immediate: amount * 0.25,
      vested: amount * 0.75,
      vestingStart: presale.revealEndTime + 86400000, // 1 day after reveal
      vestingDuration: 90 * 24 * 60 * 60 * 1000, // 90 days
      cliffPeriod: 30 * 24 * 60 * 60 * 1000 // 30 day cliff
    };
  }

  /**
   * Verify identity proof
   */
  async verifyIdentityProof(proof, requirements) {
    if (!proof) return false;
    
    // Verify ZK proof (simplified)
    // In production, would verify actual ZK-SNARK proof
    
    if (requirements.minFollowers && proof.followerProof) {
      // Verify follower count proof
      return this.verifyFollowerProof(proof.followerProof, requirements.minFollowers);
    }
    
    if (requirements.minAccountAge && proof.accountAgeProof) {
      // Verify account age proof
      return this.verifyAccountAgeProof(proof.accountAgeProof, requirements.minAccountAge);
    }
    
    return true;
  }

  /**
   * Verify follower count proof
   */
  verifyFollowerProof(proof, minFollowers) {
    // Simplified verification
    return proof && proof.verified && proof.threshold >= minFollowers;
  }

  /**
   * Verify account age proof
   */
  verifyAccountAgeProof(proof, minAge) {
    // Simplified verification
    return proof && proof.verified && proof.age >= minAge;
  }

  /**
   * Claim vested tokens
   */
  async claimVestedTokens(presaleId, nullifier, stealthAddress) {
    const allocations = this.allocations.get(presaleId);
    const allocation = allocations?.find(a => a.nullifier === nullifier);
    
    if (!allocation) {
      throw new Error('Allocation not found');
    }
    
    if (allocation.stealthAddress !== stealthAddress) {
      throw new Error('Invalid stealth address');
    }
    
    // Calculate vested amount available
    const now = Date.now();
    const { vestingStart, vestingDuration, cliffPeriod, vested, immediate } = allocation.vestingSchedule;
    
    // Check if cliff has passed
    if (now < vestingStart + cliffPeriod) {
      return {
        claimable: allocation.vestingSchedule.immediate,
        vestedClaimable: 0,
        nextVestingDate: vestingStart + cliffPeriod
      };
    }
    
    // Calculate vested portion
    const elapsed = now - vestingStart;
    const vestedPortion = Math.min(elapsed / vestingDuration, 1);
    const vestedClaimable = vested * vestedPortion;
    
    return {
      claimable: immediate + vestedClaimable,
      vestedClaimable,
      vestedPercent: vestedPortion * 100,
      fullyVestedDate: vestingStart + vestingDuration
    };
  }

  /**
   * Get presale status (public info only)
   */
  getPresaleStatus(presaleId) {
    const presale = this.presales.get(presaleId);
    if (!presale) return null;
    
    const now = Date.now();
    let phase = 'upcoming';
    
    if (now >= presale.revealEndTime) {
      phase = 'completed';
    } else if (now >= presale.revealStartTime) {
      phase = 'reveal';
    } else if (now >= presale.commitmentStartTime) {
      phase = 'commitment';
    }
    
    return {
      presaleId,
      tokenSymbol: presale.tokenSymbol,
      phase,
      totalCommitments: presale.totalCommitments, // Count only, not amounts
      requiresIdentity: presale.requireIdentityProof,
      timing: {
        commitmentStart: presale.commitmentStartTime,
        commitmentEnd: presale.commitmentEndTime,
        revealStart: presale.revealStartTime,
        revealEnd: presale.revealEndTime
      }
    };
  }

  /**
   * List active presales
   */
  listActivePresales() {
    const active = [];
    const now = Date.now();
    
    for (const [id, presale] of this.presales.entries()) {
      if (now < presale.revealEndTime) {
        active.push(this.getPresaleStatus(id));
      }
    }
    
    return active;
  }
}

module.exports = PrivatePresaleService;
