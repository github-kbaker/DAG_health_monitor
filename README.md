# DAG Health Monitor

A full-stack application for monitoring system health using Directed Acyclic Graphs (DAG). The system accepts JSON configurations defining system relationships, performs breadth-first search traversal, and asynchronously checks the health of each component.

## Features

- **JSON-based DAG Configuration**: Define your system architecture with nodes and edges
- **Breadth-First Search (BFS) Traversal**: Intelligently traverse the system in the correct order
- **Async Health Checks**: Parallel HTTP health endpoint checks for fast results
- **Visual Graph Display**: Interactive graph visualization using Cytoscape.js
- **Health Status Table**: Detailed tabular view of all component health
- **Failed Component Highlighting**: Red nodes indicate unhealthy/unreachable components
- **MongoDB Storage**: Persist health check results for historical analysis
- **RESTful API**: Easy integration with other systems

## Architecture

### Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React with Shadcn/UI components
- **Database**: MongoDB
- **Graph Visualization**: Cytoscape.js
- **Async HTTP**: aiohttp

### Components
1. **Backend API** (`/app/backend/server.py`):
   - Accepts DAG JSON configurations
   - Builds adjacency list representation
   - Performs BFS traversal
   - Executes async health checks
   - Stores results in MongoDB
   
2. **Frontend UI** (`/app/frontend/src/App.js`):
   - Upload or load sample DAG configurations
   - Trigger health checks
   - Display results in table format
   - Visualize DAG with color-coded health status

3. **Graph Visualization** (`/app/frontend/src/components/GraphVisualization.js`):
   - Interactive DAG visualization
   - Color-coded nodes (green=healthy, yellow=unhealthy, red=unreachable)
   - Automatic layout with BFS-based positioning

## JSON Configuration Format

```json
{
  "nodes": [
    {
      "id": "api-gateway",
      "name": "API Gateway",
      "health_endpoint": "https://your-service.com/health",
      "dependencies": []
    },
    {
      "id": "auth-service",
      "name": "Authentication Service",
      "health_endpoint": "https://auth.your-service.com/health",
      "dependencies": ["api-gateway"]
    }
  ],
  "edges": [
    {
      "from": "api-gateway",
      "to": "auth-service"
    }
  ]
}
```

### Node Properties
- `id`: Unique identifier for the node
- `name`: Human-readable name
- `health_endpoint`: HTTP endpoint to check (should return 200 for healthy)
- `dependencies`: Array of node IDs this node depends on

### Edge Properties
- `from`: Source node ID
- `to`: Target node ID

## API Endpoints

### POST `/api/dag/health-check`
Perform a health check on a DAG configuration.

**Request Body**:
```json
{
  "nodes": [...],
  "edges": [...]
}
```

**Response**:
```json
{
  "dag_id": "uuid",
  "overall_status": "healthy|unhealthy|critical",
  "nodes": [
    {
      "node_id": "api-gateway",
      "node_name": "API Gateway",
      "status": "healthy",
      "response_time_ms": 123.45,
      "checked_at": "2025-01-15T10:30:00Z"
    }
  ],
  "graph_data": {...},
  "traversal_order": ["api-gateway", "auth-service", ...],
  "checked_at": "2025-01-15T10:30:00Z"
}
```

### GET `/api/dag/history`
Get all historical health check records (last 100).

### GET `/api/dag/history/{dag_id}`
Get a specific health check record by DAG ID.

## Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB
- Yarn package manager

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Environment variables (`.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=dag_health_monitor
CORS_ORIGINS=*
```

### Frontend Setup
```bash
cd frontend
yarn install
```

Environment variables (`.env`):
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Running the Application

### Development
```bash
# Backend (from /app/backend)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (from /app/frontend)
yarn start
```

### Production
The application uses supervisor for process management:
```bash
sudo supervisorctl restart backend frontend
```

## How It Works

1. **Upload Configuration**: User uploads a JSON file or loads the sample DAG
2. **Parse & Build Graph**: Backend parses JSON and builds adjacency list
3. **BFS Traversal**: System determines optimal check order using BFS
4. **Async Health Checks**: All nodes checked in parallel using aiohttp
5. **Store Results**: Health check results saved to MongoDB
6. **Visualize**: Frontend displays results in both table and graph format

## Health Status Definitions

- **Healthy**: HTTP 200 response from health endpoint
- **Unhealthy**: Non-200 HTTP response (400-599)
- **Unreachable**: Connection timeout or network error
- **Critical**: All or most nodes are unhealthy/unreachable

## Graph Visualization

The interactive graph uses Cytoscape.js with the following features:
- **Node Colors**:
  - Green: Healthy
  - Yellow/Orange: Unhealthy
  - Red: Unreachable
- **Layout**: Breadth-first directed layout
- **Interactions**: Pan, zoom, and node selection
- **Edges**: Directed arrows showing dependencies

## GitHub Setup & Push Instructions

### 1. Create a New GitHub Repository
```bash
# Go to GitHub.com and create a new repository
# Copy the repository URL
```

### 2. Initialize Git (if not already)
```bash
cd /app
git init
```

### 3. Configure Git
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 4. Create .gitignore
```bash
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
*.egg-info/
dist/
build/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnp/
.pnp.js

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Database
*.db
*.sqlite
EOF
```

### 5. Add Files and Commit
```bash
git add .
git commit -m "Initial commit: DAG Health Monitor - Complete implementation"
```

### 6. Add Remote and Push
```bash
# Replace with your repository URL
git remote add origin https://github.com/YOUR_USERNAME/dag-health-monitor.git

# Push to main branch
git branch -M main
git push -u origin main
```

### 7. Alternative: Push to Existing Repository
```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main --force  # Use --force only if replacing existing content
```

## Sample DAG Configuration

A sample configuration is included with the following structure:
- API Gateway → Authentication Service → User Service → (Database + Redis Cache)

This demonstrates:
- Sequential dependencies (gateway → auth → user)
- Parallel dependencies (database and cache both depend on user service)
- Mixed health statuses (some healthy, some failing)

## Testing

### Manual Testing
1. Visit the application URL
2. Click "Load Sample DAG"
3. Click "Run Health Check"
4. Observe:
   - Overall system status
   - Individual node health in table
   - Visual graph with color-coded nodes
   - BFS traversal order

### API Testing
```bash
# Test health check endpoint
curl -X POST http://localhost:8001/api/dag/health-check \
  -H "Content-Type: application/json" \
  -d @sample-dag.json

# Get history
curl http://localhost:8001/api/dag/history
```

## Future Enhancements

- [ ] Real-time health monitoring with WebSocket updates
- [ ] Email/Slack notifications for critical failures
- [ ] Historical trend analysis and charts
- [ ] Custom health check strategies (TCP, database queries, etc.)
- [ ] Authentication and multi-tenancy
- [ ] Export reports to PDF/CSV
- [ ] Configurable health check intervals
- [ ] Dependency impact analysis

## License

MIT License

## Author

Creator: Kween Baker

## Support

For issues or questions, please open an issue on GitHub.
