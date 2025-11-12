import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

const GraphVisualization = ({ graphData, healthResults }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Create health lookup map
    const healthMap = {};
    healthResults.forEach(result => {
      healthMap[result.node_id] = result.status;
    });

    // Prepare nodes for cytoscape
    const nodes = graphData.nodes.map(node => ({
      data: {
        id: node.id,
        label: node.label
      }
    }));

    // Prepare edges for cytoscape
    const edges = graphData.edges.map((edge, index) => ({
      data: {
        id: `edge-${index}`,
        source: edge.from,
        target: edge.to
      }
    }));

    // Initialize cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => {
              const status = healthMap[ele.id()];
              if (status === 'healthy') return '#10b981';
              if (status === 'unhealthy') return '#f59e0b';
              if (status === 'unreachable') return '#ef4444';
              return '#6b7280';
            },
            'label': 'data(label)',
            'color': '#1e293b',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'font-weight': '600',
            'font-family': 'Inter, sans-serif',
            'width': '80px',
            'height': '80px',
            'text-wrap': 'wrap',
            'text-max-width': '70px',
            'border-width': 3,
            'border-color': (ele) => {
              const status = healthMap[ele.id()];
              if (status === 'healthy') return '#059669';
              if (status === 'unhealthy') return '#d97706';
              if (status === 'unreachable') return '#dc2626';
              return '#4b5563';
            },
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.5
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 50,
        spacingFactor: 1.5,
        avoidOverlap: true
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    cyRef.current = cy;

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, healthResults]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '600px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}
      data-testid="cytoscape-graph"
    />
  );
};

export default GraphVisualization;
