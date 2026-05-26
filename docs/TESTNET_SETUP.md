# Testnet Setup

Blackout is configured for Fhenix-supported testnets:

- Ethereum Sepolia: `eth-sepolia`
- Arbitrum Sepolia: `arb-sepolia`
- Base Sepolia: `base-sepolia`

The frontend defaults to Base Sepolia through `VITE_FHENIX_CHAIN=base-sepolia`.

## 1. Install

```bash
npm install
```

## 2. Configure Privy

Create a Privy app in the Privy dashboard and copy the app id into:

```text
VITE_PRIVY_APP_ID=
```

The app is configured to create embedded wallets for users who log in without an existing wallet.
To let new embedded wallets send without holding testnet ETH, enable TEE wallet execution in
Privy, then enable gas sponsorship for the testnet you are using. If you sponsor transactions
directly from the browser, also allow client-side sponsored transactions in Privy's gas
sponsorship settings.

## 3. Configure RPC URLs

Fill the RPC URL for the testnet you want to use. For Base Sepolia:

```text
VITE_FHENIX_CHAIN=base-sepolia
VITE_BASE_SEPOLIA_RPC_URL=https://...
BASE_SEPOLIA_RPC_URL=https://...
```

The `VITE_` value is used by the browser. The non-`VITE_` value is used by Hardhat.

## 4. Configure Deployer

Set:

```text
PRIVATE_KEY=0x...
```

Use a testnet-only key with just enough gas. Do not reuse a personal wallet or mainnet-funded key.

## 5. Deploy

```bash
npm run deploy:base-sepolia
```

Other supported targets:

```bash
npm run deploy:sepolia
npm run deploy:arb-sepolia
```

Deployment metadata is written to `deployments/<network>.json`.

## 6. Update Frontend Env

After deployment, copy the address into:

```text
VITE_BLACKOUT_CONTRACT_ADDRESS=0x...
```

Set the event scan start:

```text
VITE_DEPLOY_BLOCK=12345678
```

You can use `0` during early testing, but scanning from the deploy block is faster and cheaper.

## 7. Run

```bash
npm run dev
```

Open the Vite URL, log in with Privy, enter another user's wallet address, and send a short encrypted packet.

## Notes

- Fhenix permits are stored locally by the SDK. A recipient must sign/create a permit before decrypting message key handles.
- IndexedDB stores decrypted cache on that device only.
- On-chain event data is permanent. Keep this MVP to short text and fixed bundled stickers.
