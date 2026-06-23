// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TestToken (STT)
/// @notice Simple ERC20 token used for the skill test.
/// @dev Built on OpenZeppelin v5:
///      - ERC20          -> standard token logic + `balanceOf`
///      - ERC20Burnable  -> `burn(uint256)` from caller's own balance
///      - Ownable        -> owner-gated `mint`
///      The initial supply (1000 STT) is minted to the deployer.
contract TestToken is ERC20, ERC20Burnable, Ownable {
    /// @notice Initial supply minted to the deployer, expressed in whole tokens.
    uint256 public constant INITIAL_SUPPLY = 1000;

    constructor() ERC20("TestToken", "STT") Ownable(msg.sender) {
        // decimals() defaults to 18, so multiply by 10**18 to get the raw amount.
        _mint(msg.sender, INITIAL_SUPPLY * 10 ** decimals());
    }

    /// @notice Mint `amount` (raw, 18-decimals) tokens to `to`. Owner only.
    /// @param to     Recipient address.
    /// @param amount Amount in the token's smallest unit (wei-equivalent).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // `burn(uint256 amount)` is inherited from ERC20Burnable and lets any
    // holder destroy tokens from their own balance.
    //
    // `balanceOf(address account)` is inherited from ERC20.
}
