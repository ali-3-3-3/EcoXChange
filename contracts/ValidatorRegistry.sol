pragma solidity ^0.5.0;

import "./AccessControl.sol";

/**
 * @title ValidatorRegistry
 * @dev A contract for managing a registry of validators with comprehensive access control.
 */
contract ValidatorRegistry is AccessControl {
    // Events
    event ValidatorAdded(address validator);
    event ValidatorRemoved(address validator);
    event ValidatorStatusChanged(address validator, bool active);

    // State variables
    mapping(address => bool) public validators;
    mapping(address => bool) public validatorActive;
    mapping(address => uint256) public validatorReputation;
    mapping(address => uint256) public validatorJoinDate;

    uint256 public totalValidators;
    uint256 public constant MIN_REPUTATION = 0;
    uint256 public constant MAX_REPUTATION = 1000;

    /**
     * @dev Adds a new validator to the registry with comprehensive validation.
     * @param _validator The address of the validator to be added.
     */
    function addValidator(
        address _validator
    )
        public
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        validAddress(_validator)
        notBlacklisted(_validator)
    {
        require(
            !validators[_validator],
            "ValidatorRegistry: validator already exists"
        );

        validators[_validator] = true;
        validatorActive[_validator] = true;
        validatorReputation[_validator] = 500; // Start with neutral reputation
        validatorJoinDate[_validator] = block.timestamp;
        totalValidators++;

        // Grant validator role
        _grantRole(VALIDATOR_ROLE, _validator);

        emit ValidatorAdded(_validator);
    }

    /**
     * @dev Removes a validator from the registry.
     * @param _validator The address of the validator to be removed.
     */
    function removeValidator(
        address _validator
    ) public onlyRole(ADMIN_ROLE) whenNotPaused validAddress(_validator) {
        require(
            validators[_validator],
            "ValidatorRegistry: validator does not exist"
        );

        validators[_validator] = false;
        validatorActive[_validator] = false;
        totalValidators--;

        // Revoke validator role
        _revokeRole(VALIDATOR_ROLE, _validator);

        emit ValidatorRemoved(_validator);
    }

    /**
     * @dev Activates or deactivates a validator.
     * @param _validator The address of the validator.
     * @param _active The new active status.
     */
    function setValidatorStatus(
        address _validator,
        bool _active
    ) public onlyRole(ADMIN_ROLE) whenNotPaused validAddress(_validator) {
        require(
            validators[_validator],
            "ValidatorRegistry: validator does not exist"
        );
        require(
            validatorActive[_validator] != _active,
            "ValidatorRegistry: status already set"
        );

        validatorActive[_validator] = _active;
        emit ValidatorStatusChanged(_validator, _active);
    }

    /**
     * @dev Updates validator reputation (can be called by market contract).
     * @param _validator The address of the validator.
     * @param _newReputation The new reputation score.
     */
    function updateValidatorReputation(
        address _validator,
        uint256 _newReputation
    ) public onlyRole(ADMIN_ROLE) validAddress(_validator) {
        require(
            validators[_validator],
            "ValidatorRegistry: validator does not exist"
        );
        require(
            _newReputation >= MIN_REPUTATION &&
                _newReputation <= MAX_REPUTATION,
            "ValidatorRegistry: reputation out of bounds"
        );

        validatorReputation[_validator] = _newReputation;
    }

    /**
     * @dev Checks if an address is an active validator.
     * @param _validator The address to be checked.
     * @return A boolean indicating whether the address is an active validator.
     */
    function isValidator(address _validator) public view returns (bool) {
        return
            validators[_validator] &&
            validatorActive[_validator] &&
            !isBlacklisted(_validator);
    }

    /**
     * @dev Gets validator information.
     * @param _validator The address of the validator.
     * @return exists, active, reputation, joinDate
     */
    function getValidatorInfo(
        address _validator
    )
        public
        view
        returns (bool exists, bool active, uint256 reputation, uint256 joinDate)
    {
        return (
            validators[_validator],
            validatorActive[_validator],
            validatorReputation[_validator],
            validatorJoinDate[_validator]
        );
    }

    /**
     * @dev Gets the total number of active validators.
     * @return The number of active validators.
     */
    function getActiveValidatorCount() public view returns (uint256) {
        return totalValidators;
    }
}
