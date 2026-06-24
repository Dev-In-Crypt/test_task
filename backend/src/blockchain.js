import { ethers } from "ethers";
import { TEST_TOKEN_ABI } from "./abi.js";

// decimals never changes, so cache it after the first read
let cachedDecimals;

// factory so the tests can pass their own anvil config in
export function createBlockchain({ rpcUrl, privateKey, contractAddress }) {
  if (!rpcUrl) throw new Error("RPC_URL is not set");
  if (!privateKey) throw new Error("PRIVATE_KEY is not set");
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS is not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  // NonceManager keeps a local nonce counter, otherwise a mint followed
  // straight away by a burn can grab the same pending nonce and one fails
  const signer = new ethers.NonceManager(wallet);
  const contract = new ethers.Contract(contractAddress, TEST_TOKEN_ABI, signer);

  return { provider, wallet, signer, contract };
}

export async function getDecimals(contract) {
  if (cachedDecimals === undefined) {
    cachedDecimals = Number(await contract.decimals());
  }
  return cachedDecimals;
}

// the tests swap in a fresh contract, so they need to clear this
export function _resetDecimalsCache() {
  cachedDecimals = undefined;
}
