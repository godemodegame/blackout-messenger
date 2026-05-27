import { Encryptable, FheTypes } from "@cofhe/sdk";
import { chains as cofheChains } from "@cofhe/sdk/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import initTfhe from "tfhe";
import tfheWasmUrl from "tfhe/tfhe_bg.wasm?url";
import { appChain } from "../config/chains";

type CofheChain = (typeof cofheChains)[keyof typeof cofheChains];

const knownCofheChains = cofheChains as Record<string, CofheChain | undefined>;

function resolveCofheChain(chainId: number) {
  if (chainId === 11155111) return knownCofheChains.sepolia;
  if (chainId === 421614) return knownCofheChains.arbitrumSepolia || knownCofheChains.arbSepolia;
  if (chainId === 84532) return knownCofheChains.baseSepolia;
  return knownCofheChains.baseSepolia || knownCofheChains.sepolia;
}

const cofheChain = resolveCofheChain(appChain.id);

if (!cofheChain) {
  throw new Error("Selected Fhenix chain is not available in @cofhe/sdk/chains.");
}

const config = createCofheConfig({
  supportedChains: [cofheChain],
  useWorkers: true,
});

export const cofheClient = createCofheClient(config);
export type CofhePermit = NonNullable<ReturnType<typeof cofheClient.permits.getActivePermit>>;

let tfheWasmReady: Promise<void> | undefined;
const selfPermitReadyByAccount = new Map<string, Promise<CofhePermit>>();

function ensureTfheWasm() {
  tfheWasmReady ??= initTfhe(tfheWasmUrl).then(() => undefined);
  return tfheWasmReady;
}

export async function connectCofhe(publicClient: unknown, walletClient: unknown) {
  await ensureTfheWasm();
  await cofheClient.connect(publicClient as never, walletClient as never);
  return cofheClient;
}

export async function ensureCofhePermit(account?: string) {
  const activePermit = cofheClient.permits.getActivePermit(appChain.id, account);
  if (activePermit?.type === "self") return activePermit;

  const key = `${appChain.id}:${account || "connected"}`;
  const existing = selfPermitReadyByAccount.get(key);
  if (existing) return existing;

  const ready = cofheClient.permits
    .getOrCreateSelfPermit(
      appChain.id,
      account,
      account
        ? {
            issuer: account,
            name: "Blackout decrypt permit",
          }
        : undefined,
    )
    .finally(() => {
      selfPermitReadyByAccount.delete(key);
    });
  selfPermitReadyByAccount.set(key, ready);

  return ready;
}

export async function encryptKeyParts(keyPartA: bigint, keyPartB: bigint) {
  await ensureTfheWasm();
  const [encryptedPartA, encryptedPartB] = await cofheClient
    .encryptInputs([Encryptable.uint128(keyPartA), Encryptable.uint128(keyPartB)])
    .setChainId(appChain.id)
    .execute();

  return [encryptedPartA, encryptedPartB] as const;
}

export async function decryptKeyPart(handle: bigint | string, permit?: CofhePermit) {
  const builder = cofheClient
    .decryptForView(handle, FheTypes.Uint128)
    .setChainId(appChain.id)
    .set404RetryTimeout(20_000);

  if (permit) builder.withPermit(permit);

  return builder.execute();
}
