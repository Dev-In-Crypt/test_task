import "dotenv/config";
import { createApp } from "./app.js";
import { createBlockchain } from "./blockchain.js";

const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, PORT = 3000 } = process.env;

const { contract, wallet } = createBlockchain({
  rpcUrl: RPC_URL,
  privateKey: PRIVATE_KEY,
  contractAddress: CONTRACT_ADDRESS,
});

const app = createApp({ contract });

app.listen(PORT, () => {
  console.log(`TestToken backend listening on http://localhost:${PORT}`);
  console.log(`Server wallet:   ${wallet.address}`);
  console.log(`Contract:        ${CONTRACT_ADDRESS}`);
});
