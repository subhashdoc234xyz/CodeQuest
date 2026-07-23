import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function LightChat({ code, activeFile }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your Light AI Assistant. Ask me anything about your current code or how to build features.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          codeContext: code,
          language: activeFile?.name?.split('.').pop()
        })
      });

      const data = await response.json();
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue. Please try again.' }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to AI backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="panel-header" style={{ borderBottom: '1px solid #E5E9F0', background: '#FFFFFF', color: '#0B1D3A' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#3E6BD6" />
          Light Assistant
        </span>
      </div>

      <div className="right-panel-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="chat-messages" style={{ flex: 1 }}>
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-message ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant" style={{ color: '#5B6472' }}>
              Typing...
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your code..."
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
