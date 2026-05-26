import { Hex, keccak256 } from "viem";
import { bigIntToBytes, bytesToBigInt, bytesToHex, concatBytes, hexToBytes } from "./bytes";
import { MessagePayload } from "../types/messages";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedPayload = {
  encryptedBody: Hex;
  iv: Hex;
  bodyHash: Hex;
  keyPartA: bigint;
  keyPartB: bigint;
};

export async function encryptPayload(payload: MessagePayload): Promise<EncryptedPayload> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const cryptoKey = await crypto.subtle.importKey("raw", copyBytes(keyBytes), "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: copyBytes(ivBytes),
    },
    cryptoKey,
    plaintext,
  );

  const encryptedBody = bytesToHex(new Uint8Array(ciphertext));

  return {
    encryptedBody,
    iv: bytesToHex(ivBytes),
    bodyHash: keccak256(encryptedBody),
    keyPartA: bytesToBigInt(keyBytes.slice(0, 16)),
    keyPartB: bytesToBigInt(keyBytes.slice(16, 32)),
  };
}

export async function decryptPayload(
  encryptedBody: Hex,
  iv: Hex,
  keyPartA: bigint,
  keyPartB: bigint,
): Promise<MessagePayload> {
  const keyBytes = concatBytes(bigIntToBytes(keyPartA, 16), bigIntToBytes(keyPartB, 16));
  const cryptoKey = await crypto.subtle.importKey("raw", copyBytes(keyBytes), "AES-GCM", false, [
    "decrypt",
  ]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: copyBytes(hexToBytes(iv)),
    },
    cryptoKey,
    copyBytes(hexToBytes(encryptedBody)),
  );
  const parsed = JSON.parse(decoder.decode(plaintext)) as MessagePayload;

  if (parsed.version !== 1) {
    throw new Error("Unsupported message version.");
  }

  return parsed;
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
