from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv

# Load environment variables (.env overrides OS-level env vars)
load_dotenv(override=True)

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

# Email Configuration
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

if SENDER_EMAIL and SENDER_PASSWORD:
    print(f"✅ Email Credentials loaded: {SENDER_EMAIL[:3]}***@{SENDER_EMAIL.split('@')[-1]}")
else:
    print("⚠️  Email Credentials MISSING. Running in Simulation Mode.")

from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class ReportRequest(BaseModel):
    email: str
    report_html: str

# # --- AI Configuration & Service Layer ---
import json
import time
import urllib.request
import urllib.error
import random
from datetime import datetime
from typing import List, Dict, Optional

# Load keys
OPENROUTER_API_KEY = (os.getenv("OPENROUTER_API_KEY") or "").strip()
GEMINI_API_KEY     = (os.getenv("GEMINI_API_KEY") or "").strip()
GROQ_API_KEY       = (os.getenv("GROQ_API_KEY") or "").strip()

# Global state for AI stability
COOLDOWNS: Dict[str, float] = {}  # model_id -> expiry_timestamp
DISABLED_MODELS: set = set()      # models that hit 402 billing limits

# 3-Layer Fallback Configuration
PRIORITY_MODELS = [
    # Layer 1: Groq Primary (Extremely fast)
    # Using more stable/available IDs
    {"provider": "groq",       "id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq)"},
    {"provider": "groq",       "id": "llama-3.1-70b-versatile", "name": "Llama 3.1 70B (Groq)"},
    {"provider": "groq",       "id": "llama3-70b-8192",         "name": "Llama 3 70B (Groq)"},
    {"provider": "groq",       "id": "llama-3.1-8b-instant",    "name": "Llama 3.1 8B (Groq)"},

    # Layer 2: OpenRouter (If Groq fails)
    {"provider": "openrouter", "id": "openai/gpt-4o-mini", "name": "GPT-4o Mini"},
    {"provider": "openrouter", "id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash (Paid)"},
    
    # Layer 3: Emergency Fallback (Free / High rate-limit models)
    {"provider": "openrouter", "id": "deepseek/deepseek-r1-distill-llama-70b:free", "name": "DeepSeek R1 (Free)"},
    {"provider": "openrouter", "id": "meta-llama/llama-3.1-8b-instruct:free", "name": "Llama 3.1 8B (Free)"},
    {"provider": "openrouter", "id": "google/gemma-3-27b-it:free", "name": "Gemma 3 27B (Free)"},
    {"provider": "gemini",     "id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
]

def startup_check():
    if GROQ_API_KEY:
        print(f"✅ Groq Key loaded: {GROQ_API_KEY[:10]}...")
    if GEMINI_API_KEY:
        print(f"✅ Gemini Key loaded: {GEMINI_API_KEY[:10]}...")
    if OPENROUTER_API_KEY:
        print(f"✅ OpenRouter Key loaded: {OPENROUTER_API_KEY[:12]}...{OPENROUTER_API_KEY[-4:]}")
    if not any([GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY]):
        print("⚠️  No AI keys found. AI features will not work.")

startup_check()

def log_ai_event(provider: str, model: str, result: str, start_time: float):
    latency = round(time.time() - start_time, 2)
    print(f"[AI] {provider:10} | {model:40} | {result:15} | {latency}s")

def _call_gemini_api(model_id: str, messages: List[Dict]) -> str:
    system_text = " ".join(m["content"] for m in messages if m["role"] == "system")
    user_text   = next((m["content"] for m in messages if m["role"] == "user"), "")
    combined    = f"{system_text}\n\n{user_text}" if system_text else user_text
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": combined}]}],
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.8}
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["candidates"][0]["content"]["parts"][0]["text"]

def _call_groq_api(model_id: str, messages: List[Dict]) -> str:
    payload = {"model": model_id, "messages": messages}
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]

def _call_openrouter_api(model_id: str, messages: List[Dict]) -> str:
    payload = {"model": model_id, "messages": messages}
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "CareFate"
        }
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]

