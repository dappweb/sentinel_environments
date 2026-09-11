// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPolicy} from "../src/AgentPolicy.sol";

interface Vm {
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
}

contract AgentPolicyTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant OWNER = address(0x1001);
    address private constant GUARDIAN = address(0x1002);
    address private constant EXECUTOR = address(0x1003);
    address private constant SESSION = address(0x1004);
    address private constant ROUTER = address(0x1005);
    address private constant ASSET = address(0x1006);
    bytes4 private constant SELECTOR = 0x12345678;

    AgentPolicy private policy;

    function setUp() public {
        policy = new AgentPolicy(OWNER, GUARDIAN);
        vm.prank(OWNER);
        policy.setExecutor(EXECUTOR);
        vm.prank(OWNER);
        policy.createSession(SESSION, 0, uint48(block.timestamp + 2 days), 1 ether, 2 ether);
        vm.prank(OWNER);
        policy.setTargetPermission(SESSION, ROUTER, true);
        vm.prank(OWNER);
        policy.setSelectorPermission(SESSION, SELECTOR, true);
        vm.prank(OWNER);
        policy.setAssetLimit(SESSION, ASSET, 100, 200);
    }

    function testValidateAllowsConfiguredCall() public view {
        bool allowed = policy.validateCall(SESSION, ROUTER, 0.5 ether, SELECTOR, ASSET, 50);
        assertTrue(allowed);
    }

    function testConsumeEnforcesDailyAssetLimit() public {
        vm.prank(EXECUTOR);
        policy.consumeCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 100);
        vm.prank(EXECUTOR);
        policy.consumeCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 100);

        vm.expectRevert();
        vm.prank(EXECUTOR);
        policy.consumeCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 1);
    }

    function testDailyLimitResetsOnNextDay() public {
        vm.prank(EXECUTOR);
        policy.consumeCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 100);
        vm.warp(block.timestamp + 1 days);
        vm.prank(EXECUTOR);
        policy.consumeCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 100);
        assertEq(policy.assetSpentToday(SESSION, ASSET), 100);
    }

    function testGuardianCanPauseAndOwnerCanUnpause() public {
        vm.prank(GUARDIAN);
        policy.pause();
        vm.expectRevert();
        policy.validateCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 1);

        vm.prank(OWNER);
        policy.unpause();
        assertTrue(policy.validateCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 1));
    }

    function testOwnerOrGuardianCanRevokeButExecutorCannot() public {
        vm.expectRevert();
        vm.prank(EXECUTOR);
        policy.revokeSession(SESSION);

        vm.prank(GUARDIAN);
        policy.revokeSession(SESSION);
        vm.expectRevert();
        policy.validateCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 1);
    }

    function testRejectsUnlistedTargetAndSelector() public {
        vm.expectRevert();
        policy.validateCall(SESSION, address(0x9999), 0, SELECTOR, ASSET, 1);
        vm.expectRevert();
        policy.validateCall(SESSION, ROUTER, 0, 0x87654321, ASSET, 1);
    }

    function testSessionExpires() public {
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert();
        policy.validateCall(SESSION, ROUTER, 0, SELECTOR, ASSET, 1);
    }

    function assertTrue(bool value) private pure {
        require(value, "assertTrue failed");
    }

    function assertEq(uint256 left, uint256 right) private pure {
        require(left == right, "assertEq failed");
    }
}
