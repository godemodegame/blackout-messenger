# Architecture

Blackout is testnet-first and backendless. There is no app server, no private database, and no local mock path in the product flow.

## Runtime Responsibilities

| Layer | Responsibility |
| --- | --- |
| Browser | Payload JSON, AES-GCM encryption/decryption, local IndexedDB cache |
| Privy | Email/social/wallet login, embedded EVM wallet creation for users without wallets |
| Fhenix CoFHE | Encrypt AES key chunks, manage permits, enforce recipient access to ciphertext handles |
| Smart contract | Grant sender/recipient access to key handles, emit encrypted message bodies |
| Testnet logs | Async mailbox and delivery history |

## Send Flow

```text
compose payload
  -> generate AES-256 key + 12-byte IV
  -> AES-GCM encrypt JSON payload
  -> split AES key into two uint128 values
  -> CoFHE encrypt both uint128 values
  -> send transaction to BlackoutMessenger
  -> contract grants access to sender + recipient
  -> MessageSent event becomes the mailbox packet
```

## Receive Flow

```text
read MessageSent events for connected wallet
  -> cache encrypted packets in IndexedDB
  -> user clicks Decrypt
  -> app creates/uses Fhenix self permit
  -> decrypt keyPartA + keyPartB via decryptForView
  -> recombine AES key
  -> decrypt message body in browser
  -> cache plaintext only on this device
```

## Why Fhenix Is Not Storing Whole Messages

CoFHE inputs are typed encrypted scalar values such as encrypted integers and booleans. A complete chat payload is arbitrary bytes, so the app uses Fhenix for the confidential AES key and browser WebCrypto for the message body.

This keeps the Fhenix interaction small: two encrypted `uint128` inputs per message.

## Privacy Properties

Protected:

- Message text and sticker id.
- AES key material.
- Decrypted content after receipt, unless the device itself is compromised.

Not protected in this MVP:

- Sender address.
- Recipient address.
- Time of send.
- Message size.
- Permanent existence of encrypted bytes on the chain.

## Sticker Payloads

Sticker assets are bundled in `/public/stickers`. The chain never stores custom sticker images. The encrypted payload stores only an internal `stickerId`, for example:

```json
{
  "version": 1,
  "type": "sticker",
  "stickerId": "radio-heart"
}
```

## Important Limit

The contract caps encrypted message bodies at 4096 bytes. This is meant for short text and sticker payloads. Attachments should be handled later with a decentralized storage pointer and encrypted content hash.
