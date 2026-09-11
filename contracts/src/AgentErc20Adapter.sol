// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPolicy} from "./AgentPolicy.sol";

/// @notice The only ERC-20 methods exposed by the adapter.
interface IERC20Agent {
    function transfer(address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Account-module boundary owned by the user's smart account.
/// @dev The account must authorize this adapter as a module and return the
/// target call's raw success flag and return data. The adapter never holds
/// tokens and never calls an arbitrary target supplied by an agent.
interface IAgentExecutionAccount {
    function executeFromModule(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bool success, bytes memory result);
}

/// @title AgentErc20Adapter
/// @notice A narrow, policy-gated ERC-20 transfer/approval adapter.
/// @dev The calling smart account must be bound to the session key and must
/// call this adapter as an authorized account module. AgentPolicy must point
/// its executor at this adapter. No swap, bridge, permit, arbitrary calldata,
/// or custody path is exposed here.
contract AgentErc20Adapter {
    error ZeroAddress();
    error ZeroAmount();
    error NotPolicyOwner();
    error CallerNotAccount();
    error AccountNotBound();
    error AccountExecutionFailed();
    error TokenCallFailed();
    error ReentrantCall();

    AgentPolicy public immutable policy;

    mapping(address sessionKey => mapping(address account => bool))
        public accountAllowed;

    bool private entered;

    event AccountPermissionUpdated(
        address indexed sessionKey,
        address indexed account,
        bool allowed
    );
    event Erc20CallForwarded(
        address indexed sessionKey,
        address indexed account,
        address indexed token,
        address recipient,
        uint256 amount,
        bytes4 selector
    );

    modifier onlyPolicyOwner() {
        if (msg.sender != policy.owner()) revert NotPolicyOwner();
        _;
    }

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    constructor(AgentPolicy policy_) {
        if (address(policy_) == address(0)) revert ZeroAddress();
        policy = policy_;
    }

    /// @notice Bind one user's smart account to one agent session.
    /// @dev The policy owner is the source of authority; there is no second
    /// admin that could silently diverge from AgentPolicy ownership.
    function setAccountPermission(
        address sessionKey,
        address account,
        bool allowed
    ) external onlyPolicyOwner {
        if (sessionKey == address(0) || account == address(0)) {
            revert ZeroAddress();
        }
        accountAllowed[sessionKey][account] = allowed;
        emit AccountPermissionUpdated(sessionKey, account, allowed);
    }

    /// @notice Forward a bounded ERC-20 transfer through the user's account.
    function transfer(
        address sessionKey,
        address account,
        address token,
        address recipient,
        uint256 amount
    ) external nonReentrant returns (bytes memory result) {
        _validateBinding(sessionKey, account, token, recipient, amount);
        policy.consumeCall(
            sessionKey,
            token,
            0,
            IERC20Agent.transfer.selector,
            token,
            amount
        );

        result = _execute(
            account,
            token,
            abi.encodeCall(IERC20Agent.transfer, (recipient, amount))
        );
        emit Erc20CallForwarded(
            sessionKey,
            account,
            token,
            recipient,
            amount,
            IERC20Agent.transfer.selector
        );
    }

    /// @notice Forward a bounded ERC-20 approval through the user's account.
    /// @dev Approval amount is charged against the same per-call and daily
    /// asset budget. Callers cannot request an unbounded max uint approval
    /// unless governance explicitly configures that policy limit.
    function approve(
        address sessionKey,
        address account,
        address token,
        address spender,
        uint256 amount
    ) external nonReentrant returns (bytes memory result) {
        _validateBinding(sessionKey, account, token, spender, amount);
        policy.consumeCall(
            sessionKey,
            token,
            0,
            IERC20Agent.approve.selector,
            token,
            amount
        );

        result = _execute(
            account,
            token,
            abi.encodeCall(IERC20Agent.approve, (spender, amount))
        );
        emit Erc20CallForwarded(
            sessionKey,
            account,
            token,
            spender,
            amount,
            IERC20Agent.approve.selector
        );
    }

    function _validateBinding(
        address sessionKey,
        address account,
        address token,
        address recipientOrSpender,
        uint256 amount
    ) internal view {
        if (
            sessionKey == address(0) ||
            account == address(0) ||
            token == address(0) ||
            recipientOrSpender == address(0)
        ) {
            revert ZeroAddress();
        }
        if (msg.sender != account) revert CallerNotAccount();
        if (!accountAllowed[sessionKey][account]) revert AccountNotBound();
        if (amount == 0) revert ZeroAmount();
    }

    function _execute(
        address account,
        address token,
        bytes memory data
    ) internal returns (bytes memory result) {
        (bool success, bytes memory returned) = IAgentExecutionAccount(account)
            .executeFromModule(token, 0, data);
        if (!success) revert AccountExecutionFailed();

        // Accept standard ERC-20 return data and no-return legacy tokens, but
        // fail closed when a token explicitly returns false.
        if (returned.length > 0 && !abi.decode(returned, (bool))) {
            revert TokenCallFailed();
        }
        return returned;
    }
}
