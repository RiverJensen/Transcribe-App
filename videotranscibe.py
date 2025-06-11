import os
from dotenv import load_dotenv
from whisper import Whisper
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

if __name__ == "__main__":
    print("Starting video transcription...")


    # Initialize OpenAI client
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Initialize Whisper model
    model = Whisper("base")

    # Get video file path from environment variable
    video_path = os.getenv("VIDEO_PATH")

    if not video_path:
        raise ValueError("VIDEO_PATH environment variable is not set")

    # Transcribe the video
    result = model.transcribe(video_path)

    # Save the transcription to a file
    with open("transcription.txt", "w") as f:
        f.write(result["text"])

    print("Video transcription complete")

    # Print the transcription
    print(result["text"])

