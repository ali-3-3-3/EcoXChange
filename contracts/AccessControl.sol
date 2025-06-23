pragma solidity ^0.5.0;

/**
 * @title AccessControl
 * @dev Role-based access control contract providing comprehensive security features
 * @notice This contract implements a flexible role-based access control system with emergency pause functionality
 */
contract AccessControl {
    // Events
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
    event Paused(address account);
    event Unpaused(address account);

    // Role definitions
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant COMPANY_ROLE = keccak256("COMPANY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // State variables
    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(bytes32 => bytes32) private _roleAdmins;
    mapping(address => bool) private _blacklisted;
    
    bool private _paused;
    address private _owner;
    uint256 private _reentrancyStatus;

    // Constants for reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    /**
     * @dev Constructor sets the deployer as the default admin
     */
    constructor() public {
        _owner = msg.sender;
        _paused = false;
        _reentrancyStatus = _NOT_ENTERED;
        
        // Grant default admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Set role admins
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(VALIDATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(COMPANY_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @dev Modifier to check if caller has a specific role
     */
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: caller does not have required role");
        _;
    }

    /**
     * @dev Modifier to check if contract is not paused
     */
    modifier whenNotPaused() {
        require(!_paused, "AccessControl: contract is paused");
        _;
    }

    /**
     * @dev Modifier to check if contract is paused
     */
    modifier whenPaused() {
        require(_paused, "AccessControl: contract is not paused");
        _;
    }

    /**
     * @dev Modifier to check if address is not blacklisted
     */
    modifier notBlacklisted(address account) {
        require(!_blacklisted[account], "AccessControl: account is blacklisted");
        _;
    }

    /**
     * @dev Reentrancy guard modifier
     */
    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "AccessControl: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    /**
     * @dev Input validation modifier for non-zero addresses
     */
    modifier validAddress(address account) {
        require(account != address(0), "AccessControl: invalid address");
        _;
    }

    /**
     * @dev Input validation modifier for non-zero amounts
     */
    modifier validAmount(uint256 amount) {
        require(amount > 0, "AccessControl: amount must be greater than zero");
        _;
    }

    /**
     * @dev Check if an account has a specific role
     */
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Get the admin role that controls a role
     */
    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return _roleAdmins[role];
    }

    /**
     * @dev Grant a role to an account
     */
    function grantRole(bytes32 role, address account) 
        public 
        onlyRole(getRoleAdmin(role)) 
        validAddress(account)
        notBlacklisted(account)
    {
        _grantRole(role, account);
    }

    /**
     * @dev Revoke a role from an account
     */
    function revokeRole(bytes32 role, address account) 
        public 
        onlyRole(getRoleAdmin(role)) 
        validAddress(account)
    {
        _revokeRole(role, account);
    }

    /**
     * @dev Renounce a role (caller renounces their own role)
     */
    function renounceRole(bytes32 role, address account) public {
        require(account == msg.sender, "AccessControl: can only renounce roles for self");
        _revokeRole(role, account);
    }

    /**
     * @dev Pause the contract (emergency stop)
     */
    function pause() public onlyRole(PAUSER_ROLE) whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() public onlyRole(PAUSER_ROLE) whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Check if contract is paused
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @dev Add address to blacklist
     */
    function blacklistAccount(address account) 
        public 
        onlyRole(ADMIN_ROLE) 
        validAddress(account)
    {
        require(!_blacklisted[account], "AccessControl: account already blacklisted");
        _blacklisted[account] = true;
        
        // Revoke all roles from blacklisted account
        _revokeRole(VALIDATOR_ROLE, account);
        _revokeRole(COMPANY_ROLE, account);
    }

    /**
     * @dev Remove address from blacklist
     */
    function removeFromBlacklist(address account) 
        public 
        onlyRole(ADMIN_ROLE) 
        validAddress(account)
    {
        require(_blacklisted[account], "AccessControl: account not blacklisted");
        _blacklisted[account] = false;
    }

    /**
     * @dev Check if account is blacklisted
     */
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    /**
     * @dev Get contract owner
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Internal function to grant role
     */
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /**
     * @dev Internal function to revoke role
     */
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /**
     * @dev Internal function to set role admin
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roleAdmins[role] = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }
}
