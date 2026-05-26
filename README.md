# Blackout Messenger

Backendless 1-to-1 encrypted messaging for Fhenix-supported testnets.

Blackout uses the chain as the mailbox, Fhenix/CoFHE as the confidential key vault, and the browser as the place where message plaintext exists. The UI is styled like a late-1990s/early-2000s desktop messenger: small windows, hard bevels, sticker tray, and no cloud database.

## Stack

- React + TypeScript + Vite
- Privy for login and embedded EVM wallets
- wagmi + viem for testnet reads/writes
- Fhenix CoFHE for encrypted AES key chunks and access control
- WebCrypto AES-GCM for the message payload body
- IndexedDB for local decrypted/cache state
- Hardhat for deploying the Fhenix contract to testnets

## Message Model

1. The browser builds a JSON payload for text, sticker, or mixed messages.
2. The browser encrypts that payload with a fresh AES-256-GCM key.
3. The AES key is split into two `uint128` chunks.
4. The chunks are encrypted through `@cofhe/sdk/web`.
5. `BlackoutMessenger.sendMessage` stores the encrypted key handles and emits the encrypted body in a `MessageSent` event.
6. The recipient reads events from the chain, decrypts both key chunks with a Fhenix permit, and decrypts the body locally.

The contract never sees message plaintext or AES key plaintext. Observers can still see sender, recipient, timing, and encrypted bytes.

## Quick Start

```bash
npm install
cp .env.example .env
```

Fill `.env`, then deploy to one supported Fhenix testnet:

```bash
npm run deploy:base-sepolia
```

Copy the deployed address into `VITE_BLACKOUT_CONTRACT_ADDRESS`, set `VITE_DEPLOY_BLOCK` to the deployment block or `0`, then run:

```bash
npm run dev
```

## Required Environment

- `VITE_PRIVY_APP_ID`: Privy app id for web login and embedded wallets.
- `VITE_FHENIX_CHAIN`: `sepolia`, `arb-sepolia`, or `base-sepolia`.
- `VITE_BLACKOUT_CONTRACT_ADDRESS`: deployed `BlackoutMessenger` contract.
- `VITE_DEPLOY_BLOCK`: first block to scan for mailbox events.
- `PRIVATE_KEY`: deployer private key for Hardhat.
- `*_RPC_URL`: RPC endpoints for frontend and deployment.

Never put a funded mainnet key in `.env`.

## Scripts

- `npm run dev`: start the webapp.
- `npm run build`: typecheck and build the app.
- `npm run compile`: compile Solidity contracts.
- `npm run deploy:sepolia`: deploy to Ethereum Sepolia.
- `npm run deploy:arb-sepolia`: deploy to Arbitrum Sepolia.
- `npm run deploy:base-sepolia`: deploy to Base Sepolia.

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Testnet Setup](./docs/TESTNET_SETUP.md)
