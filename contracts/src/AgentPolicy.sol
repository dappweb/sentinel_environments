// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentPolicy
/// @notice Owner-controlled, non-upgradeable policy boundary for a session key.
/// @dev This contract is designed to be called by a user's ERC-4337 smart
/// account or policy module. It does not custody assets and cannot execute an
/// external call by itself. The integrating smart account must call
/// consumeCall before dispatching the checked call.
contract AgentPolicy {
    error NotOwner();
    error NotGuardian();
    error NotExecutor();
    error ZeroAddress();
    error InvalidSessionWindow();
    error SessionDisabled();
    error SessionNotActive();
    error PolicyIsPaused();
    error TargetNotAllowed();
    error SelectorNotAllowed();
    error NativeValueTooHigh();
    error NativeDailyLimitExceeded();
    error AssetNotAllowed();
    error AssetAmountTooHigh();
    error AssetDailyLimitExceeded();
    error NoPendingOwner();

    struct Session {
        uint48 validAfter;
        uint48 validUntil;
        uint128 maxNativeValuePerCall;
        uint128 maxNativeValuePerDay;
        bool enabled;
    }

    struct AssetLimit {
        uint128 maxPerCall;
        uint128 maxPerDay;
    }

    address public owner;
    address public pendingOwner;
    address public guardian;
    address public executor;
    bool public paused;

    mapping(address sessionKey => Session session) public sessions;
    mapping(address sessionKey => mapping(address target => bool)) public targetAllowed;
    mapping(address sessionKey => mapping(bytes4 selector => bool)) public selectorAllowed;
    mapping(address sessionKey => mapping(address asset => AssetLimit limit)) public assetLimits;

    mapping(address sessionKey => uint48 day) public nativeSpendDay;
    mapping(address sessionKey => uint128 amount) public nativeSpentToday;
    mapping(address sessionKey => mapping(address asset => uint48 day)) public assetSpendDay;
    mapping(address sessionKey => mapping(address asset => uint128 amount)) public assetSpentToday;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event GuardianUpdated(address indexed previousGuardian, address indexed newGuardian);
    event ExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event SessionCreated(
        address indexed sessionKey,
        uint48 validAfter,
        uint48 validUntil,
        uint128 maxNativeValuePerCall,
        uint128 maxNativeValuePerDay
    );
    event SessionRevoked(address indexed sessionKey);
    event TargetPermissionUpdated(address indexed sessionKey, address indexed target, bool allowed);
    event SelectorPermissionUpdated(address indexed sessionKey, bytes4 indexed selector, bool allowed);
    event AssetLimitUpdated(
        address indexed sessionKey,
        address indexed asset,
        uint128 maxPerCall,
        uint128 maxPerDay
    );
    event PolicyPaused(address indexed by);
    event PolicyUnpaused(address indexed by);
    event CallConsumed(
        address indexed sessionKey,
        address indexed target,
        address indexed asset,
        uint256 nativeValue,
        uint256 assetAmount,
        bytes4 selector
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyGuardianOrOwner() {
        if (msg.sender != owner && msg.sender != guardian) revert NotGuardian();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != executor || executor == address(0)) revert NotExecutor();
        _;
    }

    constructor(address owner_, address guardian_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        guardian = guardian_;
        emit OwnershipTransferred(address(0), owner_);
        emit GuardianUpdated(address(0), guardian_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner || pendingOwner == address(0)) revert NoPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setGuardian(address newGuardian) external onlyOwner {
        address previousGuardian = guardian;
        guardian = newGuardian;
        emit GuardianUpdated(previousGuardian, newGuardian);
    }

    function setExecutor(address newExecutor) external onlyOwner {
        address previousExecutor = executor;
        executor = newExecutor;
        emit ExecutorUpdated(previousExecutor, newExecutor);
    }

    function pause() external onlyGuardianOrOwner {
        paused = true;
        emit PolicyPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit PolicyUnpaused(msg.sender);
    }

    function createSession(
        address sessionKey,
        uint48 validAfter,
        uint48 validUntil,
        uint128 maxNativeValuePerCall,
        uint128 maxNativeValuePerDay
    ) external onlyOwner {
        if (sessionKey == address(0)) revert ZeroAddress();
        if (validUntil <= validAfter || validUntil <= block.timestamp) {
            revert InvalidSessionWindow();
        }
        if (maxNativeValuePerDay < maxNativeValuePerCall) {
            revert InvalidSessionWindow();
        }
        sessions[sessionKey] = Session({
            validAfter: validAfter,
            validUntil: validUntil,
            maxNativeValuePerCall: maxNativeValuePerCall,
            maxNativeValuePerDay: maxNativeValuePerDay,
            enabled: true
        });
        emit SessionCreated(
            sessionKey,
            validAfter,
            validUntil,
            maxNativeValuePerCall,
            maxNativeValuePerDay
        );
    }

    function revokeSession(address sessionKey) external onlyGuardianOrOwner {
        sessions[sessionKey].enabled = false;
        emit SessionRevoked(sessionKey);
    }

    function setTargetPermission(address sessionKey, address target, bool allowed) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        targetAllowed[sessionKey][target] = allowed;
        emit TargetPermissionUpdated(sessionKey, target, allowed);
    }

    function setSelectorPermission(address sessionKey, bytes4 selector, bool allowed) external onlyOwner {
        selectorAllowed[sessionKey][selector] = allowed;
        emit SelectorPermissionUpdated(sessionKey, selector, allowed);
    }

    function setAssetLimit(
        address sessionKey,
        address asset,
        uint128 maxPerCall,
        uint128 maxPerDay
    ) external onlyOwner {
        if (asset == address(0)) revert ZeroAddress();
        if (maxPerDay < maxPerCall) revert InvalidSessionWindow();
        assetLimits[sessionKey][asset] = AssetLimit({
            maxPerCall: maxPerCall,
            maxPerDay: maxPerDay
        });
        emit AssetLimitUpdated(sessionKey, asset, maxPerCall, maxPerDay);
    }

    function validateCall(
        address sessionKey,
        address target,
        uint256 nativeValue,
        bytes4 selector,
        address asset,
        uint256 assetAmount
    ) external view returns (bool) {
        _validateCall(sessionKey, target, nativeValue, selector, asset, assetAmount);
        return true;
    }

    function consumeCall(
        address sessionKey,
        address target,
        uint256 nativeValue,
        bytes4 selector,
        address asset,
        uint256 assetAmount
    ) external onlyExecutor returns (bool) {
        _validateCall(sessionKey, target, nativeValue, selector, asset, assetAmount);

        uint48 today = uint48(block.timestamp / 1 days);
        if (nativeSpendDay[sessionKey] != today) {
            nativeSpendDay[sessionKey] = today;
            nativeSpentToday[sessionKey] = 0;
        }
        if (nativeValue > 0) {
            nativeSpentToday[sessionKey] += uint128(nativeValue);
        }

        if (asset != address(0) && assetAmount > 0) {
            if (assetSpendDay[sessionKey][asset] != today) {
                assetSpendDay[sessionKey][asset] = today;
                assetSpentToday[sessionKey][asset] = 0;
            }
            assetSpentToday[sessionKey][asset] += uint128(assetAmount);
        }

        emit CallConsumed(sessionKey, target, asset, nativeValue, assetAmount, selector);
        return true;
    }

    function _validateCall(
        address sessionKey,
        address target,
        uint256 nativeValue,
        bytes4 selector,
        address asset,
        uint256 assetAmount
    ) internal view {
        if (paused) revert PolicyIsPaused();
        Session memory session = sessions[sessionKey];
        if (!session.enabled) revert SessionDisabled();
        if (block.timestamp < session.validAfter || block.timestamp >= session.validUntil) {
            revert SessionNotActive();
        }
        if (!targetAllowed[sessionKey][target]) revert TargetNotAllowed();
        if (!selectorAllowed[sessionKey][selector]) revert SelectorNotAllowed();
        if (nativeValue > session.maxNativeValuePerCall) revert NativeValueTooHigh();

        uint48 today = uint48(block.timestamp / 1 days);
        uint256 nativeSpent = nativeSpendDay[sessionKey] == today
            ? nativeSpentToday[sessionKey]
            : 0;
        if (nativeSpent + nativeValue > session.maxNativeValuePerDay) {
            revert NativeDailyLimitExceeded();
        }

        if (asset != address(0) && assetAmount > 0) {
            AssetLimit memory limit = assetLimits[sessionKey][asset];
            if (limit.maxPerCall == 0) revert AssetNotAllowed();
            if (assetAmount > limit.maxPerCall) revert AssetAmountTooHigh();
            uint256 assetSpent = assetSpendDay[sessionKey][asset] == today
                ? assetSpentToday[sessionKey][asset]
                : 0;
            if (assetSpent + assetAmount > limit.maxPerDay) {
                revert AssetDailyLimitExceeded();
            }
        }
    }
}
