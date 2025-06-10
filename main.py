import os
from dotenv import load_dotenv
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain_openai import OpenAIEmbeddings
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from langchain.tools import Tool
from langchain.agents import create_react_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain import hub
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import uuid

load_dotenv()

# Pull the ReAct prompt from LangChain Hub
hub_path = "hwchase17/react"
react_prompt = hub.pull(hub_path)
print("ReAct prompt loaded from hub:")
print(react_prompt)

# Create FastAPI app
app = FastAPI()

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings()

# Initialize Pinecone Vector Store
index_name = os.getenv("INDEX_NAME", "transcribe-app")
vectorstore = PineconeVectorStore(
    index_name=index_name,
    embedding=embeddings
)

def search_transcripts(query: str) -> str:
    """Search through stored transcripts in Pinecone for relevant information."""
    try:
        print(f"🔍 Searching transcripts for: '{query}'")
        
        if not query or not query.strip():
            return "Please provide a search query to find relevant transcript information."
        
        # Search in Pinecone vector store
        docs = vectorstore.similarity_search(query.strip(), k=5)
        
        if not docs:
            return "No relevant transcript information found for your query. Please add some transcripts first or try a different search term."
        
        # Extract content from documents with source info
        relevant_content = []
        for i, doc in enumerate(docs, 1):
            transcript_name = doc.metadata.get("name", "Unknown transcript")
            chunk_info = ""
            if doc.metadata.get("total_chunks", 1) > 1:
                chunk_idx = doc.metadata.get("chunk_index", 0)
                total_chunks = doc.metadata.get("total_chunks", 1)
                chunk_info = f" (part {chunk_idx + 1}/{total_chunks})"
            
            content_header = f"--- From: {transcript_name}{chunk_info} ---"
            relevant_content.append(f"{content_header}\n{doc.page_content}")
        
        context = "\n\n".join(relevant_content)
        result = f"Found {len(docs)} relevant sections:\n\n{context}"
        
        print(f"✅ Found {len(docs)} relevant sections for query: '{query}'")
        return result
        
    except Exception as e:
        error_msg = f"Error searching transcripts: {str(e)}"
        print(f"❌ {error_msg}")
        return error_msg

# Create the transcript search tool
transcript_tool = Tool(
    name="search_transcripts",
    description="Search through stored transcripts to find relevant information for answering questions. Input should be a search query string.",
    func=search_transcripts
)

# Create the agent using the ReAct prompt from the hub
agent = create_react_agent(llm, [transcript_tool], react_prompt)
agent_executor = AgentExecutor(
    agent=agent, 
    tools=[transcript_tool], 
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=5
)

@app.post("/chat")
async def chat(request: Request):
    """Chat endpoint that uses an agent with transcript search capability."""
    data = await request.json()
    user_message = data.get("message", "")
    if not user_message:
        return {"response": "No message provided."}
    
    try:
        # Use the agent instead of direct LLM
        response = agent_executor.invoke({"input": user_message})
        return {"response": response["output"]}
    except Exception as e:
        return {"response": f"Error processing request: {str(e)}"}

@app.post("/embed")
async def embed_transcript(request: Request):
    """Endpoint to store a transcript in Pinecone vector store with automatic chunking for large texts."""
    data = await request.json()
    transcript = data.get("transcript", "")
    transcript_name = data.get("name", "")
    metadata = data.get("metadata", {})
    
    if not transcript:
        return {"message": "No transcript provided."}
    
    try:
        # Generate base metadata
        transcript_id = str(uuid.uuid4())
        base_name = transcript_name or f"Transcript_{transcript_id[:8]}"
        
        # Initialize text splitter for large transcripts
        # Using smaller chunks to stay well under Pinecone's 40KB limit
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=3000,  # ~3KB per chunk (leaves room for metadata)
            chunk_overlap=200,  # 200 char overlap to maintain context
            length_function=len,
            separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""]
        )
        
        # Split the transcript into chunks
        chunks = text_splitter.split_text(transcript)
        
        print(f"Split transcript into {len(chunks)} chunks")
        
        # Create documents for each chunk
        documents = []
        for i, chunk in enumerate(chunks):
            chunk_metadata = {
                "id": str(uuid.uuid4()),
                "transcript_id": transcript_id,  # Link all chunks to same transcript
                "type": "transcript",
                "name": base_name,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "chunk_size": len(chunk),
                "total_length": len(transcript),
                **metadata  # Allow additional metadata from the request
            }
            
            doc = Document(
                page_content=chunk,
                metadata=chunk_metadata
            )
            documents.append(doc)
        
        # Add all documents to Pinecone
        vectorstore.add_documents(documents)
        
        # Return summary information
        return {
            "message": f"Transcript embedded successfully! Split into {len(chunks)} chunks for optimal search.",
            "transcript_name": base_name,
            "transcript_id": transcript_id,
            "total_chunks": len(chunks),
            "total_length": len(transcript),
            "chunk_info": f"Each chunk is ~{chunks[0].__len__() if chunks else 0}-{max(len(c) for c in chunks) if chunks else 0} characters"
        }
    except Exception as e:
        print(f"Error embedding transcript: {str(e)}")
        return {"message": f"Error embedding transcript: {str(e)}"}

