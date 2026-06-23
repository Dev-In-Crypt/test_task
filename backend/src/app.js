import express from "express";
import { ethers } from "ethers";
import { getDecimals } from "./blockchain.js";

/**
 * Validate that `value` is a positive, finite amount and return it as a
 * string suitable for ethers.parseUnits. Throws a 400-tagged error otherwise.
 */
function parseAmount(value) {
  if (value === undefined || value === null || value === "") {
    throw httpError(400, "`amount` is required");
  }
  const str = String(value).trim();
  // Reject things parseUnits would choke on or that are non-positive.
  if (!/^\d+(\.\d+)?$/.test(str) || Number(str) <= 0) {
    throw httpError(400, "`amount` must be a positive number");
  }
  return str;
}

function requireAddress(value, field) {
  if (!value || !ethers.isAddress(value)) {
    throw httpError(400, `\`${field}\` must be a valid Ethereum address`);
  }
  return ethers.getAddress(value); // checksummed
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Wrap an async route so thrown errors hit the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ contract }) {
  const app = express();
  app.use(express.json());

  // Health check — handy for the reviewer / uptime probes.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // POST /mint  { to, amount }  -> owner mints `amount` STT to `to`
  app.post(
    "/mint",
    asyncHandler(async (req, res) => {
      const to = requireAddress(req.body?.to, "to");
      const amount = parseAmount(req.body?.amount);
      const decimals = await getDecimals(contract);

      const tx = await contract.mint(to, ethers.parseUnits(amount, decimals));
      await tx.wait();

      res.json({
        message: "Tokens minted successfully",
        transactionHash: tx.hash,
      });
    })
  );

  // POST /burn  { amount }  -> burns `amount` STT from the server wallet
  app.post(
    "/burn",
    asyncHandler(async (req, res) => {
      const amount = parseAmount(req.body?.amount);
      const decimals = await getDecimals(contract);

      const tx = await contract.burn(ethers.parseUnits(amount, decimals));
      await tx.wait();

      res.json({
        message: "Tokens burned successfully",
        transactionHash: tx.hash,
      });
    })
  );

  // GET /balance/:address  -> human-readable balance of `address`
  app.get(
    "/balance/:address",
    asyncHandler(async (req, res) => {
      const address = requireAddress(req.params.address, "address");
      const decimals = await getDecimals(contract);

      const raw = await contract.balanceOf(address);
      res.json({ balance: ethers.formatUnits(raw, decimals) });
    })
  );

  // 404 for anything else.
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // Centralised error handling: validation errors -> 400, on-chain / RPC
  // failures -> 500 with the revert reason when available.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    const message =
      status === 500
        ? err.shortMessage || err.reason || err.message || "Internal error"
        : err.message;
    res.status(status).json({ error: message });
  });

  return app;
}
