// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentErc20Adapter} from "../src/AgentErc20Adapter.sol";
import {AgentPolicy} from "../src/AgentPolicy.sol";

interface Vm {
    function prank(address sender) external;
    function expectRevert() external;
}

contract MockAgentToken {
    mapping(address account => uint256) public balanceOf;
    mapping(address account => mapping(address spender => uint256))
        public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract MockAgentAccount {
    bool public shouldFail;
    address public module;

    function setModule(address module_) external {
        module = module_;
    }

    function setShouldFail(bool shouldFail_) external {
        shouldFail = shouldFail_;
    }

    function executeFromModule(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bool success, bytes memory result) {
        require(msg.sender == module, "module not authorized");
        if (shouldFail) return (false, bytes("mock failure"));
        return target.call{value: value}(data);
    }
}

contract AgentErc20AdapterTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant OWNER = address(0x2001);
    address private constant GUARDIAN = address(0x2002);
    address private constant SESSION = address(0x2003);
    address private constant RECIPIENT = address(0x2004);
    address private constant SPENDER = address(0x2005);

    AgentPolicy private policy;
    AgentErc20Adapter private adapter;
    MockAgentToken private token;
    MockAgentAccount private account;

    function setUp() public {
        policy = new AgentPolicy(OWNER, GUARDIAN);
        adapter = new AgentErc20Adapter(policy);
        token = new MockAgentToken();
        account = new MockAgentAccount();

        account.setModule(address(adapter));

        vm.prank(OWNER);
        policy.setExecutor(address(adapter));
        vm.prank(OWNER);
        policy.createSession(
            SESSION,
            0,
            uint48(block.timestamp + 2 days),
            0,
            200
        );
        vm.prank(OWNER);
        policy.setTargetPermission(SESSION, address(token), true);
        vm.prank(OWNER);
        policy.setSelectorPermission(
            SESSION,
            bytes4(keccak256("transfer(address,uint256)")),
            true
        );
        vm.prank(OWNER);
        policy.setSelectorPermission(
            SESSION,
            bytes4(keccak256("approve(address,uint256)")),
            true
        );
        vm.prank(OWNER);
        policy.setAssetLimit(SESSION, address(token), 100, 200);
        vm.prank(OWNER);
        adapter.setAccountPermission(SESSION, address(account), true);

        token.mint(address(account), 1_000);
    }

    function testTransferUsesAccountBalanceAndConsumesPolicyBudget() public {
        vm.prank(address(account));
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 100);

        assertEq(token.balanceOf(address(account)), 900);
        assertEq(token.balanceOf(RECIPIENT), 100);
        assertEq(token.balanceOf(address(adapter)), 0);
        assertEq(policy.assetSpentToday(SESSION, address(token)), 100);
    }

    function testApproveIsExplicitlyConstructedAndBounded() public {
        vm.prank(address(account));
        adapter.approve(SESSION, address(account), address(token), SPENDER, 80);

        assertEq(token.allowance(address(account), SPENDER), 80);
        assertEq(policy.assetSpentToday(SESSION, address(token)), 80);
        assertEq(token.balanceOf(address(adapter)), 0);
    }

    function testRejectsUnboundOrNonAccountCaller() public {
        vm.expectRevert();
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 1);

        vm.prank(address(0x2006));
        vm.expectRevert();
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 1);
    }

    function testPolicyAssetLimitStopsSecondTransfer() public {
        vm.prank(address(account));
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 100);

        vm.prank(address(account));
        vm.expectRevert();
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 101);
    }

    function testAccountExecutionFailureDoesNotConsumeBudget() public {
        account.setShouldFail(true);

        vm.prank(address(account));
        vm.expectRevert();
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 50);

        assertEq(policy.assetSpentToday(SESSION, address(token)), 0);
    }

    function testFalseTokenReturnFailsClosed() public {
        account.setShouldFail(false);

        vm.prank(address(account));
        vm.expectRevert();
        adapter.transfer(SESSION, address(account), address(token), RECIPIENT, 2_000);

        assertEq(policy.assetSpentToday(SESSION, address(token)), 0);
        assertEq(token.balanceOf(RECIPIENT), 0);
    }

    function assertEq(uint256 left, uint256 right) private pure {
        require(left == right, "assertEq failed");
    }
}
