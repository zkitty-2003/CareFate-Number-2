from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

app = FastAPI()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get current directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# API Routes (Placeholder for future)
@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Email Configuration (USER MUST UPDATE THESE)
# To use Gmail: https://myaccount.google.com/apppasswords to get an App Password
SENDER_EMAIL = "carefate.demo@gmail.com"  # New email you created
SENDER_PASSWORD = "hwhn subl zvyf cavs"    # App Password from User
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class ReportRequest(BaseModel):
    email: str
    report_html: str

@app.post("/api/send-report")
async def send_report(request: ReportRequest):
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = request.email
        msg['Subject'] = "CareFate: สรุปรายงานสุขภาพประจำเดือน"

        msg.attach(MIMEText(request.report_html, 'html'))

        # Connect to server
        # Note: This is wrapped in try/except to catch auth errors clearly
        if SENDER_EMAIL == "carefatedemo@gmail.com":
             # Simulation mode if credentials aren't set
             print(f"SIMULATION EMAIL TO: {request.email}")
             print(f"CONTENT: {request.report_html[:100]}...")
             return {"status": "success", "mode": "simulation", "message": "Email simulated (Configure credentials in main.py)"}

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        text = msg.as_string()
        server.sendmail(SENDER_EMAIL, request.email, text)
        server.quit()

        return {"status": "success", "message": "Email sent successfully"}
    except Exception as e:
        print(f"Email Error: {e}")
        return {"status": "error", "message": str(e)}

# Serve specific HTML files explicitly to avoid caching/routing issues
@app.get("/")
async def read_index():
    return FileResponse(os.path.join(BASE_DIR, 'index.html'))

@app.get("/dashboard.html")
async def read_dashboard():
    return FileResponse(os.path.join(BASE_DIR, 'dashboard.html'))

@app.get("/feature-excretion.html")
async def read_excretion():
    return FileResponse(os.path.join(BASE_DIR, 'feature-excretion.html'))

@app.get("/history.html")
async def read_history():
    return FileResponse(os.path.join(BASE_DIR, 'history.html'))

@app.get("/settings.html")
async def read_settings():
    return FileResponse(os.path.join(BASE_DIR, 'settings.html'))

# Mount Static Files (Catch-all for CSS, JS, Images, other HTMLs)
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print(f"Starting CareFate FastAPI Server...")
    print(f"Serving files from: {BASE_DIR}")
    uvicorn.run(app, host="127.0.0.1", port=8000)