def call_ai(messages: List[Dict]) -> str:
    """Unified AI orchestrator with 3-layer fallback, retries, and cooldowns."""
    for model_info in PRIORITY_MODELS:
        model_id = model_info["id"]
        provider = model_info["provider"]
        model_name = model_info["name"]

        # Check model availability
        if model_id in DISABLED_MODELS:
            print(f"DEBUG: Skipping {model_name} (Permanently Disabled)")
            continue
        if model_id in COOLDOWNS and time.time() < COOLDOWNS[model_id]:
            rem = int(COOLDOWNS[model_id] - time.time())
            print(f"DEBUG: Skipping {model_name} (Cooldown: {rem}s)")
            continue

        # Check API Keys
        if provider == "groq" and not GROQ_API_KEY:
            print(f"DEBUG: Skipping {model_name} (GROQ_API_KEY Missing)")
            continue
        if provider == "gemini" and not GEMINI_API_KEY:
            print(f"DEBUG: Skipping {model_name} (GEMINI_API_KEY Missing)")
            continue
        if provider == "openrouter" and not OPENROUTER_API_KEY:
            print(f"DEBUG: Skipping {model_name} (OPENROUTER_API_KEY Missing)")
            continue

        start_time = time.time()
        for attempt in range(2):  # Try same model up to 2 times on 429
            try:
                if provider == "groq":
                    reply = _call_groq_api(model_id, messages)
                elif provider == "gemini":
                    reply = _call_gemini_api(model_id, messages)
                else:
                    reply = _call_openrouter_api(model_id, messages)
                
                log_ai_event(provider, model_id, "SUCCESS", start_time)
                return reply

            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8")
                
                if e.code == 429:  # Rate Limit
                    if attempt == 0:
                        print(f"⚠️  {model_name} rate-limited, waiting 2s...")
                        time.sleep(2)
                        continue
                    else:
                        print(f"⚠️  {model_name} still rate-limited, entering 5m cooldown.")
                        COOLDOWNS[model_id] = time.time() + 300
                
                elif e.code == 402:  # Payment Required / Billing Limit
                    print(f"❌ {model_name} billing limit reached. Disabling.")
                    DISABLED_MODELS.add(model_id)
                
                else:  # Other HTTP errors (400, 404, 500, 503)
                    print(f"⚠️  {model_name} error {e.code}. Entering 5m cooldown.")
                    COOLDOWNS[model_id] = time.time() + 300
                
                log_ai_event(provider, model_id, f"HTTP_{e.code}", start_time)
                break  # Move to next model in priority list

            except Exception as e:
                print(f"⚠️  {model_name} unexpected error: {e}")
                COOLDOWNS[model_id] = time.time() + 300
                log_ai_event(provider, model_id, "EXCEPTION", start_time)
                break

    # If everything fails
    print("🚨 FATAL: All AI models exhausted or unavailable.")
    return "ขออภัยครับ ระบบอาจล่าช้าเล็กน้อย กรุณาลองใหม่อีกครั้งในภายหลังนะครับ"

class ChatRequest(BaseModel):
    message: str
    theme: str # 'youth', 'working', 'elder'
    username: str = "เพื่อน" # ชื่อผู้ใช้ (default fallback)
    history_context: str = "" # Optional historical data summary
    chat_messages: List[Dict] = [] # บทสนทนาย้อนหลัง [{role, content}]

