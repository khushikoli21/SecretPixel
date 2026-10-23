/**
 * SecretPixel Cryptographic Engine
 * Implements AES-GCM 256-bit authenticated encryption with PBKDF2 key derivation.
 * Utilizes the browser's native Web Crypto API (crypto.subtle).
 */

export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH = 16; // 128-bit random salt
export const IV_LENGTH = 12;   // 96-bit random IV standard for AES-GCM
export const AES_KEY_LENGTH = 256; // 256-bit AES

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user password and random salt using PBKDF2.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-GCM with a password-derived key.
 * Generates fresh cryptographic salt and IV for every operation.
 */
export async function encryptMessage(
  plainText: string,
  password: string
): Promise<{ ciphertextWithTag: Uint8Array; salt: Uint8Array; iv: Uint8Array }> {
  if (!plainText || plainText.length === 0) {
    throw new Error('Secret message cannot be empty.');
  }
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty.');
  }

  // Generate cryptographically secure random 16-byte salt and 12-byte IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive AES key
  const key = await deriveKey(password, salt);

  // Encode plaintext to UTF-8 bytes
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plainText);

  // Perform AES-GCM encryption (includes 16-byte authentication tag at the end)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128 // 128-bit authentication tag
    },
    key,
    encodedText
  );

  return {
    ciphertextWithTag: new Uint8Array(ciphertextBuffer),
    salt,
    iv
  };
}

/**
 * Decrypts AES-GCM ciphertext using password, salt, and IV.
 * Strictly verifies the 128-bit authentication tag before returning any plaintext.
 */
export async function decryptMessage(
  ciphertextWithTag: Uint8Array,
  password: string,
  salt: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Decryption password is required.');
  }

  // Derive the exact same key from password and stored salt
  const key = await deriveKey(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128
      },
      key,
      ciphertextWithTag as unknown as BufferSource
    );

    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(decryptedBuffer);
  } catch {
    // Web Crypto throws OperationError if authentication tag fails or data is corrupt
    throw new Error('Decryption failed: Incorrect password or modified/corrupted payload.');
  }
}

/**
 * Evaluates password strength without storing or logging anything.
 */
export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  tips: string[];
} {
  if (!password) {
    return { score: 0, label: 'Weak', tips: ['Enter a password with at least 8 characters.'] };
  }

  let score = 0;
  const tips: string[] = [];

  if (password.length >= 8) score++;
  else tips.push('Use at least 8 characters');

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else tips.push('Include both uppercase and lowercase letters');

  if (/[0-9]/.test(password)) score++;
  else tips.push('Include at least one number');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else tips.push('Include a special symbol (e.g. !@#$)');

  let label: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  if (score >= 4) label = 'Strong';
  else if (score === 3) label = 'Good';
  else if (score === 2) label = 'Fair';
  else label = 'Weak';

  return { score, label, tips };
}
