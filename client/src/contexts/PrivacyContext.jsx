import React, { createContext, useContext, useState, useCallback } from 'react';
import CryptoJS from 'crypto-js';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const [privacyLevel, setPrivacyLevel] = useState('maximum'); // 'standard', 'enhanced', 'maximum'
  const [stealthAddresses, setStealthAddresses] = useState([]);
  const [commitments, setCommitments] = useState([]);

  // Generate a commitment for commit-reveal scheme
  const generateCommitment = useCallback((data, secret) => {
    const payload = JSON.stringify(data) + ':' + secret;
    return CryptoJS.SHA256(payload).toString();
  }, []);

  // Generate a nullifier (for one-time proofs)
  const generateNullifier = useCallback((secret) => {
    return CryptoJS.SHA256('nullifier:' + secret).toString();
  }, []);

  // Generate a random secret
  const generateSecret = useCallback(() => {
    return CryptoJS.lib.WordArray.random(32).toString();
  }, []);

  // Generate a stealth address (simplified)
  const generateStealthAddress = useCallback((viewKey) => {
    const ephemeral = CryptoJS.lib.WordArray.random(32);
    const sharedSecret = CryptoJS.SHA256(ephemeral.toString() + viewKey).toString();
    const address = CryptoJS.SHA256(sharedSecret).toString();
    
    return {
      address: '0x' + address.substring(0, 40),
      ephemeralPublic: ephemeral.toString().substring(0, 64),
      viewTag: sharedSecret.substring(0, 8)
    };
  }, []);

  // Encrypt data for dark pool orders
  const encryptOrderData = useCallback((orderData) => {
    const secret = generateSecret();
    const key = CryptoJS.lib.WordArray.random(32);
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(orderData),
      key,
      { iv, mode: CryptoJS.mode.GCM }
    );
    
    const commitment = generateCommitment(orderData, secret);
    const nullifier = generateNullifier(secret);
    
    // Encrypt side indicator
    const sideIndicator = orderData.side === 'buy' ? '0' : '1';
    const encryptedSide = CryptoJS.AES.encrypt(sideIndicator, key).toString();
    
    return {
      encryptedPayload: encrypted.toString(),
      iv: iv.toString(),
      commitment,
      nullifier,
      encryptedSide,
      secret // Return secret for user to save
    };
  }, [generateSecret, generateCommitment, generateNullifier]);

  // Store a commitment locally
  const storeCommitment = useCallback((commitment, metadata) => {
    setCommitments(prev => [...prev, { ...commitment, ...metadata, timestamp: Date.now() }]);
  }, []);

  // Get stored commitments
  const getCommitments = useCallback(() => {
    return commitments;
  }, [commitments]);

  // Privacy level settings
  const privacySettings = {
    standard: {
      useRingSig: false,
      mixnetRouting: false,
      delayExecution: false,
      decoyTransactions: false,
    },
    enhanced: {
      useRingSig: true,
      mixnetRouting: false,
      delayExecution: true,
      decoyTransactions: false,
    },
    maximum: {
      useRingSig: true,
      mixnetRouting: true,
      delayExecution: true,
      decoyTransactions: true,
    }
  };

  const getPrivacySettings = useCallback(() => {
    return privacySettings[privacyLevel];
  }, [privacyLevel]);

  const value = {
    privacyLevel,
    setPrivacyLevel,
    generateCommitment,
    generateNullifier,
    generateSecret,
    generateStealthAddress,
    encryptOrderData,
    storeCommitment,
    getCommitments,
    getPrivacySettings,
    stealthAddresses,
    setStealthAddresses,
  };

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}
