import React, { useState, useEffect, useRef } from 'react';
import { Eye, HelpCircle, Loader2 } from 'lucide-react';

export default function Visualizer({ code, executionOutput, activeFile }) {
  const [loading, setLoading] = useState(false);
  const [mermaidSyntax, setMermaidSyntax] = useState('');
  const [explanation, setExplanation] = useState('');
  const [activeTab, setActiveTab] = useState('explain'); // 'visual' or 'explain'
  const svgContainerRef = useRef(null);

  // Generate Mermaid Flowchart
  const handleVisualize = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const response = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          output: executionOutput,
          language: activeFile?.name?.split('.').pop()
        })
      });
      const data = await response.json();
      if (data.diagram) {
        // Strip markdown backticks if any
        let cleanSyntax = data.diagram.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
        setMermaidSyntax(cleanSyntax);
        renderMermaid(cleanSyntax);
      }
    } catch (e) {
      console.error("Visualization error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Generate Code Explanation
  const handleExplain = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: activeFile?.name?.split('.').pop()
        })
      });
      const data = await response.json();
      if (data.explanation) {
        setExplanation(data.explanation);
      }
    } catch (e) {
      console.error("Explanation error:", e);
      setExplanation("Failed to generate explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderMermaid = async (chartCode) => {
    if (!chartCode || !window.mermaid) return;
    try {
      const uniqueId = `mermaid-svg-${Date.now()}`;
      const { svg } = await window.mermaid.render(uniqueId, chartCode);
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = svg;
      }
    } catch (err) {
      console.error("Mermaid render error:", err);
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = `<div style="color: #FF5A5F; font-size: 0.85rem; padding: 12px;">Failed to render chart. Check syntax.</div>`;
      }
    }
  };

  // Auto trigger explanation on file load
  useEffect(() => {
    if (code) {
      setExplanation('');
      setMermaidSyntax('');
      if (svgContainerRef.current) svgContainerRef.current.innerHTML = '';
      if (activeTab === 'explain') {
        handleExplain();
      } else {
        handleVisualize();
      }
    }
  }, [code, activeTab]);

  return (
    <div className="visualizer-container">
      <div className="right-panel-header">
        <div 
          className={`right-panel-tab ${activeTab === 'explain' ? 'active' : ''}`}
          onClick={() => setActiveTab('explain')}
        >
          <HelpCircle size={14} style={{ marginRight: '6px', inlineSize: 'auto' }} />
          Explain Code
        </div>
        <div 
          className={`right-panel-tab ${activeTab === 'visual' ? 'active' : ''}`}
          onClick={() => setActiveTab('visual')}
        >
          <Eye size={14} style={{ marginRight: '6px', inlineSize: 'auto' }} />
          Visualize Logic
        </div>
      </div>

      <div className="right-panel-content">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#5B6472' }}>
            <Loader2 className="animate-spin" size={24} style={{ marginBottom: '12px' }} />
            <span>Analyzing code flow...</span>
          </div>
        ) : (
          <div>
            {activeTab === 'explain' ? (
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: '#333', lineHeight: '1.6' }}>
                {explanation || "Click to generate explanation."}
              </div>
            ) : (
              <div>
                <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '16px' }} onClick={handleVisualize}>
                  Regenerate Flowchart
                </button>
                <div ref={svgContainerRef} className="mermaid-diagram">
                  {!mermaidSyntax && (
                    <span style={{ color: '#5B6472', fontSize: '0.85rem' }}>No flowchart loaded.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
