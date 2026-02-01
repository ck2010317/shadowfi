const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const bs58 = require('bs58').default || require('bs58');

async function transfer() {
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1', 'confirmed');
  
  // Relayer wallet
  const relayerKey = bs58.decode('5yt73dnAewnwrKTDHeNbyLYGoyvxQ4hhnuKurx4qEUWdP2mibFVW1HSvFWLR3Ys98YpevPrtqcK7L5ifNcaTScmD');
  const relayer = Keypair.fromSecretKey(relayerKey);
  console.log('Relayer:', relayer.publicKey.toBase58());
  
  // Stealth address
  const stealthAddress = new PublicKey('88sR3ZvnWz2sQURxPCA93Gi2aQAnEuFYEhSUbpEb4xbu');
  console.log('Stealth:', stealthAddress.toBase58());
  
  // SHADOW token mint
  const tokenMint = new PublicKey('E2wwdzHgdX6T68V4AFAk2f3ya6ctEU5gkAhhaxUidoge');
  
  // Get ATAs
  const relayerATA = await getAssociatedTokenAddress(tokenMint, relayer.publicKey);
  const stealthATA = await getAssociatedTokenAddress(tokenMint, stealthAddress);
  console.log('Relayer ATA:', relayerATA.toBase58());
  console.log('Stealth ATA:', stealthATA.toBase58());
  
  // Check relayer balance
  const relayerBalance = await connection.getBalance(relayer.publicKey);
  console.log('Relayer SOL balance:', relayerBalance / 1e9);
  
  // Check if stealth ATA exists
  const stealthATAInfo = await connection.getAccountInfo(stealthATA);
  console.log('Stealth ATA exists:', stealthATAInfo !== null);
  
  // Get relayer token balance
  const tokenBalance = await connection.getTokenAccountBalance(relayerATA);
  console.log('Relayer SHADOW balance:', tokenBalance.value.uiAmount);
  
  // Amount to transfer (68,780,494,405,345)
  const amount = BigInt('68780494405345');
  
  // Build transaction
  const tx = new Transaction();
  
  // We have 0.00275 SOL - we need ~0.002 SOL for rent-exempt ATA
  // Let's skip funding stealth directly and just use relayer as payer for ATA
  // The relayer will pay for ATA creation (rent ~0.002 SOL)
  
  // Step 1: Create stealth ATA if needed (relayer pays rent)
  if (stealthATAInfo === null) {
    tx.add(createAssociatedTokenAccountInstruction(
      relayer.publicKey, // payer
      stealthATA,        // ata
      stealthAddress,    // owner
      tokenMint          // mint
    ));
    console.log('Adding ATA creation instruction (relayer pays rent)');
  }
  
  // Step 3: Transfer tokens
  tx.add(createTransferInstruction(
    relayerATA,        // source
    stealthATA,        // destination
    relayer.publicKey, // owner
    amount             // amount
  ));
  console.log('Adding token transfer:', amount.toString());
  
  // Send transaction
  console.log('Sending transaction...');
  const sig = await sendAndConfirmTransaction(connection, tx, [relayer], {
    commitment: 'confirmed'
  });
  console.log('SUCCESS! Transaction:', sig);
  
  // Verify
  const finalBalance = await connection.getTokenAccountBalance(stealthATA);
  console.log('Stealth SHADOW balance:', finalBalance.value.uiAmount);
}

transfer().catch(console.error);
