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

# --- OpenRouter AI Integration ---
import json
import urllib.request
import urllib.error
import random
from datetime import datetime

# PASTE YOUR OPENROUTER KEY HERE
OPENROUTER_API_KEY = "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" 
OPENROUTER_MODEL = "google/gemma-3-27b-it:free"

def call_openrouter(messages):
    if OPENROUTER_API_KEY == "sk-or-v1-..." or not OPENROUTER_API_KEY:
         raise Exception("Please configure OPENROUTER_API_KEY in main.py")

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages
    }

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "CareFate Local"
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']

class ChatRequest(BaseModel):
    message: str
    theme: str # 'youth', 'working', 'elder'

@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    # Define System Prompts
    system_prompts = {
        'youth': "You represent 'P'CareFate', a cheerful, energetic AI assistant for teenagers. Use casual Thai slang, emojis, be encouraging and fun. Keep responses short and lively. Speak in Thai.",
        'working': "You are 'CareFate Assistant', a professional, efficient, and polite AI for working adults. Be concise, informative, and helpful. Use formal but friendly Thai.",
        'elder': "You are 'Nong CareFate', a respectful, warm grandchild-like assistant for elderly people. Use very polite Thai (Khun Ta/Khun Yai), simple words, be patient and caring. Speak in Thai."
    }
    
    system_content = system_prompts.get(request.theme, system_prompts['working'])

    try:
        reply = call_openrouter([
            {"role": "system", "content": system_content},
            {"role": "user", "content": request.message}
        ])
        return {"status": "success", "reply": reply}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class HoroscopeRequest(BaseModel):
    theme: str

@app.post("/api/horoscope")
async def get_horoscope(request: HoroscopeRequest):
    print(f"DEBUG: Horoscope Request for theme '{request.theme}'")
    today = datetime.now().strftime("%A %d %B %Y")
    
    # Theme-specific instructions
    persona_guide = {
        'youth': "Use teen slang (ปังมากแม่, ต้างม๊ากก), emojis, and focus on energy/skin/love. Be very casual and fun.",
        'working': "Focus on office syndrome, stress, coffee, and work-life balance. Be professional but empathetic.",
        'elder': "Focus on joints, sleep, blood pressure, and gentle exercise. Use polite/respectful language (หนูขอแนะนำ, คุณยายคะ)."
    }
    
    specific_instruction = persona_guide.get(request.theme, persona_guide['working'])

    # System prompt for horoscope
    system_prompt = f"""
    You are a mystical but scientific health fortune teller backend for 'CareFate'.
    Today is {today}.
    
    Task: Generate a 'Daily Health Horoscope' for a user with theme '{request.theme}'.
    
    Guidelines:
    1. Start by predicting a 'Lucky Color' for health today.
    2. Give a short, 1-2 sentence health advice based on general wellness or weather (assume tropical/Thai context).
    3. IMPORTANT: {specific_instruction}
    4. Output format MUST be simple text. 
    
    Language: Thai.
    """

    try:
        reply = call_openrouter([
             {"role": "system", "content": system_prompt},
             {"role": "user", "content": "ขอคำทำนายดวงสุขภาพวันนี้หน่อยครับ"}
        ])
        print(f"DEBUG: Horoscope Success: {reply[:50]}...")
        return {"status": "success", "horoscope": reply}
    except Exception as e:
        print(f"DEBUG: Horoscope Error: {str(e)}")
        
        # Theme-specific Fallbacks
        fallbacks = {
            'youth': [
                "สีมงคลคือสีชมพู... วันนี้ตื่นมาหน้าใสวิ้ง! อย่าลืมทากันแดดก่อนออกจากบ้านนะวัยรุ่น (ระบบหนาแน่น)",
                "สีมงคลคือสีส้ม... พลังงานล้นเหลือ! วันนี้ลองไปวิ่งสวนสาธารณะดูสิ เจอเนื้อคู่ไม่รู้ด้วยนะ (ระบบหนาแน่น)",
                "สีมงคลคือสีฟ้า... วันนี้สดใสเว่อร์! ดื่มน้ำเยอะๆ ผิวจะได้เด้งๆ นะคะ (ระบบหนาแน่น)"
            ],
            'working': [
                "สีมงคลคือสีเขียว... วันนี้งานยุ่งแค่ไหนก็อย่าลืมลุกเดินบ้าง ระวังออฟฟิศซินโดรมถามหานะครับ (ระบบหนาแน่น)",
                "สีมงคลคือสีม่วง... เครียดงานให้พักสายตา จิบกาแฟเบาๆ แล้วลุยต่อนะครับ สู้ๆ! (ระบบหนาแน่น)",
                "สีมงคลคือสีน้ำเงิน... วันนี้การเจรจาดี แต่ระวังปวดคอบ่าไหล่ ยืดเส้นยืดสายหน่อยนะ (ระบบหนาแน่น)"
            ],
            'elder': [
                "สีมงคลคือสีขาว... วันนี้อากาศเปลี่ยนแปลง คุณตุณยายห่มผ้าหนาๆ ระวังเป็นหวัดนะครับ (ระบบหนาแน่น)",
                "สีมงคลคือสีทอง... วันนี้สุขภาพแข็งแรงดี ลองเดินแกว่งแขนเบาๆ หน้าบ้านรับแดดเช้านะครับ (ระบบหนาแน่น)",
                "สีมงคลคือสีครีม... ระวังลื่นในห้องน้ำนะครับ เดินเหินช้าๆ แต่ความดันปกติ แข็งแรงครับ (ระบบหนาแน่น)"
            ]
        }
        
        tips = fallbacks.get(request.theme, fallbacks['working'])
        import random
        fallback_msg = random.choice(tips)
        
        return {"status": "success", "horoscope": fallback_msg}



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
