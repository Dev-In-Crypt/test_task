// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TestToken (STT)
/// @notice ERC20 token with owner-only minting and holder burning.
/// @dev ERC20Burnable gives us burn(), Ownable gates mint(), balanceOf comes
///      from ERC20. 1000 STT is minted to the deployer on construction.
contract TestToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1000;

    constructor() ERC20("TestToken", "STT") Ownable(msg.sender) {
        // INITIAL_SUPPLY is in whole tokens, scale it by 10**18
        _mint(msg.sender, INITIAL_SUPPLY * 10 ** decimals());
    }

    /// @notice Mint tokens to an address. `amount` is in the smallest unit.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // burn(uint256) and balanceOf(address) are inherited (ERC20Burnable / ERC20)
}
