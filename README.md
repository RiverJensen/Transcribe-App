# Transcribe App

A FastAPI-based application that provides transcription and semantic search capabilities for audio/video content.

## Features

- Video/Audio transcription using OpenAI's Whisper
- Semantic search through transcripts using Pinecone vector store
- Chat interface with transcript-aware responses
- Support for multiple file formats (mp4, avi, mov, mkv, mp3, wav, m4a, flac)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   INDEX_NAME=your_pinecone_index_name
   ```
4. Run the application:
   ```bash
   python main.py
   ```

## API Endpoints

- `POST /transcribe-video`: Upload and transcribe video/audio files
- `POST /embed-video-transcript`: Store transcript in vector database
- `POST /chat`: Chat with the AI about transcript content
- `GET /list-transcripts`: View all stored transcripts
- `POST /search-transcripts`: Search through transcripts

## Requirements

- Python 3.8+
- FastAPI
- OpenAI
- Pinecone
- Whisper
- Other dependencies listed in requirements.txt 