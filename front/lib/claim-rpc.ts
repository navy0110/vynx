import { ApiError } from './wallet-session';

export const CLAIM_RPC_TIMEOUT_MS = 10_000;

export const claimRpcFetch: typeof fetch = async (input, init) => {
  const timeout = AbortSignal.timeout(CLAIM_RPC_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    if (!response.ok) throw new ApiError('Solana devnet is temporarily unavailable. Please retry.', 503, 'RPC_UNAVAILABLE');
    // Include reading the response body in the timeout (web3 parses it later).
    const body = await response.text();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (reason) {
    if (timeout.aborted) throw new ApiError('Solana devnet did not respond in time. Please retry.', 503, 'RPC_TIMEOUT');
    if (reason instanceof ApiError) throw reason;
    throw new ApiError('Solana devnet is temporarily unavailable. Please retry.', 503, 'RPC_UNAVAILABLE');
  }
};

export async function claimRpc<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (reason) {
    if (reason instanceof ApiError) throw reason;
    if (reason instanceof Error && reason.message.includes('requires Solana devnet')) throw reason;
    throw new ApiError('Solana devnet is temporarily unavailable. Please retry.', 503, 'RPC_UNAVAILABLE');
  }
}
