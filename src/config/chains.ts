import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { arbitrumSepolia, baseSepolia, sepolia } from "viem/chains";
import { env, FhenixChainName } from "./env";

export const supportedChains = [sepolia, arbitrumSepolia, baseSepolia] as const;

const chainByName = {
  sepolia,
  "arb-sepolia": arbitrumSepolia,
  "base-sepolia": baseSepolia,
} satisfies Record<FhenixChainName, (typeof supportedChains)[number]>;

export const appChain = chainByName[env.fhenixChain] || baseSepolia;

export const chainLabelById = {
  [sepolia.id]: "Ethereum Sepolia",
  [arbitrumSepolia.id]: "Arbitrum Sepolia",
  [baseSepolia.id]: "Base Sepolia",
} as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [sepolia.id]: http(env.rpcUrls.sepolia),
    [arbitrumSepolia.id]: http(env.rpcUrls["arb-sepolia"]),
    [baseSepolia.id]: http(env.rpcUrls["base-sepolia"]),
  },
});
