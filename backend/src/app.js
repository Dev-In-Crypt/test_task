import express from "express";
import { ethers } from "ethers";
import { getDecimals } from "./blockchain.js";

// returns the amount as a string for parseUnits, or throws a 400 if it's not
// a positive number
function parseAmount(value) {
  if (value === undefined || value === null || value === "") {
    throw httpError(400, "`amount` is required");
  }
  const str = String(value).trim();
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

// so async route errors end up in the error middleware instead of hanging
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ contract }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // mint `amount` STT to `to` (owner only)
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

  // burn `amount` STT from the server wallet
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

  // balance of `address`, formatted to whole tokens
  app.get(
    "/balance/:address",
    asyncHandler(async (req, res) => {
      const address = requireAddress(req.params.address, "address");
      const decimals = await getDecimals(contract);

      const raw = await contract.balanceOf(address);
      res.json({ balance: ethers.formatUnits(raw, decimals) });
    })
  );

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // validation errors carry a status (400); everything else is treated as a
  // 500, using the revert reason if ethers gave us one
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