@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    # Define System Prompts
    name_note = f"ชื่อ account ของผู้ใช้คือ '{request.username}' แต่ถ้าผู้ใช้บอกชื่อหรือชื่อเล่นในบทสนทนา **ให้ใช้ชื่อนั้นทันทีและจำไว้ตลอดการสนทนา** อย่าลืมไม่ว่ากี่ข้อความก็ตาม"
    system_prompts = {
        'youth': f"You represent 'P\u2019CareFate', a cheerful, energetic AI assistant for teenagers. {name_note} Use casual Thai slang, emojis, be encouraging and fun. Keep responses short and lively. Speak in Thai.",
        'working': f"You are 'CareFate Assistant', a professional, efficient, and polite AI for working adults. {name_note} Be concise, informative, and helpful. Use formal but friendly Thai.",
        'elder': f"You are 'Nong CareFate', a respectful, warm grandchild-like assistant for elderly people. {name_note} Use very polite Thai, simple words, be patient and caring. Speak in Thai."
    }
    
    system_content = system_prompts.get(request.theme, system_prompts['working'])

    # Personalization Logic
    context_instruction = ""
    if request.history_context:
        context_instruction = f"\n\nHere is some recent health data for this user:\n{request.history_context}\nUse this data to provide specific, personalized advice if relevant to the user's message."

    # Build messages with conversation history for memory
    messages = [{"role": "system", "content": system_content + context_instruction}]
    
    # Append previous turns (limit to last 10 to avoid token overflow)
    for turn in request.chat_messages[-10:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    
    # Append current user message
    messages.append({"role": "user", "content": request.message})
    try:
        reply = call_ai(messages)
        return {"status": "success", "reply": reply}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class HoroscopeRequest(BaseModel):
    theme: str
    history_context: str = ""

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

    # Personalization Logic
    context_instruction_horo = ""
    if request.history_context:
        context_instruction_horo = f"\n\nRECENT USER DATA:\n{request.history_context}\nIf the data shows any issues (like poor sleep or digestive problems), include a gentle reminder or protective advice in the 'advice' section of the horoscope."

    # System prompt for horoscope
    system_prompt = f"""
    You are a mystical but scientific health fortune teller backend for 'CareFate'.
    Today is {today}.
    
    Task: Generate a 'Daily Health Horoscope' for a user with theme '{request.theme}'.
    
    Guidelines:
    1. Start by predicting a 'Lucky Color' for health today.
    2. Give a short, 1-2 sentence health advice based on general wellness or weather (assume tropical/Thai context).
    3. IMPORTANT: {specific_instruction}
    4. {context_instruction_horo}
    5. Output format MUST be simple text. 
    
    Language: Thai.
    """

    horo_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "ขอคำทำนายดวงสุขภาพวันนี้หน่อยครับ"}
    ]
    try:
        reply = call_ai(horo_messages)
        print(f"DEBUG: Horoscope Success: {reply[:50]}...")
        return {"status": "success", "horoscope": reply}
    except Exception as e:
        print(f"DEBUG: Horoscope Error: {str(e)}")
        
        # Theme-specific Fallbacks
        fallbacks = {
            'youth': [
                "สีมงคลคือสีชมพู... วันนี้ตื่นมาหน้าใสวิ้ง! อย่าลืมทากันแดดก่อนออกจากบ้านนะวัยรุ่น",
                "สีมงคลคือสีส้ม... พลังงานล้นเหลือ! วันนี้ลองไปวิ่งสวนสาธารณะดูสิ เจอเนื้อคู่ไม่รู้ด้วยนะ",
                "สีมงคลคือสีฟ้า... วันนี้สดใสเว่อร์! ดื่มน้ำเยอะๆ ผิวจะได้เด้งๆ นะคะ"
            ],
            'working': [
                "สีมงคลคือสีเขียว... วันนี้งานยุ่งแค่ไหนก็อย่าลืมลุกเดินบ้าง ระวังออฟฟิศซินโดรมถามหานะครับ",
                "สีมงคลคือสีม่วง... เครียดงานให้พักสายตา จิบกาแฟเบาๆ แล้วลุยต่อนะครับ สู้ๆ!",
                "สีมงคลคือสีน้ำเงิน... วันนี้การเจรจาดี แต่ระวังปวดคอบ่าไหล่ ยืดเส้นยืดสายหน่อยนะ"
            ],
            'elder': [
                "สีมงคลคือสีขาว... วันนี้อากาศเปลี่ยนแปลง คุณตุณยายห่มผ้าหนาๆ ระวังเป็นหวัดนะครับ",
                "สีมงคลคือสีทอง... วันนี้สุขภาพแข็งแรงดี ลองเดินแกว่งแขนเบาๆ หน้าบ้านรับแดดเช้านะครับ",
                "สีมงคลคือสีครีม... ระวังลื่นในห้องน้ำนะครับ เดินเหินช้าๆ แต่ความดันปกติ แข็งแรงครับ"
            ]
        }
        
        tips = fallbacks.get(request.theme, fallbacks['working'])
        import random
        fallback_msg = random.choice(tips)
        
        return {"status": "success", "horoscope": fallback_msg}



class HealthSummaryRequest(BaseModel):
    theme: str = "working"
    username: str = "ผู้ใช้"
    health_context: str = ""

