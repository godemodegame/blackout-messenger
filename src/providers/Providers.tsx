import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { ReactNode, useState } from "react";
import { appChain, supportedChains, wagmiConfig } from "../config/chains";
import { env } from "../config/env";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={env.privyAppId || "missing-privy-app-id"}
      config={{
        defaultChain: appChain,
        supportedChains: [...supportedChains],
        loginMethods: ["email", "sms", "wallet", "google", "github"],
        appearance: {
          theme: "dark",
          accentColor: "#00a884",
          walletChainType: "ethereum-only",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
            // Gas sponsorship for embedded wallets is controlled in the Privy Dashboard:
            // https://dashboard.privy.io → Your App → Gas Sponsorship
            // You must explicitly enable it for each supported chain (Base Sepolia, etc.)
            // and optionally create a policy. Without it, `sponsor: true` calls will fall back
            // to the user paying gas (see sendTransactionWithSponsorFallback in useMailbox.ts).
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
