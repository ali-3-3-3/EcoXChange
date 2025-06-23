pragma solidity ^0.5.0;

import "./AccessControl.sol";

/**
 * @title Company
 * @dev This contract represents a company and its projects in a carbon market with enhanced security.
 */
contract Company is AccessControl {
    // Enums and structs
    enum ProjectState {
        ongoing,
        completed
    } //add a modifier that updates state depending on time in carbon market

    struct company {
        address company_address;
        string companyName;
        uint256 projectCount;
    }

    struct Project {
        address companyAddress;
        string projectName;
        string desc;
        uint256 excAmount; //exc amount predicted / given for project
        uint256 excSold; //exc sold so far, updated after buyer buys
        uint256 excListed; //exc listed for sale
        ProjectState state;
        uint256 daystillCompletion;
        mapping(address => uint256) stakedCredits; // Mapping of staked credits for each company
    }

    // Events
    event companyAdded(address companyAddress);
    event projectAdded(address companyAddress, uint256 projectId);

    // State variables
    uint256 public numProjects = 0; // number of projects
    uint256 public numCompanies = 0; // number of companies
    mapping(address => company) companies; // mapping of company address to company
    mapping(uint256 => company) companiesId; // mapping of company id to company
    mapping(uint256 => Project) public projects; // mapping of project id to project
    mapping(address => uint256[]) public companyProjects; // mapping of company address to list of project ids
    mapping(address => bool) public registeredCompanies; // track registered companies

    // Enhanced security mappings
    mapping(uint256 => bool) public projectExists; // track existing projects
    mapping(address => uint256) public companyRegistrationDate; // track when companies were registered

    // Constants for validation
    uint256 public constant MIN_PROJECT_DURATION = 1 days;
    uint256 public constant MAX_PROJECT_DURATION = 365 days;
    uint256 public constant MIN_CO2_AMOUNT = 1;
    uint256 public constant MAX_CO2_AMOUNT = 1000000;
    /**
     * @dev Checks that the calling address is the company itself trying to access its own information.
     * @param companyAddress The address of the company.
     * @return A boolean indicating whether the company has rights to view the company requested. (must be itself)
     */
    function companyOwner(
        address companyAddress,
        address senderAddress
    ) public view returns (bool) {
        company storage thisCompany = companies[companyAddress];
        if (thisCompany.company_address == senderAddress) {
            return true; // sender is the company, it is  trying to access the details of itself
        }
        return false; // sender does not have rights to view the company requested (not the company itself)
    }

    /**
     * @dev Checks if a project is owned by a specific company.
     * @param projectId The ID of the project.
     * @param companyAddress The address of the company.
     * @return A boolean indicating whether the project is owned by the company.
     */
    function projectCompanyOwner(
        uint256 projectId,
        address companyAddress
    ) public view returns (bool) {
        uint256[] memory projectsByCompany = companyProjects[companyAddress];
        for (uint256 i = 0; i < projectsByCompany.length; i++) {
            if (projectsByCompany[i] == projectId) {
                // project done by company
                return true; // project done by company
            }
        }
        return false; // project not done by company
    }

    /**
     * @dev Adds a new company to the carbon market with enhanced validation.
     * @param companyAddress The address of the company.
     * @param companyName The name of the company.
     * @return The ID of the newly added company.
     */
    function addCompany(
        address companyAddress,
        string memory companyName
    )
        public
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        validAddress(companyAddress)
        notBlacklisted(companyAddress)
        returns (uint256)
    {
        require(
            bytes(companyName).length > 0,
            "Company: company name cannot be empty"
        );
        require(
            bytes(companyName).length <= 100,
            "Company: company name too long"
        );
        require(
            !registeredCompanies[companyAddress],
            "Company: company already registered"
        );
        require(
            companies[companyAddress].company_address == address(0),
            "Company: company already added"
        );

        company memory newCompany;
        newCompany.companyName = companyName;
        newCompany.company_address = companyAddress;
        newCompany.projectCount = 0;

        companies[companyAddress] = newCompany;
        registeredCompanies[companyAddress] = true;
        companyRegistrationDate[companyAddress] = block.timestamp;

        // Grant company role
        _grantRole(COMPANY_ROLE, companyAddress);

        emit companyAdded(companyAddress);

        uint256 newCompanyId = numCompanies++;
        companiesId[newCompanyId] = newCompany;
        return newCompanyId;
    }

    /**
     * @dev Adds a new project to the carbon market with enhanced validation.
     * @param pName The name of the project.
     * @param desc The description of the project.
     * @param daystillCompletion The number of days until project completion.
     * @param carbonDioxideSaved The amount of CO2 to be saved.
     */
    function addProject(
        string memory pName,
        string memory desc,
        uint256 daystillCompletion,
        uint256 carbonDioxideSaved
    ) public payable whenNotPaused notBlacklisted(msg.sender) nonReentrant {
        // Input validation
        require(
            bytes(pName).length > 0,
            "Company: project name cannot be empty"
        );
        require(bytes(pName).length <= 100, "Company: project name too long");
        require(bytes(desc).length >= 10, "Company: description too short");
        require(bytes(desc).length <= 1000, "Company: description too long");
        require(
            daystillCompletion >= MIN_PROJECT_DURATION / 1 days,
            "Company: project duration too short"
        );
        require(
            daystillCompletion <= MAX_PROJECT_DURATION / 1 days,
            "Company: project duration too long"
        );
        require(
            carbonDioxideSaved >= MIN_CO2_AMOUNT &&
                carbonDioxideSaved <= MAX_CO2_AMOUNT,
            "Company: CO2 amount out of bounds"
        );

        // Company validation
        require(
            registeredCompanies[msg.sender],
            "Company: company not registered"
        );
        require(
            hasRole(COMPANY_ROLE, msg.sender),
            "Company: caller does not have company role"
        );

        company storage thisCompany = companies[msg.sender];
        require(
            thisCompany.company_address != address(0),
            "Company: company must be added before adding project"
        );

        // Create project
        uint256 thisProjectId = numProjects++;
        Project memory newProject;
        newProject.projectName = pName;
        newProject.companyAddress = msg.sender;
        newProject.desc = desc;
        newProject.state = ProjectState.ongoing;
        newProject.daystillCompletion = daystillCompletion;
        newProject.excListed = 0;
        newProject.excAmount = carbonDioxideSaved;
        newProject.excSold = 0;

        projects[thisProjectId] = newProject;
        projectExists[thisProjectId] = true;

        // Update company
        thisCompany.projectCount++;
        companyProjects[msg.sender].push(thisProjectId);

        emit projectAdded(msg.sender, thisProjectId);
    }

    /**
     * @dev Returns the ETH balance of a company.
     * @param companyAddress The address of the company.
     * @return The ETH balance of the company.
     */
    function getCompanyEthBalance(
        address companyAddress
    ) public view returns (uint256) {
        require(
            companies[companyAddress].company_address != address(0),
            "Company does not exist"
        );
        require(
            companyOwner(companyAddress, msg.sender),
            "You do not have access to this company"
        );
        return companyAddress.balance; // get eth balance of the company (msg.sender)
    }

    /**
     * @dev Stakes credits for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param credits The amount of credits to stake.
     */
    function stakeCredits(
        address companyAddress,
        uint256 projectId,
        uint256 credits
    ) public {
        require(
            projects[projectId].companyAddress == companyAddress,
            "Only project owner can stake credits"
        );
        require(credits > 0, "Must stake a positive amount of credits");
        projects[projectId].stakedCredits[companyAddress] += credits;
    }

    /**
     * @dev Returns the staked credits for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @return The amount of staked credits for the project.
     */
    function getStakedCredits(
        address companyAddress,
        uint256 projectId
    ) public view returns (uint256) {
        require(
            projectCompanyOwner(projectId, companyAddress),
            "Project not owned by company"
        );
        return projects[projectId].stakedCredits[companyAddress];
    }

    /**
     * @dev Checks if there are sufficient EXC (EcoXChange Tokens) for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to check.
     * @return A boolean indicating whether there are sufficient EXC for the project.
     */
    function checkSufficientEXC(
        address companyAddress,
        uint256 projectId,
        uint256 excAmt
    ) public view returns (bool) {
        require(
            projectCompanyOwner(projectId, companyAddress),
            "Project not done by provided company"
        );
        if (
            projects[projectId].excSold + excAmt > projects[projectId].excAmount
        ) {
            //when buy, excSold increases
            return false;
        }
        return true;
    }

    /**
     * @dev Sells EXC (EcoXChange Tokens) for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to sell.
     */
    function sellEXC(
        address companyAddress,
        uint256 projectId,
        uint256 excAmt
    ) public {
        require(
            projectCompanyOwner(projectId, companyAddress),
            "Project not done by provided company"
        );
        projects[projectId].excSold += excAmt; //excSold increases when buyer buys
        // projects[projectId].excAmount -= excAmt; //the exc amount for the project decreases when buyer buys
    }

    /**
     * @dev Checks if there are sufficient EXC (EcoXChange Tokens) listed for sale for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to check.
     * @return A boolean indicating whether there are sufficient EXC listed for sale for the project.
     */
    function checkEXCListed(
        address companyAddress,
        uint256 projectId,
        uint256 excAmt
    ) public view returns (bool) {
        require(
            projectCompanyOwner(projectId, companyAddress),
            "Project not done by provided company"
        );
        if (
            projects[projectId].excListed + excAmt >
            projects[projectId].excAmount
        ) {
            //when sell, excListed increases
            return false;
        }
        return true;
    }

    /**
     * @dev Lists EXC (EcoXChange Tokens) for sale for a project.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to list for sale.
     */
    function listEXC(
        address companyAddress,
        uint256 projectId,
        uint256 excAmt
    ) public {
        require(
            projectCompanyOwner(projectId, companyAddress),
            "Project not done by provided company"
        );
        projects[projectId].excListed += excAmt; //excListed increases when listed
        // projects[projectId].excAmount += excAmt; //excAmount equals excListed when listed
    }

    /**
     * @dev Sets the amount of listed EXC for a project.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to set.
     */
    function setEXCListed(uint256 projectId, uint256 excAmt) public {
        require(projectId < numProjects, "Invalid project ID");
        projects[projectId].excListed = excAmt;
    }

    /**
     * @dev Returns the excAmount of a specific project.
     * @param projectId The ID of the project.
     * @return The excAmount of the project.
     */
    function getProjectexcAmount(
        uint256 projectId
    ) public view returns (uint256) {
        require(projectId < numProjects, "Invalid project ID");
        Project memory project = projects[projectId];
        return project.excAmount; //exc amount you can sell for the project
    }

    /**
     * @dev Sets the amount of EXC for a project.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to set.
     */
    function setProjectexcAmount(uint256 projectId, uint256 excAmt) public {
        require(projectId < numProjects, "Invalid project ID");
        projects[projectId].excAmount = excAmt;
    }

    /**
     * @dev Returns the amount of EXC sold for a project.
     * @param projectId The ID of the project.
     * @return The amount of EXC sold for the project.
     */
    function getEXCSold(uint256 projectId) public view returns (uint256) {
        require(projectId < numProjects, "Invalid project ID");
        return projects[projectId].excSold;
    }

    /**
     * @dev Sets the amount of sold EXC for a project.
     * @param projectId The ID of the project.
     * @param excAmt The amount of EXC to set.
     */
    function setEXCSold(uint256 projectId, uint256 excAmt) public {
        require(projectId < numProjects, "Invalid project ID");
        projects[projectId].excSold = excAmt;
    }

    /**
     * @dev Returns the state of a specific project.
     * @param projectId The ID of the project.
     * @return The state of the project.
     */
    function getProjectState(
        uint256 projectId
    ) public view returns (ProjectState) {
        require(projectId < numProjects, "Invalid project ID");
        return projects[projectId].state;
    }

    /**
     * @dev Sets a project state to complete.
     * @param projectId The ID of the project.
     */
    function setProjectStateComplete(uint256 projectId) public {
        require(projectId < numProjects, "Invalid project ID");
        projects[projectId].state = ProjectState.completed;
    }

    /**
     * @dev Returns the name of a specific company.
     * @param companyAddress The address of the company.
     * @return The name of the company.
     */
    function getCompanyName(
        address companyAddress
    ) public view returns (string memory) {
        require(
            companies[companyAddress].company_address != address(0),
            "Company does not exist"
        );
        return companies[companyAddress].companyName;
    }
}
