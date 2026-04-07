const crypto = require('crypto');

const algorithm = 'aes-256-gcm';

// CRITICAL FIX: AES-256 requires a strictly 32-byte key. 
// We use scryptSync to deterministicly turn your password string into a secure 32-byte key.
// This prevents crashes if your .env key is too short or too long.
const PASSWORD = process.env.ENCRYPTION_KEY || 'evergreenEncyrptionKey@32ByetsRequired';
const secretKey = crypto.scryptSync(PASSWORD, 'salt', 32); 

function encrypt(text) {
  // FIX: Handle null, undefined, and empty strings
  if (!text || text === '') {
    return '';
  }
  
  // If it's already encrypted (contains colons), return as-is
  if (typeof text === 'string' && text.split(':').length === 3) {
    return text;
  }
  
  try {
    const iv = crypto.randomBytes(16);
    
    // CHANGED: Use createCipheriv (Secure) instead of createCipher (Deprecated)
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error.message);
    return text; // Return original text if encryption fails
  }
}

function decrypt(encryptedText) {
  // FIX: Handle null, undefined, and empty strings
  if (!encryptedText || encryptedText === '') {
    return '';
  }
  
  // If it's not a string or doesn't look like encrypted data, return as-is
  if (typeof encryptedText !== 'string') {
    return String(encryptedText);
  }
  
  const parts = encryptedText.split(':');

  // FIX FOR CRASH: Check if data is actually encrypted
  // If we don't have 3 parts, it's likely old plain text data. Return it as-is.
  if (parts.length !== 3) {
    return encryptedText;
  }
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    // Validate buffer lengths
    if (iv.length !== 16 || authTag.length !== 16) {
      return encryptedText;
    }
    
    // CHANGED: Use createDecipheriv (Secure)
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails (wrong key, corrupted data), return original text 
    // or empty string to prevent app crash
    console.error('Decryption failed:', error.message);
    return ''; 
  }
}

module.exports = {
  encrypt,
  decrypt
};