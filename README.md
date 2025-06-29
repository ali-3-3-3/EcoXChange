# EcoXChange

## Overview

EcoXChange is a blockchain-based solution aimed at facilitating the trading and tracking of carbon credits. By utilizing smart contracts, this project ensures secure, transparent, and verifiable transactions on the Ethereum blockchain. This project leverages Solidity for contract development and JavaScript for interactions with the blockchain.

### Project Motivation

The goal of EcoXChange is to leverage blockchain technology to enhance the transparency and efficiency of carbon credit trading. Traditional carbon credit markets suffer from inefficiencies, fraud, and lack of trust. By utilizing Ethereum's decentralized infrastructure, this project provides a tamper-proof, automated solution for issuing and trading carbon credits, ensuring verifiability and environmental impact tracking in real-time.

### Technologies Used

- **Solidity**: The main programming language used for writing smart contracts in this project. Solidity enables the creation of smart contracts that manage the minting and trading of carbon credits.
- **Truffle**: A development framework for Ethereum that simplifies the process of writing, testing, and deploying smart contracts. Truffle provides migration scripts and testing frameworks to streamline the development process.
- **Ganache**: A personal blockchain for Ethereum development, Ganache allows developers to deploy smart contracts and test blockchain interactions in a local environment, ensuring everything works as expected before moving to a live network.

### Features

- **Smart Contracts**: Secure EcoXChange token minting, transferring, and carbon credit management using Solidity.
- **Decentralized Platform**: Operates on the Ethereum blockchain for transparent and tamper-proof transactions.
- **Modular Architecture**: Easily extendable with additional features like carbon credit auditing or multi-token standards.

## How It Works

The **EcoXChange** platform provides a seamless way for individuals and businesses to buy, trade, and sell carbon credits, encouraging environmental responsibility through market incentives.

1. **Token Minting**: Environmental projects, such as reforestation or renewable energy, undergo a validation process. Once the project’s carbon offset potential is verified by an accredited body, the project owner can mint carbon credit tokens on the platform, each representing a certain amount of carbon offset (e.g., 1 ton of CO₂).

2. **Validation**: Carbon credit tokens are only issued after the project's carbon offsets are validated by trusted third-party auditors. This ensures that the credits represent real and measurable reductions in greenhouse gases, preventing fraud and promoting trust in the market.

3. **Buying Carbon Credits**: Individuals or companies looking to offset their carbon footprints can purchase these tokens on the platform. For instance, a business can buy tokens equivalent to the amount of carbon dioxide they emit during operations, thereby achieving carbon neutrality or reducing their environmental impact.

4. **Trading and Profit**: Sellers (project owners) make a profit by selling the tokens minted from their validated environmental projects. The price of tokens is market-driven, and sellers benefit financially by contributing to carbon reduction efforts.

5. **Carbon Footprint Offsetting**: Once purchased, carbon credits can be “retired” to signify that the credits have been used to offset emissions. This action permanently removes the tokens from circulation, ensuring that the offset is accounted for and preventing double-counting.

This approach encourages a decentralized, transparent, and scalable way to promote environmental sustainability while rewarding businesses and projects for their efforts.

## Repository Structure

- `/contracts`: Contains the Solidity smart contracts responsible for minting and managing carbon credit tokens.
- `/migrations`: Handles the deployment process of the smart contracts to the blockchain.
- `/test`: Includes JavaScript test scripts using the Truffle framework to verify contract functionality.
- `/backend`: Express.js API server providing REST endpoints for the web application.
- `/frontend`: Next.js React application providing the user interface.
- `/ecoxchange-app`: Additional frontend components and configurations.

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ali-3-3-3/EcoXChange.git
   ```

2. **Install dependencies**:

   **For Smart Contracts:**

   ```bash
   cd EcoXChange
   npm install
   ```

   **For Backend API:**

   ```bash
   cd backend
   npm install
   ```

   **For Frontend:**

   ```bash
   cd ecoxchange-app/frontend
   npm install
   ```

3. **Set up environment variables**:

   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your configuration

   # Frontend
   cd ../ecoxchange-app/frontend
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Deploy the contracts** (optional):
   Ensure you have a local Ethereum node running (like Ganache) and deploy the contracts:
   ```bash
   truffle migrate
   ```

## Usage

### Running the Full Application

1. **Start the Backend API:**

   ```bash
   cd backend
   npm start          # Production mode
   # OR
   npm run dev        # Development mode with auto-restart
   ```

   The API will be available at `http://localhost:5000`

2. **Start the Frontend:**

   ```bash
   cd ecoxchange-app/frontend
   npm run dev
   ```

   The web application will be available at `http://localhost:3000`

3. **Smart Contract Interaction:**
   Once the contracts are deployed, interact with them using JavaScript in a Node.js environment. You can mint, transfer, or check balances of EcoXChange tokens.

### API Endpoints

The backend provides the following REST API endpoints:

- `GET /health` - Server health check
- `POST /api/auth/login` - User authentication (Phase 2)
- `GET /api/users` - User management (Phase 2)
- `GET /api/projects` - Carbon credit projects (Phase 2)
- `GET /api/transactions` - Trading transactions (Phase 2)
- `GET /api/validators` - Project validation (Phase 2)

For detailed API documentation, see `backend/README.md`.

## Testing

**Smart Contracts:**

```bash
truffle test
```

**Backend API:**

```bash
cd backend
npm test
```

**Frontend:**

```bash
cd ecoxchange-app/frontend
npm test
```

## Contributing

Feel free to open issues or submit pull requests to improve the project.

## License

This project is licensed under the MIT License.
