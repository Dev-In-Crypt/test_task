# TestToken (STT) — Smart Contract + Backend

Solution for the skill test: an ERC‑20 token with owner‑gated minting and
holder burning, plus a Node.js/Express backend that exposes REST endpoints to
interact with it.

## Live deployment (Sepolia)

| Item | Value |
|------|-------|
| Contract | [`0x6b36324F718bBC185B21705BE448F4d4cf660d7E`](https://sepolia.etherscan.io/address/0x6b36324F718bBC185B21705BE448F4d4cf660d7E) (source [verified ✓](https://sepolia.etherscan.io/address/0x6b36324F718bBC185B21705BE448F4d4cf660d7E#code)) |
| Owner / deployer | `0xAB013Ad06d9E4c192b8435761a64081F1Eb09892` |
| Deploy tx | [`0x14e5590d…cb3a4`](https://sepolia.etherscan.io/tx/0x14e5590dd3b3db22ae4ebf9d279f35a1c0cf6253a8fc0e37f5a2c2d68d2cb3a4) |
| `mint` 50 STT (via API) | [`0xea973812…50bb`](https://sepolia.etherscan.io/tx/0xea973812c209f20e7cef5eb87a793eddeae363630e230cb63ad8f644030450bb) |
| `burn` 20 STT (via API) | [`0xfc5232af…07d5a`](https://sepolia.etherscan.io/tx/0xfc5232af251e527d4e337559530d31459fafafc2c96d14140a4015e165407d5a) |

The `mint` and `burn` transactions above were produced by calling the backend's
REST endpoints against the live Sepolia contract.

```
.
├── contracts/        # Foundry project — Solidity contract, tests, deploy script
│   ├── src/TestToken.sol
│   ├── test/TestToken.t.sol
│   └── script/Deploy.s.sol
└── backend/          # Express + ethers.js v6 REST API
    ├── src/
    └── test/api.test.js
```

## Stack

| Layer     | Choice                                                   |
|-----------|----------------------------------------------------------|
| Contract  | Solidity `^0.8.20`, OpenZeppelin v5 (`ERC20`, `ERC20Burnable`, `Ownable`) |
| Tooling   | Foundry (forge) for build / test / deploy                |
| Backend   | Node.js, Express.js, ethers.js v6                        |
| Testnet   | Sepolia (Goerli is deprecated and no longer usable)      |

---

## Part 1 — Smart Contract

[`contracts/src/TestToken.sol`](contracts/src/TestToken.sol)

- **Name** `TestToken`, **symbol** `STT`, **decimals** `18`.
- **Initial supply**: `1000` STT minted to the deployer in the constructor.
- `mint(address to, uint256 amount)` — `onlyOwner` (OpenZeppelin `Ownable`).
- `burn(uint256 amount)` — inherited from `ERC20Burnable`; burns from the
  caller's own balance.
- `balanceOf(address)` — inherited from `ERC20`.

> **On the `^0.8.0` requirement:** OpenZeppelin v5 pins `^0.8.20`, so the
> compiler must be `>= 0.8.20`. The pragma `^0.8.20` satisfies the spec's
> `^0.8.0` constraint while remaining compatible with the library.

### Build & test

```bash
cd contracts
forge install              # first time only (forge-std + openzeppelin-contracts)
forge build
forge test -vv
```

9 tests cover metadata, initial supply, owner‑only mint, holder burn, revert
paths, and a fuzz test for mint→burn.

### Deploy to Sepolia

Set the environment (e.g. in `contracts/.env`, loaded by `--env-file` or your shell):

```bash
export PRIVATE_KEY=0x...            # deployer; becomes owner + holds 1000 STT
export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
export ETHERSCAN_API_KEY=...        # optional, for --verify
```

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url sepolia --broadcast --verify -vvvv
```

The script logs the deployed address — copy it into the backend config below.

---

## Part 2 — Backend API

[`backend/`](backend) — Express server using ethers.js v6.

### Configure

```bash
cd backend
npm install
cp .env.example .env       # then fill in the values
```

`.env`:

| Var                | Meaning                                                       |
|--------------------|---------------------------------------------------------------|
| `RPC_URL`          | RPC endpoint of the network the contract lives on             |
| `PRIVATE_KEY`      | Account that signs `mint`/`burn` txs (must be owner for mint) |
| `CONTRACT_ADDRESS` | Deployed `TestToken` address                                  |
| `PORT`             | HTTP port (default `3000`)                                     |

### Run

```bash
npm start          # or: npm run dev  (auto-reload)
```

### Endpoints

| Method | Path                | Body                      | Success response |
|--------|---------------------|---------------------------|------------------|
| POST   | `/mint`             | `{ "to": "0x..", "amount": 50 }` | `{ "message": "Tokens minted successfully", "transactionHash": "0x.." }` |
| POST   | `/burn`             | `{ "amount": 20 }`        | `{ "message": "Tokens burned successfully", "transactionHash": "0x.." }` |
| GET    | `/balance/:address` | —                         | `{ "balance": "100.0" }` |
| GET    | `/health`           | —                         | `{ "status": "ok" }` |

Examples:

```bash
curl -X POST localhost:3000/mint \
  -H "Content-Type: application/json" \
  -d '{"to":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","amount":50}'

curl -X POST localhost:3000/burn \
  -H "Content-Type: application/json" \
  -d '{"amount":20}'

curl localhost:3000/balance/0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### Design notes

- **Human‑readable amounts.** The API accepts whole‑token amounts (`50`) and
  converts to/from the 18‑decimal raw units with `parseUnits` / `formatUnits`.
  Balances are returned as decimal **strings** to avoid JS float precision loss
  on large numbers.
- **Who burns?** `/burn` burns from the **server wallet** (`PRIVATE_KEY`), since
  the backend is the only signer. `/mint` requires that same wallet to be the
  contract owner.
- **Nonce safety.** The signer is wrapped in ethers' `NonceManager`, so a
  `/mint` immediately followed by a `/burn` each get a fresh nonce instead of
  racing on the network's pending count.
- **Validation & errors.** Addresses are checked with `ethers.isAddress`,
  amounts must be positive numbers; bad input returns `400`, on‑chain/RPC
  failures return `500` with the revert reason when available.

### Backend tests

[`backend/test/api.test.js`](backend/test/api.test.js) is a self‑contained
integration test (Node's built‑in test runner): it spins up a local **Anvil**
node, deploys `TestToken` from the compiled artifact, boots the Express app and
exercises every endpoint over HTTP.

Prerequisites: `anvil` on `PATH` and the contract compiled.

```bash
cd contracts && forge build      # produces the artifact the test deploys
cd ../backend  && npm test
```
