import { isAddress, zeroAddress } from "viem";

export type FhenixChainName = "sepolia" | "arb-sepolia" | "base-sepolia";

const rawContractAddress = import.meta.env.VITE_BLACKOUT_CONTRACT_ADDRESS || "";

export const env = {
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID || "",
  fhenixChain: (import.meta.env.VITE_FHENIX_CHAIN || "base-sepolia") as FhenixChainName,
  contractAddress: isAddress(rawContractAddress) ? rawContractAddress : zeroAddress,
  hasContractAddress: isAddress(rawContractAddress) && rawContractAddress !== zeroAddress,
  deployBlock: BigInt(import.meta.env.VITE_DEPLOY_BLOCK || "0"),
  rpcUrls: {
    sepolia: import.meta.env.VITE_SEPOLIA_RPC_URL || undefined,
    "arb-sepolia": import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC_URL || undefined,
    "base-sepolia": import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || undefined,
  } satisfies Record<FhenixChainName, string | undefined>,
  // Set to "true" to force all on-chain sends to be user-paid (skip sponsorship attempts).
  // Useful for debugging or when your Privy sponsorship quota is exhausted.
  forceUserPaidGas: (import.meta.env.VITE_FORCE_USER_PAID_GAS || "").toLowerCase() === "true",
};

export const isConfigured = Boolean(env.privyAppId && env.hasContractAddress);