@app.post("/api/health-summary")
async def get_health_summary(request: HealthSummaryRequest):
    """AI วิเคราะห์ข้อมูลสุขภาพ 7 วันและสรุปเป็น bullet points"""
    print(f"DEBUG: Health Summary Request for user '{request.username}' theme '{request.theme}'")

    if not request.health_context or request.health_context.strip() == "":
        # No data yet — return encouraging default
        defaults = {
            'youth': "ยังไม่มีข้อมูลสุขภาพ ลองบันทึกข้อมูลแรกดูสิ! 💪",
            'working': "ยังไม่มีข้อมูลสุขภาพในช่วง 7 วันที่ผ่านมา เริ่มบันทึกได้เลยครับ",
            'elder': "ยังไม่มีข้อมูลสุขภาพครับ ลองบันทึกยาหรือนัดหมอก่อนนะครับ"
        }
        return {"status": "success", "summary": defaults.get(request.theme, defaults['working']), "bullets": []}

    persona_tone = {
        'youth': "ใช้ภาษาเป็นกันเอง มีอมยิ้ม emoji สนุกสนาน",
        'working': "ใช้ภาษาสุภาพ กระชับ มืออาชีพ",
        'elder': "ใช้ภาษาสุภาพมาก อ่านง่าย ตรงประเด็น"
    }

    system_prompt = f"""คุณคือผู้ช่วยสุขภาพ AI ของแอป CareFate
ผู้ใช้ชื่อ: {request.username}
รูปแบบการตอบ: {persona_tone.get(request.theme, persona_tone['working'])}

วิเคราะห์ข้อมูลสุขภาพ 7 วันที่ผ่านมา แล้วสรุปเป็น **3 ข้อสั้นๆ** ในรูปแบบนี้เท่านั้น:
• [สิ่งที่ดี หรือสิ่งที่น่าเป็นห่วง]
• [สิ่งที่ดี หรือสิ่งที่น่าเป็นห่วง]  
• [คำแนะนำ 1 ข้อ]

ห้ามพูดถึงข้อมูลที่ไม่มีในบริบท ถ้าข้อมูลน้อยให้บอกตรงๆ ใช้ภาษาไทยเท่านั้น ห้ามมีหัวข้อหรือคำอธิบายเพิ่มเติม"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"ข้อมูลสุขภาพ 7 วันล่าสุด:\n{request.health_context}\n\nกรุณาสรุป 3 ข้อ"}
    ]

    try:
        reply = call_ai(messages)
        print(f"DEBUG: Health Summary Success: {reply[:80]}...")
        return {"status": "success", "summary": reply}
    except Exception as e:
        print(f"DEBUG: Health Summary Error: {str(e)}")
        return {"status": "success", "summary": "ไม่สามารถวิเคราะห์ข้อมูลสุขภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"}


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
        if not SENDER_EMAIL or not SENDER_PASSWORD:
             # Simulation mode if credentials aren't set
             print(f"SIMULATION EMAIL TO: {request.email}")
             print(f"CONTENT: {request.report_html[:100]}...")
             return {"status": "success", "mode": "simulation", "message": "Email simulated (Configure credentials in main.py)"}

        print(f"[Email] Attempting to connect to {SMTP_SERVER}:{SMTP_PORT}...")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        print("[Email] Starting TLS...")
        server.starttls()
        print(f"[Email] Logging in as {SENDER_EMAIL}...")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        text = msg.as_string()
        print(f"[Email] Sending email to {request.email}...")
        server.sendmail(SENDER_EMAIL, request.email, text)
        server.quit()
        print("[Email] ✅ Sent successfully.")

        return {"status": "success", "message": "Email sent successfully"}
    except smtplib.SMTPAuthenticationError:
        print("[Email] ❌ Auth Error: Check SENDER_EMAIL/PASSWORD.")
        return {"status": "error", "message": "SMTP Authentication failed. Check credentials."}
    except Exception as e:
        print(f"[Email] ❌ Error: {str(e)}")
        return {"status": "error", "message": f"Server error: {str(e)}"}
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

# Explicit Static File Routes (Fix for Render/Deployment issues)
@app.get("/style.css")
async def read_css():
    return FileResponse(os.path.join(BASE_DIR, 'style.css'))

@app.get("/script.js")
async def read_script():
    return FileResponse(os.path.join(BASE_DIR, 'script.js'))

@app.get("/register.js")
async def read_register_js():
    return FileResponse(os.path.join(BASE_DIR, 'register.js'))

@app.get("/settings.js")
async def read_settings_js():
    return FileResponse(os.path.join(BASE_DIR, 'settings.js'))

@app.get("/notifications.js")
async def read_notifications_js():
    return FileResponse(os.path.join(BASE_DIR, 'notifications.js'))

@app.get("/manifest.json")
async def read_manifest():
    return FileResponse(os.path.join(BASE_DIR, 'manifest.json'))

# Explicit HTML Routes
@app.get("/register.html")
async def read_register():
    return FileResponse(os.path.join(BASE_DIR, 'register.html'))

@app.get("/theme-selection.html")
async def read_theme_selection():
    return FileResponse(os.path.join(BASE_DIR, 'theme-selection.html'))

@app.get("/feature-selection.html")
async def read_feature_selection():
    return FileResponse(os.path.join(BASE_DIR, 'feature-selection.html'))

# Generic route for all feature pages
@app.get("/feature-{name}.html")
async def read_feature_page(name: str):
    file_path = os.path.join(BASE_DIR, f"feature-{name}.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"status": "error", "message": "Feature page not found"}

@app.get("/debug-files")
def debug_files():
    import os
    files = os.listdir(BASE_DIR)
    return {
        "base_dir": BASE_DIR,
        "files_count": len(files),
        "files": files[:20], # Show first 20 files
        "index_exists": os.path.exists(os.path.join(BASE_DIR, "index.html"))
    }

# Mount Static Files (Catch-all for CSS, JS, Images, other HTMLs)
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print(f"Starting CareFate FastAPI Server...")
    print(f"Serving files from: {BASE_DIR}")
    # Use 0.0.0.0 for Render/Docker compatibility
    uvicorn.run(app, host="0.0.0.0", port=8000)
