import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./main.css";

function TranscriptList() {
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTranscripts = async () => {
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("http://localhost:8000/list-transcripts");
      const data = await res.json();
      
      if (data.transcripts) {
        setTranscripts(data.transcripts);
      } else {
        setError(data.message || "No transcripts found");
      }
    } catch (err) {
      setError("Error loading transcripts");
    }
    setLoading(false);
  };

  return (
    <div className="transcript-list">
      <div className="transcript-list-header">
        <h3>Stored Transcripts</h3>
        <button 
          className="refresh-btn" 
          onClick={loadTranscripts}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh List"}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="transcript-items">
        {transcripts.length > 0 ? (
          transcripts.map((transcript) => (
            <div key={transcript.id} className="transcript-item">
              <div className="transcript-name">{transcript.name}</div>
              <div className="transcript-preview">{transcript.preview}</div>
              <div className="transcript-meta">
                Length: {transcript.total_length} chars
                {transcript.total_chunks > 1 && (
                  <span className="chunk-info">
                    {" • "}{transcript.total_chunks} chunks
                  </span>
                )}
                {transcript.metadata && Object.keys(transcript.metadata).length > 0 && (
                  <span className="metadata-count">
                    {" • "}{Object.keys(transcript.metadata).length} metadata fields
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          !loading && !error && (
            <div className="no-transcripts">
              No transcripts found. Add some transcripts using the embed feature above.
            </div>
          )
        )}
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptName, setTranscriptName] = useState("");
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedMessage, setEmbedMessage] = useState("");

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const currentInput = input;
    setInput("");
    
    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentInput }),
      });
      const data = await res.json();
      setMessages((msgs) => [
        ...msgs,
        { sender: "bot", text: data.response },
      ]);
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { sender: "bot", text: "Error contacting server." },
      ]);
    }
    setLoading(false);
  };

  const embedTranscript = async () => {
    if (!transcript.trim()) {
      setEmbedMessage("Please enter a transcript to embed.");
      return;
    }
    
    setEmbedLoading(true);
    setEmbedMessage("");
    
    try {
      const res = await fetch("http://localhost:8000/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transcript: transcript,
          name: transcriptName.trim() || undefined
        }),
      });
      const data = await res.json();
      setEmbedMessage(data.message);
      if (data.message.includes("successfully")) {
        setTranscript(""); // Clear transcript on success
        setTranscriptName(""); // Clear name on success
      }
    } catch (err) {
      setEmbedMessage("Error embedding transcript.");
    }
    setEmbedLoading(false);
  };

  return (
    <div className="container">
      <div className="main-box">
        <div className="chat-section">
          <h2>Ask questions about the transcripts here and up here is the response from the LLM</h2>
          <div className="chat-box">
            {messages.map((msg, i) => (
              <div key={i} className={msg.sender === "user" ? "user-msg" : "bot-msg"}>
                {msg.text}
              </div>
            ))}
            {loading && <div className="bot-msg">Thinking...</div>}
          </div>
        </div>
        <form className="chat-input-form" onSubmit={sendMessage}>
          <input
            className="question-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="This is the input box where you ask your questions"
          />
          <button type="submit" disabled={loading} className="send-btn">
            Send
          </button>
        </form>
      </div>
      <div className="side-boxes">
        <div className="embed-box">
          <div className="embed-text">
            Add transcripts by pasting text (for YouTube: copy transcript from '...' → 'Show transcript')
          </div>
          <input
            className="transcript-name-input"
            type="text"
            value={transcriptName}
            onChange={(e) => setTranscriptName(e.target.value)}
            placeholder="Enter transcript name (optional)"
          />
          <textarea
            className="transcript-input"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your transcript here..."
            rows={4}
          />
          {embedMessage && (
            <div className={`embed-message ${embedMessage.includes("successfully") ? "success" : "error"}`}>
              {embedMessage}
            </div>
          )}
          <button 
            className="embed-btn" 
            onClick={embedTranscript}
            disabled={embedLoading}
          >
            {embedLoading ? "Embedding..." : "Embed Transcript"}
          </button>
        </div>
        
        <div className="future-box">
          <TranscriptList />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);