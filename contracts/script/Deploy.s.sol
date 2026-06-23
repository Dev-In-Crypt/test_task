// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";

/// @notice Deploys TestToken. The broadcasting account becomes owner and
///         receives the 1000 STT initial supply.
/// @dev Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url sepolia --broadcast --verify -vvvv
contract Deploy is Script {
    function run() external returns (TestToken token) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        token = new TestToken();
        vm.stopBroadcast();

        console.log("TestToken deployed at:", address(token));
        console.log("Owner / deployer:", token.owner());
        console.log("Deployer balance (raw):", token.balanceOf(token.owner()));
    }
}
