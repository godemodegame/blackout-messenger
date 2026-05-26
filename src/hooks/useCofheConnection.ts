import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { cofheClient, connectCofhe } from "../lib/cofheClient";

export type CofheStatus = "idle" | "connecting" | "ready" | "error";

export function useCofheConnection() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState<CofheStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function connect() {
      if (!publicClient || !walletClient) {
        setStatus("idle");
        return;
      }

      setStatus("connecting");
      setError(null);

      try {
        await connectCofhe(publicClient, walletClient);
        if (!isCancelled) setStatus("ready");
      } catch (connectError) {
        if (!isCancelled) {
          setStatus("error");
          setError(
            connectError instanceof Error
              ? connectError.message
              : "Could not connect to Fhenix.",
          );
        }
      }
    }

    void connect();

    return () => {
      isCancelled = true;
    };
  }, [publicClient, walletClient]);

  return {
    client: cofheClient,
    status,
    error,
  };
}
