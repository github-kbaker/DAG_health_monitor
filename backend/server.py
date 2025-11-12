from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any
import uuid
from datetime import datetime, timezone
import asyncio
import aiohttp
from collections import deque
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Node(BaseModel):
    id: str
    name: str
    health_endpoint: str
    dependencies: List[str] = Field(default_factory=list)

class Edge(BaseModel):
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    
    model_config = ConfigDict(populate_by_name=True)

class DAGInput(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class NodeHealthResult(BaseModel):
    node_id: str
    node_name: str
    status: str  # "healthy", "unhealthy", "unreachable"
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    checked_at: str

class DAGHealthResponse(BaseModel):
    dag_id: str
    overall_status: str
    nodes: List[NodeHealthResult]
    graph_data: Dict[str, Any]
    traversal_order: List[str]
    checked_at: str

class HealthCheckRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dag_id: str
    overall_status: str
    nodes: List[Dict[str, Any]]
    graph_data: Dict[str, Any]
    traversal_order: List[str]
    timestamp: str


# Helper function to perform health check on a single node
async def check_node_health(node: Node, session: aiohttp.ClientSession) -> NodeHealthResult:
    """
    Asynchronously check the health of a node by pinging its health endpoint
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        async with session.get(
            node.health_endpoint,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            end_time = asyncio.get_event_loop().time()
            response_time_ms = (end_time - start_time) * 1000
            
            if response.status == 200:
                return NodeHealthResult(
                    node_id=node.id,
                    node_name=node.name,
                    status="healthy",
                    response_time_ms=round(response_time_ms, 2),
                    checked_at=datetime.now(timezone.utc).isoformat()
                )
            else:
                return NodeHealthResult(
                    node_id=node.id,
                    node_name=node.name,
                    status="unhealthy",
                    response_time_ms=round(response_time_ms, 2),
                    error_message=f"HTTP {response.status}",
                    checked_at=datetime.now(timezone.utc).isoformat()
                )
    except asyncio.TimeoutError:
        return NodeHealthResult(
            node_id=node.id,
            node_name=node.name,
            status="unreachable",
            error_message="Request timeout",
            checked_at=datetime.now(timezone.utc).isoformat()
        )
    except Exception as e:
        return NodeHealthResult(
            node_id=node.id,
            node_name=node.name,
            status="unreachable",
            error_message=str(e),
            checked_at=datetime.now(timezone.utc).isoformat()
        )


def build_adjacency_list(dag_input: DAGInput) -> Dict[str, List[str]]:
    """
    Build an adjacency list from the DAG input
    """
    adj_list = {node.id: [] for node in dag_input.nodes}
    
    for edge in dag_input.edges:
        if edge.from_node in adj_list:
            adj_list[edge.from_node].append(edge.to_node)
    
    return adj_list


def bfs_traversal(dag_input: DAGInput, adj_list: Dict[str, List[str]]) -> List[str]:
    """
    Perform breadth-first search traversal on the DAG
    Returns the order in which nodes should be checked
    """
    # Find root nodes (nodes with no incoming edges)
    all_targets = set()
    for edge in dag_input.edges:
        all_targets.add(edge.to_node)
    
    root_nodes = [node.id for node in dag_input.nodes if node.id not in all_targets]
    
    # If no root nodes found, start with the first node
    if not root_nodes:
        root_nodes = [dag_input.nodes[0].id] if dag_input.nodes else []
    
    visited = set()
    traversal_order = []
    queue = deque(root_nodes)
    
    while queue:
        node_id = queue.popleft()
        
        if node_id not in visited:
            visited.add(node_id)
            traversal_order.append(node_id)
            
            # Add neighbors to queue
            for neighbor in adj_list.get(node_id, []):
                if neighbor not in visited:
                    queue.append(neighbor)
    
    # Add any unvisited nodes (in case of disconnected components)
    for node in dag_input.nodes:
        if node.id not in visited:
            traversal_order.append(node.id)
    
    return traversal_order


@api_router.post("/dag/health-check", response_model=DAGHealthResponse)
async def check_dag_health(dag_input: DAGInput):
    """
    Main endpoint to check the health of a DAG system
    1. Accepts JSON with nodes and edges
    2. Performs BFS traversal
    3. Asynchronously checks health of each node
    4. Stores results in MongoDB
    5. Returns health status
    """
    try:
        # Build adjacency list
        adj_list = build_adjacency_list(dag_input)
        
        # Perform BFS traversal
        traversal_order = bfs_traversal(dag_input, adj_list)
        
        # Create node lookup
        node_lookup = {node.id: node for node in dag_input.nodes}
        
        # Perform health checks asynchronously
        async with aiohttp.ClientSession() as session:
            health_check_tasks = [
                check_node_health(node_lookup[node_id], session)
                for node_id in traversal_order
                if node_id in node_lookup
            ]
            
            health_results = await asyncio.gather(*health_check_tasks)
        
        # Determine overall system status
        unhealthy_count = sum(1 for result in health_results if result.status != "healthy")
        overall_status = "healthy" if unhealthy_count == 0 else "unhealthy" if unhealthy_count < len(health_results) else "critical"
        
        # Prepare graph data for visualization
        graph_data = {
            "nodes": [
                {
                    "id": node.id,
                    "label": node.name,
                    "health_endpoint": node.health_endpoint
                }
                for node in dag_input.nodes
            ],
            "edges": [
                {
                    "from": edge.from_node,
                    "to": edge.to_node
                }
                for edge in dag_input.edges
            ]
        }
        
        # Create response
        dag_id = str(uuid.uuid4())
        response = DAGHealthResponse(
            dag_id=dag_id,
            overall_status=overall_status,
            nodes=health_results,
            graph_data=graph_data,
            traversal_order=traversal_order,
            checked_at=datetime.now(timezone.utc).isoformat()
        )
        
        # Store in MongoDB
        record = HealthCheckRecord(
            dag_id=dag_id,
            overall_status=overall_status,
            nodes=[result.model_dump() for result in health_results],
            graph_data=graph_data,
            traversal_order=traversal_order,
            timestamp=response.checked_at
        )
        
        await db.health_checks.insert_one(record.model_dump())
        
        return response
        
    except Exception as e:
        logger.error(f"Error checking DAG health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/dag/history", response_model=List[HealthCheckRecord])
async def get_health_check_history():
    """
    Get all historical health check records
    """
    records = await db.health_checks.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return records


@api_router.get("/dag/history/{dag_id}", response_model=HealthCheckRecord)
async def get_health_check_by_id(dag_id: str):
    """
    Get a specific health check record by DAG ID
    """
    record = await db.health_checks.find_one({"dag_id": dag_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Health check record not found")
    return record


@api_router.get("/")
async def root():
    return {"message": "DAG Health Monitoring Service", "version": "1.0.0"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
