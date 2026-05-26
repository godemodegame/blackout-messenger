import { Address } from "viem";
import { chainLabelById, appChain } from "../config/chains";
import { env, isConfigured } from "../config/env";
import { CofheStatus } from "../hooks/useCofheConnection";

export function StatusBar({
  address,
  cofheStatus,
}: {
  address?: Address;
  cofheStatus: CofheStatus;
}) {
  const networkName =
    chainLabelById[appChain.id as keyof typeof chainLabelById] || appChain.name;

  return (
    <footer className="status-bar" aria-live="polite">
      <span>{isConfigured ? "SYSTEM ONLINE" : "CONFIG REQUIRED"}</span>
      <span>{networkName}</span>
      <span>Fhenix: {cofheStatus.toUpperCase()}</span>
      <span>{address ? shortAddress(address) : "NO USER"}</span>
      <span>{env.hasContractAddress ? shortAddress(env.contractAddress) : "NO CONTRACT"}</span>
    </footer>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
