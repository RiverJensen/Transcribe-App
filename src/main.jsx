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

function VideoTranscribe({ onBackToMain }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptData, setTranscriptData] = useState(null);
  const [customName, setCustomName] = useState("");
  const [embedding, setEmbedding] = useState(false);
  const [embedMessage, setEmbedMessage] = useState("");

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    const allowedTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo',
      'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/flac'
    ];
    
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp4|avi|mov|mkv|mp3|wav|m4a|flac)$/i)) {
      alert("Please select a video or audio file (MP4, AVI, MOV, MKV, MP3, WAV, M4A, FLAC)");
      return;
    }
    
    if (selectedFile.size > 200 * 1024 * 1024) { // 200MB limit
      alert("File too large. Maximum size is 200MB.");
      return;
    }
    
    setFile(selectedFile);
    setTranscript("");
    setTranscriptData(null);
    setEmbedMessage("");
  };

  const transcribeVideo = async () => {
    if (!file) return;
    
    setTranscribing(true);
    setTranscript("");
    setTranscriptData(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://localhost:8000/transcribe-video", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        setTranscript(data.transcript);
        setTranscriptData(data);
        setCustomName(data.filename.replace(/\.[^/.]+$/, "")); // Remove file extension
      } else {
        alert(data.message || "Transcription failed");
      }
    } catch (err) {
      alert("Error during transcription. Please try again.");
      console.error(err);
    }
    
    setTranscribing(false);
  };

  const embedTranscript = async () => {
    if (!transcript || !transcriptData) return;
    
    setEmbedding(true);
    setEmbedMessage("");
    
    try {
      const res = await fetch("http://localhost:8000/embed-video-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript,
          filename: transcriptData.filename,
          duration: transcriptData.duration,
          language: transcriptData.language,
          custom_name: customName
        }),
      });
      
      const data = await res.json();
      setEmbedMessage(data.message);
      
      if (data.message.includes("successfully")) {
        setTimeout(() => {
          onBackToMain();
        }, 2000);
      }
    } catch (err) {
      setEmbedMessage("Error embedding transcript. Please try again.");
      console.error(err);
    }
    
    setEmbedding(false);
  };

  return (
    <div className="video-transcribe">
      <div className="header">
        <button className="back-btn" onClick={onBackToMain}>
          ← Back to Chat
        </button>
        <h2>Transcribe Video/Audio</h2>
      </div>

      <div className="upload-section">
        <div
          className={`upload-area ${dragActive ? "drag-active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <p>Drag and drop your video/audio file here</p>
            <p className="upload-formats">
              Supported: MP4, AVI, MOV, MKV, MP3, WAV, M4A, FLAC (max 200MB)
            </p>
            <input
              type="file"
              accept=".mp4,.avi,.mov,.mkv,.mp3,.wav,.m4a,.flac"
              onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
              style={{ display: "none" }}
              id="file-input"
            />
            <label htmlFor="file-input" className="upload-btn">
              Choose File
            </label>
          </div>
        </div>

        {file && (
          <div className="file-info">
            <p><strong>Selected:</strong> {file.name}</p>
            <p><strong>Size:</strong> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            <button 
              className="transcribe-btn" 
              onClick={transcribeVideo}
              disabled={transcribing}
            >
              {transcribing ? "Transcribing..." : "Transcribe"}
            </button>
          </div>
        )}
      </div>

      {transcript && (
        <div className="transcript-section">
          <h3>Transcript</h3>
          <div className="transcript-container">
            <div className="transcript-text">
              {transcript}
            </div>
          </div>

          <div className="embed-section">
            <h4>Save to Knowledge Base</h4>
            <div className="embed-form">
              <input
                type="text"
                placeholder="Custom name (optional)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="custom-name-input"
              />
              <button 
                className="embed-btn" 
                onClick={embedTranscript}
                disabled={embedding}
              >
                {embedding ? "Saving..." : "Save Transcript"}
              </button>
            </div>
            {embedMessage && (
              <div className={`embed-message ${embedMessage.includes("successfully") ? "success" : "error"}`}>
                {embedMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState("main");
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

  if (currentPage === "video") {
    return <VideoTranscribe onBackToMain={() => setCurrentPage("main")} />;
  }

  return (
    <div className="container">
      <div className="main-box">
        <div className="chat-section">
          <div className="chat-header">
            <h2>Ask questions about the transcripts here</h2>
            <button 
              className="video-transcribe-nav-btn"
              onClick={() => setCurrentPage("video")}
            >
              Transcribe a Video
            </button>
          </div>
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
            Add transcripts by pasting text 
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