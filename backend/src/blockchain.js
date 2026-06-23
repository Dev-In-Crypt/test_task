import { ethers } from "ethers";
import { TEST_TOKEN_ABI } from "./abi.js";

// Cache for the token's decimals so we only fetch it from chain once.
let cachedDecimals;

/**
 * Build the provider / wallet / contract trio from the given config.
 * Exposed as a factory so tests can inject a local (Anvil) config.
 */
export function createBlockchain({ rpcUrl, privateKey, contractAddress }) {
  if (!rpcUrl) throw new Error("RPC_URL is not set");
  if (!privateKey) throw new Error("PRIVATE_KEY is not set");
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS is not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  // Wrap the wallet in a NonceManager so rapid, back-to-back transactions
  // (e.g. a /mint immediately followed by a /burn) each get a fresh nonce
  // instead of racing on the network's "pending" count.
  const signer = new ethers.NonceManager(wallet);
  const contract = new ethers.Contract(contractAddress, TEST_TOKEN_ABI, signer);

  return { provider, wallet, signer, contract };
}

/** Fetch (and memoize) the token's decimals. */
export async function getDecimals(contract) {
  if (cachedDecimals === undefined) {
    cachedDecimals = Number(await contract.decimals());
  }
  return cachedDecimals;
}

/** Reset the memoized decimals — used by tests that swap the contract. */
export function _resetDecimalsCache() {
  cachedDecimals = undefined;
}