@app.get("/list-transcripts")
async def list_transcripts():
    """Endpoint to see what transcripts are stored in the vector store."""
    try:
        # Perform a broad search to get some documents from the vector store
        # This is a workaround since Pinecone doesn't have a direct "list all" method
        docs = vectorstore.similarity_search("", k=100)  # Get up to 100 documents
        
        if not docs:
            return {"message": "No transcripts found in vector store.", "transcripts": []}
        
        # Group chunks by transcript_id
        transcript_groups = {}
        
        for doc in docs:
            transcript_id = doc.metadata.get("transcript_id", doc.metadata.get("id", "unknown"))
            
            if transcript_id not in transcript_groups:
                transcript_groups[transcript_id] = {
                    "chunks": [],
                    "name": doc.metadata.get("name", "Unnamed"),
                    "type": doc.metadata.get("type", "unknown"),
                    "total_length": doc.metadata.get("total_length", 0),
                    "total_chunks": doc.metadata.get("total_chunks", 1),
                    "metadata": {k: v for k, v in doc.metadata.items() 
                               if k not in ["id", "transcript_id", "name", "type", "chunk_index", 
                                          "total_chunks", "chunk_size", "total_length"]}
                }
            
            transcript_groups[transcript_id]["chunks"].append({
                "chunk_index": doc.metadata.get("chunk_index", 0),
                "content": doc.page_content,
                "chunk_size": len(doc.page_content)
            })
        
        # Create summary for each transcript
        transcript_info = []
        for transcript_id, group in transcript_groups.items():
            # Sort chunks by index
            group["chunks"].sort(key=lambda x: x["chunk_index"])
            
            # Create preview from first chunk
            first_chunk = group["chunks"][0]["content"] if group["chunks"] else ""
            preview = first_chunk[:100] + "..." if len(first_chunk) > 100 else first_chunk
            
            transcript_info.append({
                "id": transcript_id,
                "name": group["name"],
                "type": group["type"],
                "total_length": group["total_length"] or sum(chunk["chunk_size"] for chunk in group["chunks"]),
                "total_chunks": len(group["chunks"]),
                "preview": preview,
                "metadata": group["metadata"]
            })
        
        return {
            "message": f"Found {len(transcript_info)} transcripts in vector store.",
            "total_transcripts": len(transcript_info),
            "transcripts": transcript_info
        }
    except Exception as e:
        return {"message": f"Error listing transcripts: {str(e)}", "transcripts": []}

@app.post("/search-transcripts")
async def search_transcripts_endpoint(request: Request):
    """Endpoint to search transcripts with more detailed results."""
    data = await request.json()
    query = data.get("query", "")
    limit = data.get("limit", 5)
    
    if not query:
        return {"message": "No search query provided.", "results": []}
    
    try:
        # Search in Pinecone vector store
        docs = vectorstore.similarity_search(query, k=limit)
        
        if not docs:
            return {"message": "No relevant transcripts found.", "results": []}
        
        # Format results with metadata
        results = []
        for doc in docs:
            results.append({
                "id": doc.metadata.get("id", "unknown"),
                "name": doc.metadata.get("name", "Unnamed"),
                "content": doc.page_content,
                "metadata": doc.metadata
            })
        
        return {
            "message": f"Found {len(results)} relevant transcript(s).",
            "results": results
        }
    except Exception as e:
        return {"message": f"Error searching transcripts: {str(e)}", "results": []}

@app.get("/")
async def root():
    """Health check endpoint."""
    try:
        # Try to get some stats from Pinecone (optional)
        return {"message": "Transcribe App is running with Pinecone integration!"}
    except Exception as e:
        return {"message": f"Transcribe App is running, but Pinecone connection issue: {str(e)}"}

if __name__ == "__main__":
    print("Starting Transcribe App with Pinecone Vector Store...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    

