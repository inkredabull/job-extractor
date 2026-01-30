import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isTyping?: boolean;
}

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-domain.com'  // Update this for production
  : 'http://localhost:3000';

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm here to help. Ask me anything about engineering leadership, startup scaling, or technical expertise. What would you like to know?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Add typing indicator
    const typingMessage: Message = {
      id: 'typing',
      text: 'Typing...',
      isUser: false,
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/cv-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: inputText,
          jobDescription: '', // Could be enhanced to include context
          sessionId: sessionId,
          userAgent: navigator.userAgent,
          referrer: document.referrer || window.location.href
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Remove typing indicator and add actual response
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== 'typing');
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date()
        }];
      });

    } catch (error) {
      console.error('Error:', error);
      // Remove typing indicator and add error message
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== 'typing');
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
          isUser: false,
          timestamp: new Date()
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Ask Me Anything</h1>
          <p>Engineering Leadership & Startup Scaling</p>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.isUser ? 'user-message' : 'assistant-message'} ${
                message.isTyping ? 'typing' : ''
              }`}
            >
              <div className="message-content">
                <div className="message-text">
                  {message.text.split('\n').map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      {index < message.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask me about engineering leadership, startup scaling, technical expertise..."
              className="message-input"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={!inputText.trim() || isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
