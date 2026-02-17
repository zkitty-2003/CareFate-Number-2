import os
import sys
import webbrowser
import time
import subprocess

# Define the command to run the FastAPI server
# We use standard 'python' command assuming it's in path
cmd = [sys.executable, "main.py"]

print("------------------------------------------------")
print("   Starting CareFate Server (FastAPI)")
print("------------------------------------------------")
print("1. Opening Browser...")
# Open browser slightly delayed to let server start
def open_browser():
    time.sleep(2)
    webbrowser.open("http://localhost:8000/index.html")

import threading
threading.Thread(target=open_browser).start()

print("2. Running Server (Press Ctrl+C to stop)...")
try:
    subprocess.run(cmd)
except KeyboardInterrupt:
    print("\nServer stopped.")
