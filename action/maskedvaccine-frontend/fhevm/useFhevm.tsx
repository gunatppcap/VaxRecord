import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { createFhevmInstance } from "./internal/fhevm";
import type { FhevmInstance } from "./types";

export type FhevmGoState = "idle" | "loading" | "ready" | "error";

export function useFhevm(parameters: { provider: string | ethers.Eip1193Provider | undefined; chainId: number | undefined; enabled?: boolean; initialMockChains?: Readonly<Record<number, string>>; }) {
  const { provider, chainId, enabled = true, initialMockChains } = parameters;
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = useState<FhevmGoState>("idle");
  const [error, setError] = useState<Error | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    setInstance(undefined);
    setStatus("idle");
    setError(undefined);
  }, []);

  useEffect(() => { refresh(); }, [provider, chainId, refresh]);
  useEffect(() => { if (!enabled && controllerRef.current) { controllerRef.current.abort(); setStatus("idle"); setInstance(undefined); } }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!provider) return;
    if (!controllerRef.current) controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;
    setStatus("loading");
    createFhevmInstance({ provider, mockChains: initialMockChains as Record<number, string> | undefined, signal, onStatusChange: () => {} })
      .then((i) => { if (!signal.aborted) { setInstance(i); setStatus("ready"); } })
      .catch((e) => { if (!signal.aborted) { setError(e); setStatus("error"); } });
  }, [enabled, provider, initialMockChains]);

  return { instance, status, error, refresh } as const;
}






