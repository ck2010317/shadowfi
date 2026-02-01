import { useState, useEffect, useCallback, useRef } from 'react';
import { createWebSocketConnection } from '../services/api';

// WebSocket hook for real-time updates
export function useWebSocket(handlers = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = createWebSocketConnection({
      onConnect: () => {
        setIsConnected(true);
        setIsReconnecting(false);
        handlers.onConnect?.();
      },
      onDisconnect: () => {
        setIsConnected(false);
        handlers.onDisconnect?.();
      },
      onReconnecting: () => {
        setIsReconnecting(true);
        handlers.onReconnecting?.();
      },
      onError: handlers.onError,
      onDarkPoolUpdate: handlers.onDarkPoolUpdate,
      onPresaleUpdate: handlers.onPresaleUpdate,
      onSwapStatus: handlers.onSwapStatus,
      onPriceUpdate: handlers.onPriceUpdate,
      onCampaignProgress: handlers.onCampaignProgress,
      onMessage: handlers.onMessage,
    });

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback((type, payload) => {
    wsRef.current?.send(type, payload);
  }, []);

  const subscribe = useCallback((channel, params) => {
    wsRef.current?.subscribe(channel, params);
  }, []);

  const unsubscribe = useCallback((channel) => {
    wsRef.current?.unsubscribe(channel);
  }, []);

  return {
    isConnected,
    isReconnecting,
    send,
    subscribe,
    unsubscribe,
  };
}

// Hook for Dark Pool real-time updates
export function useDarkPoolUpdates(tokenMint, onUpdate) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onDarkPoolUpdate: (data) => {
      if (!tokenMint || data.tokenMint === tokenMint) {
        onUpdate?.(data);
      }
    },
  });

  useEffect(() => {
    if (isConnected && tokenMint) {
      subscribe('dark_pool', { tokenMint });
      return () => unsubscribe('dark_pool');
    }
  }, [isConnected, tokenMint, subscribe, unsubscribe]);

  return { isConnected };
}

// Hook for Presale real-time updates
export function usePresaleUpdates(presaleId, onUpdate) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onPresaleUpdate: (data) => {
      if (!presaleId || data.presaleId === presaleId) {
        onUpdate?.(data);
      }
    },
  });

  useEffect(() => {
    if (isConnected && presaleId) {
      subscribe('presale', { presaleId });
      return () => unsubscribe('presale');
    }
  }, [isConnected, presaleId, subscribe, unsubscribe]);

  return { isConnected };
}

// Hook for Swap status updates
export function useSwapStatus(swapId, onStatusChange) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onSwapStatus: (data) => {
      if (data.swapId === swapId) {
        onStatusChange?.(data);
      }
    },
  });

  useEffect(() => {
    if (isConnected && swapId) {
      subscribe('swap', { swapId });
      return () => unsubscribe('swap');
    }
  }, [isConnected, swapId, subscribe, unsubscribe]);

  return { isConnected };
}

// Hook for Pre-buy campaign progress
export function useCampaignProgress(campaignId, onProgress) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onCampaignProgress: (data) => {
      if (data.campaignId === campaignId) {
        onProgress?.(data);
      }
    },
  });

  useEffect(() => {
    if (isConnected && campaignId) {
      subscribe('campaign', { campaignId });
      return () => unsubscribe('campaign');
    }
  }, [isConnected, campaignId, subscribe, unsubscribe]);

  return { isConnected };
}

// Hook for Price updates
export function usePriceUpdates(tokenAddresses = [], onPriceUpdate) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onPriceUpdate: (data) => {
      if (tokenAddresses.length === 0 || tokenAddresses.includes(data.tokenAddress)) {
        onPriceUpdate?.(data);
      }
    },
  });

  useEffect(() => {
    if (isConnected && tokenAddresses.length > 0) {
      subscribe('prices', { tokens: tokenAddresses });
      return () => unsubscribe('prices');
    }
  }, [isConnected, tokenAddresses, subscribe, unsubscribe]);

  return { isConnected };
}

export default useWebSocket;
