// just the functions the backend calls, so we don't have to pull in the
// full build artifact
export const TEST_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
];
