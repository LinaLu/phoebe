// AES-GCM 256 Web Crypto encryption / decryption utilities

export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return Buffer.from(exported).toString("base64");
}

export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const buffer = Buffer.from(keyBase64, "base64");
  return await crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayload {
  encryptedData: string; // Base64
  iv: string; // Base64
}

export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    encryptedData: Buffer.from(encryptedBuffer).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

export async function decryptData(
  encryptedPayload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const iv = Buffer.from(encryptedPayload.iv, "base64");
  const encryptedBuffer = Buffer.from(encryptedPayload.encryptedData, "base64");

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}
