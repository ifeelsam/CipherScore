import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomBytes } from 'crypto';

export class WalletAuthService {
  
  // Generate a nonce for wallet signature verification
  static generateNonce(): string {
    return randomBytes(32).toString('hex');
  }
  
  // Create message for user to sign
  static createSignMessage(walletAddress: string, nonce: string): string {
    const domain = process.env.APP_DOMAIN || 'Cypher Credit Score API';
    const timestamp = new Date().toISOString();
    
    return `Welcome to ${domain}!

This request will not trigger a blockchain transaction or cost any gas fees.

Your authentication status will reset after 24 hours.

Wallet address: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}`;
  }
  
  // Verify wallet signature
  static verifySignature(
    message: string, 
    signature: string, 
    walletAddress: string
  ): boolean {
    try {
      // Convert signature and message to proper format
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(message);
      const publicKeyBytes = bs58.decode(walletAddress);
      
      // Verify the signature
      return nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
  
  // Alternative verification for Solana wallets (like Phantom)
  static verifySolanaSignature(
    message: string,
    signature: string,
    walletAddress: string
  ): boolean {
    try {
      const publicKey = new PublicKey(walletAddress);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      
      return nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );
    } catch (error) {
      console.error('Solana signature verification error:', error);
      return false;
    }
  }
  
  // Validate wallet address format
  static isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
  
  // Generate session token
  static generateSessionToken(): string {
    return `sess_${randomBytes(32).toString('hex')}`;
  }
}