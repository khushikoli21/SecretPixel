/**
 * SecretPixel Steganography Engine
 * Binary Protocol and Least Significant Bit (LSB) embedding/extraction across RGB channels.
 */

export const MAGIC_SIGNATURE = new Uint8Array([0x53, 0x50, 0x58, 0x4c]); // "SPXL"
export const PROTOCOL_VERSION = 1;
export const HEADER_LENGTH = 37; // 4 (magic) + 1 (version) + 4 (len) + 16 (salt) + 12 (iv)

export interface CapacityInfo {
  width: number;
  height: number;
  totalPixels: number;
  rawBitsCapacity: number;
  rawBytesCapacity: number;
  usablePayloadBytes: number;
}

export interface StegoMetrics {
  mse: number;
  psnr: number;
  modifiedPixels: number;
  capacityUsedPercent: number;
}

export interface ExtractedPayload {
  version: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertextWithTag: Uint8Array;
}

/**
 * Calculates theoretical and usable LSB capacity for given pixel dimensions.
 * Uses 1 LSB per RGB channel (3 bits per pixel). Alpha is preserved.
 */
export function calculateCapacity(width: number, height: number): CapacityInfo {
  const totalPixels = Math.max(0, Math.floor(width) * Math.floor(height));
  const rawBitsCapacity = totalPixels * 3;
  const rawBytesCapacity = Math.floor(rawBitsCapacity / 8);
  const usablePayloadBytes = Math.max(0, rawBytesCapacity - HEADER_LENGTH);

  return {
    width,
    height,
    totalPixels,
    rawBitsCapacity,
    rawBytesCapacity,
    usablePayloadBytes
  };
}

/**
 * Assembles the versioned SecretPixel binary payload:
 * [0..3]   Magic "SPXL" (4 bytes)
 * [4]      Version (1 byte = 0x01)
 * [5..8]   Ciphertext Length (4 bytes, Big-Endian uint32)
 * [9..24]  PBKDF2 Salt (16 bytes)
 * [25..36] AES-GCM IV (12 bytes)
 * [37..]   Ciphertext + Tag (N bytes)
 */
export function buildPayload(
  ciphertextWithTag: Uint8Array,
  salt: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  const cipherLen = ciphertextWithTag.length;
  const totalSize = HEADER_LENGTH + cipherLen;
  const payload = new Uint8Array(totalSize);

  // Magic
  payload.set(MAGIC_SIGNATURE, 0);

  // Version
  payload[4] = PROTOCOL_VERSION;

  // Ciphertext length (Big-Endian uint32)
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  view.setUint32(5, cipherLen, false);

  // Salt (16 bytes)
  payload.set(salt, 9);

  // IV (12 bytes)
  payload.set(iv, 25);

  // Ciphertext
  payload.set(ciphertextWithTag, HEADER_LENGTH);

  return payload;
}

/**
 * Embeds binary payload into ImageData using LSB substitution on RGB channels.
 * Alpha (A) channels are strictly preserved.
 */
export function embedPayloadIntoImageData(
  imageData: ImageData,
  payload: Uint8Array
): { modifiedPixels: number } {
  const { data, width, height } = imageData;
  const capacity = calculateCapacity(width, height);

  if (payload.length > capacity.rawBytesCapacity) {
    throw new Error(
      `Payload size (${payload.length} bytes) exceeds available image capacity (${capacity.rawBytesCapacity} bytes). Select a larger image or reduce message length.`
    );
  }

  const totalBits = payload.length * 8;
  let bitIndex = 0;
  let modifiedPixelsCount = 0;
  const pixelsCount = width * height;

  for (let p = 0; p < pixelsCount && bitIndex < totalBits; p++) {
    const pixelOffset = p * 4;
    let pixelModified = false;

    // Channels R(0), G(1), B(2)
    for (let c = 0; c < 3 && bitIndex < totalBits; c++) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = 7 - (bitIndex % 8); // MSB first
      const bit = (payload[byteIndex] >> bitOffset) & 1;

      const currentByte = data[pixelOffset + c];
      const newByte = (currentByte & 0xfe) | bit;

      if (newByte !== currentByte) {
        data[pixelOffset + c] = newByte;
        pixelModified = true;
      }

      bitIndex++;
    }

    if (pixelModified) {
      modifiedPixelsCount++;
    }
  }

  return { modifiedPixels: modifiedPixelsCount };
}

