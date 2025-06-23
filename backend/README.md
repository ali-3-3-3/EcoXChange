# EcoXChange Backend API

The backend API server for the EcoXChange carbon credit trading platform.

## Features

- **Express.js** REST API server
- **Environment-based configuration** with dotenv
- **Security middleware** (Helmet, CORS, Rate limiting)
- **Request logging** with Morgan
- **Blockchain integration** ready (Web3, Truffle contracts)
- **Database integration** ready (Sequelize, PostgreSQL)
- **File upload support** (Multer)
- **IPFS integration** ready
- **JWT authentication** ready
- **Input validation** (Express Validator)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (for production database)
- IPFS node (optional, for file storage)
- Ethereum node or testnet access (for blockchain features)

## Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your configuration values.

## Configuration

The application uses environment variables for configuration. Key variables include:

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origin (default: http://localhost:3000)
- `DB_*` - Database connection settings
- `JWT_SECRET` - JWT signing secret
- `ETHEREUM_RPC_URL` - Ethereum node URL
- `IPFS_*` - IPFS configuration

See `.env.example` for all available options.

## Running the Server

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (Phase 2)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout  
- `GET /api/auth/profile` - Get user profile

### Users (Phase 2)
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user

### Projects (Phase 2)
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Transactions (Phase 2)
- `GET /api/transactions` - List transactions
- `POST /api/transactions/buy` - Buy carbon credits
- `POST /api/transactions/sell` - Sell carbon credits
- `GET /api/transactions/:id` - Get transaction by ID

### Validators (Phase 2)
- `GET /api/validators` - List validators
- `POST /api/validators/validate` - Validate project
- `GET /api/validators/pending` - Get pending validations

## Development

### Project Structure
```
backend/
├── src/
│   ├── server.js          # Main server file
│   ├── routes/            # API route handlers
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── projects.js
│   │   ├── transactions.js
│   │   └── validators.js
│   └── config/            # Configuration files
├── .env                   # Environment variables
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

### Adding New Routes
1. Create route handler in `src/routes/`
2. Import and use in `src/server.js`
3. Update this README with endpoint documentation

## Testing the API

### Using curl
```bash
# Health check
curl http://localhost:5000/health

# Test API endpoints
curl http://localhost:5000/api/users
curl -X POST http://localhost:5000/api/auth/login
```

### Using a REST client
Import the API endpoints into Postman, Insomnia, or similar tools for testing.

## Deployment

1. Set `NODE_ENV=production` in environment
2. Configure production database and other services
3. Run `npm start`
4. Consider using PM2 or similar process manager for production

## Troubleshooting

### Common Issues

1. **Port already in use**: Change `PORT` in `.env` or kill existing process
2. **Environment variables not loading**: Ensure `.env` file exists and is properly formatted
3. **Database connection errors**: Check database configuration in `.env`
4. **CORS errors**: Verify `CORS_ORIGIN` matches your frontend URL

### Logs
The server uses Morgan for request logging. Check console output for request details and errors.

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update this README for new endpoints or configuration options
4. Ensure all environment variables are documented in `.env.example`
