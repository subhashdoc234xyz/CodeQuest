import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Calendar, Search, Award, CheckCircle, ExternalLink, FileText, Download } from 'lucide-react';

export default function Roadmap({ onOpenPracticeFile, xp, setXp, streak, setStreak }) {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(2); // default 2 weeks
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), duration_weeks: duration })
      });
      const data = await response.json();
      if (data && data.phases) {
        // Add completed flag to each phase
        const updatedPhases = data.phases.map(phase => ({
          ...phase,
          completed: false
        }));
        setRoadmap({ ...data, phases: updatedPhases });
      }
    } catch (err) {
      console.error("Roadmap generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePhaseComplete = (phaseIndex) => {
    if (!roadmap) return;
    const updatedPhases = [...roadmap.phases];
    const isNowComplete = !updatedPhases[phaseIndex].completed;
    updatedPhases[phaseIndex].completed = isNowComplete;
    
    // Update XP and streak
    if (isNowComplete) {
      setXp(prev => prev + 15);
      setStreak(prev => prev + 1);
    } else {
      setXp(prev => Math.max(0, prev - 15));
      setStreak(prev => Math.max(1, prev - 1));
    }

    setRoadmap({ ...roadmap, phases: updatedPhases });
  };

  // PDF Export using jsPDF
  const handleExportPDF = () => {
    if (!roadmap) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(`CodeQuest Roadmap: ${roadmap.topic}`, 20, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Duration: ${roadmap.duration_weeks} Weeks`, 20, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 36);
    
    let yPos = 50;
    roadmap.phases.forEach((phase, idx) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Phase ${idx + 1}: ${phase.title}`, 20, yPos);
      yPos += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(phase.description, 170);
      doc.text(splitDesc, 20, yPos);
      yPos += (splitDesc.length * 5) + 4;

      if (phase.resources && phase.resources.length > 0) {
        doc.text("Resources:", 20, yPos);
        yPos += 5;
        phase.resources.forEach(res => {
          doc.text(`- ${res.name}: ${res.url}`, 24, yPos);
          yPos += 5;
        });
        yPos += 5;
      }
      yPos += 5;
    });

    doc.save(`roadmap-${roadmap.topic.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div className="roadmap-generator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E5E9F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={20} color="#EAA12A" />
          <div>
            <div style={{ fontSize: '0.8rem', color: '#5B6472', fontWeight: 600 }}>YOUR PROGRESS SCORE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B1D3A' }}>{xp} XP | 🔥 {streak} Day Streak</div>
          </div>
        </div>
      </div>

      {!roadmap ? (
        <form onSubmit={handleGenerate} className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Generate Personalized Roadmap</h3>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6472', display: 'block', marginBottom: '6px' }}>What topic do you want to learn?</label>
            <input
              type="text"
              className="input-field"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. React.js, Rust, Data Structures"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5B6472', display: 'block', marginBottom: '6px' }}>Course Duration: {duration} Weeks</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                type="range"
                min="1"
                max="4"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#3E6BD6' }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{duration} wk</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? "Synthesizing Roadmap..." : "Create Course Roadmap"}
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setRoadmap(null)}>
              ← Back to Generator
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              <Download size={14} /> Export Roadmap PDF
            </button>
          </div>

          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{roadmap.topic} Learning Path</h2>
            <p style={{ color: '#5B6472', fontSize: '0.875rem', marginBottom: '20px' }}>
              Completed {roadmap.phases.filter(p => p.completed).length} of {roadmap.phases.length} learning phases
            </p>

            <div className="roadmap-timeline">
              {roadmap.phases.map((phase, idx) => (
                <div key={idx} className="roadmap-card" style={{ borderLeft: phase.completed ? '4px solid #3EBE7A' : '4px solid #3E6BD6' }}>
                  <div className="roadmap-card-header">
                    <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{phase.title}</h4>
                    <button 
                      onClick={() => togglePhaseComplete(idx)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: phase.completed ? '#3EBE7A' : '#DDE2EB' }}
                    >
                      <CheckCircle size={20} fill={phase.completed ? '#3EBE7A' : 'none'} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#5B6472', marginBottom: '12px' }}>{phase.description}</p>
                  
                  {phase.resources && phase.resources.length > 0 && (
                    <div className="resources-list">
                      {phase.resources.map((res, rIdx) => (
                        <a key={rIdx} href={res.url} target="_blank" rel="noopener noreferrer" className="resource-link">
                          <ExternalLink size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          {res.name}
                        </a>
                      ))}
                    </div>
                  )}

                  {phase.practice_template && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', marginTop: '14px', fontSize: '0.75rem', padding: '6px 12px' }}
                      onClick={() => onOpenPracticeFile(phase)}
                    >
                      <FileText size={12} /> Open Scratch File & Practice
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