/**
 * Extracts the SecretPixel binary payload from ImageData.
 * Validates magic signature, version, and length bounds before allocating.
 */
export function extractPayloadFromImageData(imageData: ImageData): ExtractedPayload {
  const { data, width, height } = imageData;
  const capacity = calculateCapacity(width, height);

  if (capacity.rawBytesCapacity < HEADER_LENGTH) {
    throw new Error('Image is too small to contain a valid SecretPixel payload header.');
  }

  // Helper to read N bits starting from bit cursor
  let bitCursor = 0;
  function readByte(): number {
    let byteVal = 0;
    for (let i = 0; i < 8; i++) {
      const pixelIndex = Math.floor(bitCursor / 3);
      const channel = bitCursor % 3;
      const dataIndex = pixelIndex * 4 + channel;

      const bit = data[dataIndex] & 1;
      byteVal = (byteVal << 1) | bit;
      bitCursor++;
    }
    return byteVal;
  }

  // 1. Read first 4 bytes (Magic signature)
  const magic = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    magic[i] = readByte();
  }

  const hasValidMagic =
    magic[0] === MAGIC_SIGNATURE[0] &&
    magic[1] === MAGIC_SIGNATURE[1] &&
    magic[2] === MAGIC_SIGNATURE[2] &&
    magic[3] === MAGIC_SIGNATURE[3];

  if (!hasValidMagic) {
    throw new Error(
      'No SecretPixel signature found in this image. Either this is not a stego-image, or the hidden bits were altered.'
    );
  }

  // 2. Read version (1 byte)
  const version = readByte();
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported SecretPixel payload version: ${version}. Expected version ${PROTOCOL_VERSION}.`);
  }

  // 3. Read ciphertext length (4 bytes uint32 big-endian)
  const lenBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    lenBytes[i] = readByte();
  }
  const view = new DataView(lenBytes.buffer);
  const cipherLen = view.getUint32(0, false);

  // Validate bounds
  if (cipherLen <= 0 || HEADER_LENGTH + cipherLen > capacity.rawBytesCapacity) {
    throw new Error(
      `Invalid or corrupted payload length declared (${cipherLen} bytes). Image capacity is ${capacity.rawBytesCapacity} bytes.`
    );
  }

  // 4. Read salt (16 bytes)
  const salt = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    salt[i] = readByte();
  }

  // 5. Read IV (12 bytes)
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = readByte();
  }

  // 6. Read ciphertext + tag
  const ciphertextWithTag = new Uint8Array(cipherLen);
  for (let i = 0; i < cipherLen; i++) {
    ciphertextWithTag[i] = readByte();
  }

  return {
    version,
    salt,
    iv,
    ciphertextWithTag
  };
}

/**
 * Calculates genuine MSE (Mean Squared Error) and PSNR (Peak Signal-to-Noise Ratio)
 * by comparing original cover image pixel data against modified stego pixel data.
 */
export function calculateImageMetrics(
  originalData: ImageData,
  stegoData: ImageData,
  payloadBytes: number
): StegoMetrics {
  const orig = originalData.data;
  const stego = stegoData.data;
  const len = orig.length;
  const totalPixels = originalData.width * originalData.height;

  let sumSquaredError = 0;
  let modifiedPixels = 0;

  for (let i = 0; i < len; i += 4) {
    let pixelDiffers = false;
    // Check R, G, B channels
    for (let c = 0; c < 3; c++) {
      const diff = orig[i + c] - stego[i + c];
      if (diff !== 0) {
        sumSquaredError += diff * diff;
        pixelDiffers = true;
      }
    }
    if (pixelDiffers) {
      modifiedPixels++;
    }
  }

  // Total color samples = 3 * totalPixels
  const totalSamples = totalPixels * 3;
  const mse = totalSamples > 0 ? sumSquaredError / totalSamples : 0;

  // PSNR = 10 * log10(255^2 / MSE)
  let psnr = 99.9;
  if (mse > 0) {
    psnr = 10 * Math.log10((255 * 255) / mse);
  }

  const rawBytes = Math.floor((totalPixels * 3) / 8);
  const capacityUsedPercent = rawBytes > 0 ? (payloadBytes / rawBytes) * 100 : 0;

  return {
    mse: Number(mse.toFixed(4)),
    psnr: Number(psnr.toFixed(2)),
    modifiedPixels,
    capacityUsedPercent: Number(capacityUsedPercent.toFixed(2))
  };
}
