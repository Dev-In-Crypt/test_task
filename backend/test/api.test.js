import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ethers } from "ethers";
import { createApp } from "../src/app.js";
import { createBlockchain, _resetDecimalsCache } from "../src/blockchain.js";

// end-to-end test: spin up anvil, deploy the contract from the build artifact,
// start the app against it and call every endpoint over HTTP.
// needs anvil on PATH and `forge build` already run in ../contracts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const RPC_URL = "http://127.0.0.1:8545";
// anvil's first account (default test mnemonic), which owns the token
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

let anvil;
let server;
let baseUrl;
let deployProvider;
let appProvider;

async function waitForRpc(provider, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Anvil did not start in time");
}

before(async () => {
  // Spawn the real binary (no shell) so `anvil.pid` is the node we can kill.
  const anvilBin = process.platform === "win32" ? "anvil.exe" : "anvil";
  anvil = spawn(anvilBin, ["--silent"], { stdio: "ignore" });

  deployProvider = new ethers.JsonRpcProvider(RPC_URL);
  await waitForRpc(deployProvider);

  // Deploy from the compiled Foundry artifact.
  const artifactPath = join(
    __dirname,
    "../../contracts/out/TestToken.sol/TestToken.json"
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const wallet = new ethers.Wallet(PRIVATE_KEY, deployProvider);
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode.object,
    wallet
  );
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const contractAddress = await deployed.getAddress();

  _resetDecimalsCache();
  const { contract, provider } = createBlockchain({
    rpcUrl: RPC_URL,
    privateKey: PRIVATE_KEY,
    contractAddress,
  });
  appProvider = provider;

  const app = createApp({ contract });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  // Stop ethers' background polling so the process can exit cleanly.
  if (appProvider) appProvider.destroy();
  if (deployProvider) deployProvider.destroy();
  if (anvil) anvil.kill();
});

test("GET /balance returns the deployer's initial 1000 STT", async () => {
  const res = await fetch(`${baseUrl}/balance/${ethers.computeAddress(PRIVATE_KEY)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.balance, "1000.0");
});

test("POST /mint credits the recipient and returns a tx hash", async () => {
  const res = await fetch(`${baseUrl}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: ALICE, amount: 50 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.message, "Tokens minted successfully");
  assert.match(body.transactionHash, /^0x[0-9a-fA-F]{64}$/);

  const bal = await (await fetch(`${baseUrl}/balance/${ALICE}`)).json();
  assert.equal(bal.balance, "50.0");
});

test("POST /burn destroys tokens from the server wallet", async () => {
  const res = await fetch(`${baseUrl}/burn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 20 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.message, "Tokens burned successfully");
  assert.match(body.transactionHash, /^0x[0-9a-fA-F]{64}$/);

  const bal = await (
    await fetch(`${baseUrl}/balance/${ethers.computeAddress(PRIVATE_KEY)}`)
  ).json();
  assert.equal(bal.balance, "980.0");
});

test("POST /mint rejects an invalid address with 400", async () => {
  const res = await fetch(`${baseUrl}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: "0xnope", amount: 5 }),
  });
  assert.equal(res.status, 400);
});

test("POST /mint rejects a non-positive amount with 400", async () => {
  const res = await fetch(`${baseUrl}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: ALICE, amount: -5 }),
  });
  assert.equal(res.status, 400);
});

test("GET /balance rejects an invalid address with 400", async () => {
  const res = await fetch(`${baseUrl}/balance/0x123`);
  assert.equal(res.status, 400);
});
