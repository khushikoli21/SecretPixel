# SecretPixel: AES-Based Image Steganography Operations Console

> **Domain:** Applied Cryptography, Information Hiding, Image Steganography, Secure Communication  
> **System Architecture:** AES-256-GCM Galois/Counter Mode & Spatial 24-Bit RGB LSB Substitution  
> **Execution Environment:** 100% In-Memory Client-Side Web Crypto API & Canvas 2D Engine

---

## 1. System Overview

**SecretPixel** is a cybersecurity operations console designed for secure, confidential message concealment. It implements a dual-layer defense-in-depth pipeline:

1. **Cryptography (AES-256-GCM):** Guarantees message confidentiality and authenticity via password-derived 256-bit keys and an integrated 128-bit authentication tag.
2. **Steganography (Least Significant Bit - LSB):** Conceals the existence of the encrypted payload inside raster image pixel channels (Red, Green, Blue) without perceptible image degradation (PSNR > 60 dB).

All cryptographic routines and pixel bit manipulation run **100% in-browser** using the native **Web Crypto API** (`crypto.subtle`). No passwords, confidential messages, or images are ever transmitted across external networks.

---

## 2. Core Architecture & Pipeline

### Sender Workflow
```
Confidential Text Message
          │
          ▼
PBKDF2 Key Derivation (100,000 rounds HMAC-SHA-256 + 128-bit random salt)
          │
          ▼
AES-256-GCM Authenticated Encryption (96-bit random IV + 128-bit Auth Tag)
          │
          ▼
Binary Protocol Assembly (SPXL v1 Header: Magic, Version, Length, Salt, IV, Ciphertext)
          │
          ▼
Canvas LSB Embedding (1 bit per RGB channel, Alpha strictly preserved)
          │
          ▼
Lossless PNG Stego-Image Export (PSNR > 60 dB, MSE < 0.5)
```

### Receiver Workflow
```
Uploaded Stego-Image (PNG)
          │
          ▼
Canvas Pixel Access & LSB Bitstream Extraction
          │
          ▼
SPXL Header Verification (Magic "SPXL", Version 1, Payload Bounds)
          │
          ▼
AES Key Re-derivation from Password + Extracted Salt
          │
          ▼
AES-GCM Authentication & Decryption (Strict Tag Verification)
          │
          ▼
Original Plaintext Recovered
```

---

## 3. Binary Payload Specification (`SPXL v1`)

The embedded bitstream follows a strict, deterministic, big-endian binary format:

| Offset (Bytes) | Field Name | Length | Description |
|---|---|---|---|
| `0..3` | Magic Signature | 4 bytes | `SPXL` (`0x53, 0x50, 0x58, 0x4C`) |
| `4` | Protocol Version | 1 byte | `0x01` (Version 1) |
| `5..8` | Ciphertext Length | 4 bytes | Big-endian unsigned 32-bit integer |
| `9..24` | Cryptographic Salt | 16 bytes | 128-bit PBKDF2 random salt |
| `25..36` | Initialization Vector (IV) | 12 bytes | 96-bit AES-GCM random nonce |
| `37..N` | Ciphertext + Tag | `Length` bytes | AES-256-GCM ciphertext + 128-bit authentication tag |

**Total Header Size:** 37 bytes.  
**Raw Capacity Formula:** $\lfloor \text{Width} \times \text{Height} \times 3 / 8 \rfloor$ bytes.  
**Usable Payload Limit:** $\text{Raw Capacity} - 37$ bytes.

---

## 4. Verification Matrix

The application includes an automated verification suite evaluating 10 deterministic scenarios:

1. **SEC-01 (Valid message and supported image):** Encrypts and embeds into LSB channels without errors.
2. **SEC-02 (Empty message rejection):** Validates and rejects 0-character input before cryptographic processing.
3. **SEC-03 (Missing password rejection):** Refuses key derivation without a passphrase.
4. **SEC-04 (Password mismatch):** Detects discrepancies between password and confirmation fields.
5. **SEC-05 (Insufficient capacity bounds):** Throws explicit capacity exception when payload exceeds available bits.
6. **SEC-06 (Successful extraction & integrity):** Decodes LSBs and reproduces exact original plaintext.
7. **SEC-07 (Wrong password attempt):** AES-GCM tag verification rejects invalid keys; plaintext is never exposed.
8. **SEC-08 (Modified encrypted payload):** Flipped ciphertext bits are caught via AES-GCM tag mismatch.
9. **SEC-09 (Non-stego image rejection):** Images missing the `SPXL` header are rejected before buffer allocation.
10. **SEC-10 (Mobile & desktop responsiveness):** Layout fluidly adapts across 360px, 768px, 1024px, and 1440px viewports.

---

## 5. Technical Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Cryptography:** Browser Native Web Crypto API (`crypto.subtle`)
- **Graphics & Processing:** HTML5 Canvas 2D API (`ImageData` manipulation)
- **Audio & Video:** HTML5 `<audio>`, `<video>`, and Web Audio API
