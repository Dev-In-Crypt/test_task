// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/TestToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract TestTokenTest is Test {
    TestToken internal token;

    address internal owner = address(this); // deployer == owner
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE = 1e18;

    function setUp() public {
        token = new TestToken();
    }

    /* ----------------------------- Metadata ----------------------------- */

    function test_Metadata() public view {
        assertEq(token.name(), "TestToken");
        assertEq(token.symbol(), "STT");
        assertEq(token.decimals(), 18);
    }

    function test_InitialSupplyMintedToDeployer() public view {
        assertEq(token.totalSupply(), 1000 * ONE);
        assertEq(token.balanceOf(owner), 1000 * ONE);
    }

    function test_OwnerIsDeployer() public view {
        assertEq(token.owner(), owner);
    }

    /* ------------------------------- Mint -------------------------------- */

    function test_OwnerCanMint() public {
        token.mint(alice, 50 * ONE);
        assertEq(token.balanceOf(alice), 50 * ONE);
        assertEq(token.totalSupply(), 1050 * ONE);
    }

    function test_NonOwnerCannotMint() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        token.mint(alice, 50 * ONE);
    }

    /* ------------------------------- Burn -------------------------------- */

    function test_HolderCanBurnOwnTokens() public {
        token.mint(alice, 50 * ONE);

        vm.prank(alice);
        token.burn(20 * ONE);

        assertEq(token.balanceOf(alice), 30 * ONE);
        assertEq(token.totalSupply(), 1030 * ONE);
    }

    function test_BurnRevertsWhenAmountExceedsBalance() public {
        token.mint(alice, 10 * ONE);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 10 * ONE, 20 * ONE
            )
        );
        token.burn(20 * ONE);
    }

    /* ----------------------------- balanceOf ----------------------------- */

    function test_BalanceOfReflectsTransfers() public {
        token.transfer(bob, 5 * ONE);
        assertEq(token.balanceOf(bob), 5 * ONE);
        assertEq(token.balanceOf(owner), 995 * ONE);
    }

    /* ------------------------------- Fuzz -------------------------------- */

    function testFuzz_MintThenBurn(uint96 mintAmount, uint96 burnAmount) public {
        vm.assume(burnAmount <= mintAmount);

        token.mint(alice, mintAmount);
        assertEq(token.balanceOf(alice), mintAmount);

        vm.prank(alice);
        token.burn(burnAmount);
        assertEq(token.balanceOf(alice), uint256(mintAmount) - burnAmount);
    }
}
