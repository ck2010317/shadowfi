# ShadowFi - Privacy Tooling for Token Launches 

> **Built for Anoncoin Hackathon** - 

ShadowFi provides **working privacy tools** for Solana token launches. Both features are **live on mainnet** - not simulations.

## What We Built

### ✅ Anonymous Swap (WORKING)
Swap any token without linking your wallet to the purchase.

**How it works:**
1. You send SOL to our relayer wallet
2. Relayer executes the swap via Jupiter
3. Tokens are sent to a **new stealth address**
4. You get the **private key** to import into any wallet

**Result:** No on-chain link between your wallet and your token purchase.

### ✅ Launch + Pre-Buy (WORKING)
Launch a token and instantly buy into multiple stealth wallets - all in one action.

**How it works:**
1. Create token via Anoncoin API
2. Immediately execute distributed buys to stealth wallets
3. Get private keys for ALL wallets
4. Beat snipers - your buys happen within seconds of launch

**Result:** Creator can accumulate tokens across multiple wallets that can't be linked.

---

## 🔥 Live Mainnet Proof

### Anonymous Swaps Completed:
- [Swap 1](https://solscan.io/tx/4jinZmfx8QDYn9ave41hfpvc3YrUBqABp3QhECFj8f9VHBssPaUvsy1enTMGmKRHF6cnRFZ3basRxBrnKkAXPuJu) - SOL → SHADOW token
- [Swap 2](https://solscan.io/tx/2JXb7ziqUFejWH12rEoLX1DDQED5DDSjRaRW9dXWBxGmq2RHVWJzhWfYsEtF4SWfJsuV2UfJuoy79k39WkrZUBxC) - SOL → HACK3 token
- Multiple wallets verified with tokens on chain

### Tokens Launched with Pre-Buy:
- HACK2: `J6omzVQjoVmGYL3kPdBwWSq4ZNT794TxnRSEmWDBdoge`
- HACK3: `A3b6K2QyZKVGpjGTb21F8GoYnNBaifgAGgNv8uQSdoge`

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express
- **Blockchain:** Solana Mainnet
- **APIs:** 
  - Anoncoin API (token deployment)
  - Jupiter API (swaps)
  - Helius RPC (Solana)

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/ck2010317/shadowfi.git
cd shadowfi

# Install dependencies
npm install
cd client && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development
npm run dev
```

## Environment Variables

```env
# Solana RPC
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Anoncoin API
ANONCOIN_API_KEY=anoncoin:YOUR_KEY

# Jupiter API
JUPITER_API_KEY=YOUR_KEY

# Relayer wallet (funds swaps)
RELAYER_PRIVATE_KEY=YOUR_RELAYER_PRIVATE_KEY
```

---

## 🔒 Privacy Architecture

```
User Wallet                    Relayer                    Stealth Wallet
    │                             │                             │
    │  1. Send SOL               │                             │
    ├────────────────────────────►│                             │
    │                             │                             │
    │                             │  2. Swap via Jupiter       │
    │                             ├────────────────────────────►│
    │                             │                             │
    │                             │  3. Transfer tokens        │
    │                             ├────────────────────────────►│
    │                             │                             │
    │  4. Return private key     │                             │
    │◄────────────────────────────┤                             │
    │                             │                             │

NO ON-CHAIN LINK between User Wallet and Stealth Wallet!
```

---

## 🎯 Why This Wins

1. **Actually Works** - Not a demo, not a simulation. Real mainnet transactions.
2. **Solves Real Problem** - Creators need to accumulate without being tracked.
3. **Uses Anoncoin API** - Native integration with Anoncoin's token deployment.
4. **Privacy by Design** - Stealth addresses break the on-chain link.
5. **User Gets Keys** - Full control via exportable private keys.

---

## 📁 Project Structure

```
shadowfi/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── RealAnonymousSwap.jsx
│   │   │   └── TokenLaunch.jsx
│   │   ├── components/
│   │   ├── contexts/
│   │   └── services/
│   └── package.json
├── server/                 # Node.js backend
│   ├── index.js
│   ├── routes/
│   │   ├── relayer.js
│   │   └── token.js
│   └── services/
│       ├── anoncoin/
│       ├── launch/
│       └── swap/
├── package.json
└── README.md
```
---

## 👤 Team

Built solo for the Anoncoin Hackathon by @eth_shaan

---

## 📜 License

MIT License - Use it, fork it, build on it.
