import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Activity, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import GraphVisualization from "@/components/GraphVisualization";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [dagData, setDagData] = useState(null);
  const [healthResults, setHealthResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const sampleDAG = {
    nodes: [
      {
        id: "api-gateway",
        name: "API Gateway",
        health_endpoint: "https://httpstat.us/200",
        dependencies: []
      },
      {
        id: "auth-service",
        name: "Authentication Service",
        health_endpoint: "https://httpstat.us/200",
        dependencies: ["api-gateway"]
      },
      {
        id: "user-service",
        name: "User Service",
        health_endpoint: "https://httpstat.us/200",
        dependencies: ["auth-service"]
      },
      {
        id: "database",
        name: "Database",
        health_endpoint: "https://httpstat.us/500",
        dependencies: ["user-service"]
      },
      {
        id: "cache",
        name: "Redis Cache",
        health_endpoint: "https://httpstat.us/503",
        dependencies: ["user-service"]
      }
    ],
    edges: [
      { from: "api-gateway", to: "auth-service" },
      { from: "auth-service", to: "user-service" },
      { from: "user-service", to: "database" },
      { from: "user-service", to: "cache" }
    ]
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          setDagData(json);
          toast.success("DAG configuration loaded successfully");
        } catch (error) {
          toast.error("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  const loadSampleDAG = () => {
    setDagData(sampleDAG);
    setShowSample(false);
    toast.success("Sample DAG loaded");
  };

  const runHealthCheck = async () => {
    if (!dagData) {
      toast.error("Please upload a DAG configuration first");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/dag/health-check`, dagData);
      setHealthResults(response.data);
      toast.success("Health check completed");
    } catch (error) {
      toast.error("Health check failed: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "healthy":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" data-testid={`status-badge-healthy`}>
            <CheckCircle className="w-3 h-3 mr-1" />
            Healthy
          </Badge>
        );
      case "unhealthy":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30" data-testid={`status-badge-unhealthy`}>
            <AlertCircle className="w-3 h-3 mr-1" />
            Unhealthy
          </Badge>
        );
      case "unreachable":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid={`status-badge-unreachable`}>
            <XCircle className="w-3 h-3 mr-1" />
            Unreachable
          </Badge>
        );
      case "critical":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid={`status-badge-critical`}>
            <XCircle className="w-3 h-3 mr-1" />
            Critical
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" data-testid={`status-badge-unknown`}>
            {status}
          </Badge>
        );
    }
  };

  const downloadSample = () => {
    const dataStr = JSON.stringify(sampleDAG, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-dag.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample DAG downloaded");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              DAG Health Monitor
            </h1>
          </div>
          <p className="text-slate-600 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
            Monitor system health with breadth-first traversal and async health checks
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6 border-slate-200 shadow-lg" data-testid="upload-card">
          <CardHeader>
            <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Upload DAG Configuration</CardTitle>
            <CardDescription>Upload a JSON file defining your system architecture</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer" asChild data-testid="upload-json-button">
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload JSON
                  </span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="file-input"
                />
              </label>
              <Button variant="outline" onClick={loadSampleDAG} data-testid="load-sample-button">
                Load Sample DAG
              </Button>
              <Button variant="outline" onClick={downloadSample} data-testid="download-sample-button">
                Download Sample
              </Button>
              <Button
                onClick={runHealthCheck}
                disabled={!dagData || loading}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                data-testid="run-health-check-button"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 mr-2" />
                    Run Health Check
                  </>
                )}
              </Button>
            </div>
            {dagData && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200" data-testid="dag-loaded-info">
                <p className="text-sm text-slate-600">
                  <strong>Loaded:</strong> {dagData.nodes?.length || 0} nodes, {dagData.edges?.length || 0} edges
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {healthResults && (
          <>
            {/* Overall Status */}
            <Card className="mb-6 border-slate-200 shadow-lg" data-testid="overall-status-card">
              <CardHeader>
                <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Overall Health</p>
                    {getStatusBadge(healthResults.overall_status)}
                  </div>
                  <div className="border-l border-slate-200 pl-4">
                    <p className="text-sm text-slate-600 mb-1">Checked At</p>
                    <p className="text-sm font-mono" data-testid="checked-at-time">{new Date(healthResults.checked_at).toLocaleString()}</p>
                  </div>
                  <div className="border-l border-slate-200 pl-4">
                    <p className="text-sm text-slate-600 mb-1">Traversal Order</p>
                    <p className="text-xs font-mono text-slate-500" data-testid="traversal-order">{healthResults.traversal_order.join(' → ')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Table */}
            <Card className="mb-6 border-slate-200 shadow-lg" data-testid="health-table-card">
              <CardHeader>
                <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Node Health Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Node ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Checked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthResults.nodes.map((node, index) => (
                        <TableRow key={node.node_id} data-testid={`node-row-${node.node_id}`}>
                          <TableCell className="font-mono text-sm" data-testid={`node-id-${index}`}>{node.node_id}</TableCell>
                          <TableCell className="font-medium" data-testid={`node-name-${index}`}>{node.node_name}</TableCell>
                          <TableCell data-testid={`node-status-${index}`}>{getStatusBadge(node.status)}</TableCell>
                          <TableCell data-testid={`node-response-time-${index}`}>
                            {node.response_time_ms ? `${node.response_time_ms}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-red-600" data-testid={`node-error-${index}`}>
                            {node.error_message || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs" data-testid={`node-checked-at-${index}`}>
                            {new Date(node.checked_at).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Graph Visualization */}
            <Card className="border-slate-200 shadow-lg" data-testid="graph-visualization-card">
              <CardHeader>
                <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Graph Visualization</CardTitle>
                <CardDescription>Red nodes indicate unhealthy/unreachable components</CardDescription>
              </CardHeader>
              <CardContent>
                <GraphVisualization
                  graphData={healthResults.graph_data}
                  healthResults={healthResults.nodes}
                />
              </CardContent>
            </Card>
          </>
        )}

        {!healthResults && !dagData && (
          <Card className="border-slate-200 shadow-lg" data-testid="getting-started-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Get Started
                </h3>
                <p className="text-slate-500 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Upload a DAG configuration or load the sample to begin monitoring
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;
