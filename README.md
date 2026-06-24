# TestToken (STT)

ERC-20 token with owner-only minting and self-burn, plus an Express/ethers.js
backend exposing REST endpoints to mint, burn and read balances.

## Deployed on Sepolia

| | |
|---|---|
| Contract | [`0x6b36324F718bBC185B21705BE448F4d4cf660d7E`](https://sepolia.etherscan.io/address/0x6b36324F718bBC185B21705BE448F4d4cf660d7E) (verified) |
| Owner / deployer | `0xAB013Ad06d9E4c192b8435761a64081F1Eb09892` |
| Deploy tx | [`0x14e5590d...cb3a4`](https://sepolia.etherscan.io/tx/0x14e5590dd3b3db22ae4ebf9d279f35a1c0cf6253a8fc0e37f5a2c2d68d2cb3a4) |
| mint 50 STT via API | [`0xea973812...50bb`](https://sepolia.etherscan.io/tx/0xea973812c209f20e7cef5eb87a793eddeae363630e230cb63ad8f644030450bb) |
| burn 20 STT via API | [`0xfc5232af...07d5a`](https://sepolia.etherscan.io/tx/0xfc5232af251e527d4e337559530d31459fafafc2c96d14140a4015e165407d5a) |

The mint/burn txs above were sent by hitting the backend endpoints against the
live contract.

## Layout

```
contracts/   Foundry project (contract, tests, deploy script)
backend/     Express + ethers.js v6 API
```

Stack: Solidity 0.8.x + OpenZeppelin v5, Foundry, Node/Express, ethers v6,
deployed to Sepolia.

## Part 1: contract

See [contracts/src/TestToken.sol](contracts/src/TestToken.sol).

* name `TestToken`, symbol `STT`, 18 decimals
* 1000 STT minted to the deployer in the constructor
* `mint(to, amount)` is `onlyOwner` (OZ `Ownable`)
* `burn(amount)` comes from `ERC20Burnable` (burns the caller's own balance)
* `balanceOf` comes from `ERC20`

A note on the `^0.8.0` requirement: OpenZeppelin v5 needs `>=0.8.20`, so I used
`^0.8.20`, which still satisfies `^0.8.0`.

Build and test:

```bash
cd contracts
forge install        # first time: pulls forge-std + openzeppelin-contracts
forge test -vv
```

9 tests: metadata, initial supply, owner-only mint, burn, the revert paths, and
a mint/burn fuzz test.

Deploy to Sepolia (put the values in `contracts/.env` or export them):

```bash
export PRIVATE_KEY=0x...
export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
export ETHERSCAN_API_KEY=...   # only if you want --verify

forge script script/Deploy.s.sol:Deploy --rpc-url sepolia --broadcast --verify -vvvv
```

The script prints the deployed address.

## Part 2: backend

```bash
cd backend
npm install
cp .env.example .env   # fill it in
npm start
```

`.env` keys: `RPC_URL`, `PRIVATE_KEY` (must be the owner for mint to work),
`CONTRACT_ADDRESS`, `PORT` (default 3000).

Endpoints:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/mint` | `{ "to": "0x..", "amount": 50 }` | `{ "message": "Tokens minted successfully", "transactionHash": "0x.." }` |
| POST | `/burn` | `{ "amount": 20 }` | `{ "message": "Tokens burned successfully", "transactionHash": "0x.." }` |
| GET | `/balance/:address` | | `{ "balance": "100.0" }` |
| GET | `/health` | | `{ "status": "ok" }` |

```bash
curl -X POST localhost:3000/mint -H "Content-Type: application/json" \
  -d '{"to":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","amount":50}'

curl -X POST localhost:3000/burn -H "Content-Type: application/json" \
  -d '{"amount":20}'

curl localhost:3000/balance/0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

A few decisions worth calling out:

* The API takes whole-token amounts (`50`) and does the `parseUnits` /
  `formatUnits` conversion for 18 decimals internally. Balances go back as
  strings so big numbers don't lose precision in JS.
* `/burn` burns from the server wallet (the only key the backend has). `/mint`
  needs that same wallet to be the contract owner.
* The signer is wrapped in `NonceManager` so a mint followed immediately by a
  burn don't collide on the same nonce.
* Input is validated (`ethers.isAddress`, positive amounts) -> bad requests get
  400, on-chain failures get 500 with the revert reason when there is one.

### Tests

[backend/test/api.test.js](backend/test/api.test.js) spins up a local Anvil
node, deploys the contract from the build artifact, starts the app and calls
every endpoint over HTTP. Needs `anvil` on PATH and the contract built first:

```bash
cd contracts && forge build
cd ../backend && npm test
```
