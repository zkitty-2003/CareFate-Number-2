from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv

# Load environment variables (.env overrides OS-level env vars)
load_dotenv(override=True)

from fortune_data import get_base_fortune

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

# Centralized External Horoscope API Integration
@app.get("/api/external/horoscope")
def get_external_horoscope(weekday: str, category: str):
    """
    Simulated External Horoscope API hosted on the central server.
    Returns raw daily horoscope prediction based on weekday of birth and category.
    """
    base_text = get_base_fortune(weekday, category)
    return {
        "status": "success",
        "weekday": weekday,
        "category": category,
        "horoscope": base_text
    }

@app.get("/api/external/horoscope/all")
def get_all_external_horoscope():
    """
    Returns the complete centralized pre-calculated horoscope database (all weekdays and categories)
    to serve as a comprehensive mock external data API resource.
    """
    from fortune_data import FORTUNE_DATABASE
    return {
        "status": "success",
        "description": "CareFate Centralized Mock External Horoscope Database - 35 Complete Datasets (7 Days x 5 Categories)",
        "total_records": len(FORTUNE_DATABASE) * 5,
        "database": FORTUNE_DATABASE
    }

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
    {"provider": "groq",       "id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq)"},
    {"provider": "groq",       "id": "llama-3.1-70b-versatile", "name": "Llama 3.1 70B (Groq)"},
    {"provider": "groq",       "id": "llama3-70b-8192",         "name": "Llama 3 70B (Groq)"},
    {"provider": "groq",       "id": "mixtral-8x7b-32768",      "name": "Mixtral 8x7B (Groq)"},
    {"provider": "groq",       "id": "gemma2-9b-it",            "name": "Gemma 2 9B (Groq)"},
    {"provider": "groq",       "id": "llama-3.1-8b-instant",    "name": "Llama 3.1 8B (Groq)"},
    {"provider": "groq",       "id": "llama-3.2-3b-preview",    "name": "Llama 3.2 3B (Groq)"},

    # Layer 2: Direct Gemini (Highly stable Google API - bypasses OpenRouter limits)
    {"provider": "gemini",     "id": "gemini-2.5-flash",        "name": "Gemini 2.5 Flash (Direct)"},
    {"provider": "gemini",     "id": "gemini-1.5-flash",        "name": "Gemini 1.5 Flash (Direct)"},
    {"provider": "gemini",     "id": "gemini-1.5-pro",          "name": "Gemini 1.5 Pro (Direct)"},

    # Layer 3: OpenRouter (If Groq and Direct Gemini are both rate-limited)
    {"provider": "openrouter", "id": "openai/gpt-4o-mini",      "name": "GPT-4o Mini (OpenRouter)"},
    {"provider": "openrouter", "id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash (Paid)"},
    {"provider": "openrouter", "id": "google/gemini-2.5-flash",  "name": "Gemini 2.5 Flash (OpenRouter)"},
    {"provider": "openrouter", "id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B (OpenRouter)"},
    {"provider": "openrouter", "id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B (OpenRouter)"},
    {"provider": "openrouter", "id": "deepseek/deepseek-chat",  "name": "DeepSeek V3 (OpenRouter)"},

    # Layer 4: Emergency Free Fallbacks on OpenRouter
    {"provider": "openrouter", "id": "deepseek/deepseek-r1-distill-llama-70b:free", "name": "DeepSeek R1 (Free)"},
    {"provider": "openrouter", "id": "meta-llama/llama-3.1-8b-instruct:free", "name": "Llama 3.1 8B (Free)"},
    {"provider": "openrouter", "id": "google/gemma-3-27b-it:free", "name": "Gemma 3 27B (Free)"},
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
    contents = []
    system_instruction_text = ""
    for m in messages:
        if m["role"] == "system":
            system_instruction_text = m["content"]
        else:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}]
            })
    
    if not contents:
        contents.append({
            "role": "user",
            "parts": [{"text": "สวัสดี"}]
        })
    
    payload = {}
    if system_instruction_text:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction_text}]
        }
    payload["contents"] = contents
    payload["generationConfig"] = {"maxOutputTokens": 2048, "temperature": 0.8}
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={GEMINI_API_KEY}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req, timeout=25) as resp:
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
    with urllib.request.urlopen(req, timeout=25) as resp:
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
            "HTTP-Referer": "https://carefate.onrender.com",
            "X-Title": "CareFate"
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
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
                import traceback
                print(f"⚠️  {model_name} unexpected error: {str(e)}")
                traceback.print_exc()
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
def chat_with_ai(request: ChatRequest):
    # Define System Prompts
    name_note = f"ชื่อ account ของผู้ใช้คือ '{request.username}' แต่ถ้าผู้ใช้บอกชื่อหรือชื่อเล่นในบทสนทนา **ให้ใช้ชื่อนั้นทันทีและจำไว้ตลอดการสนทนา** อย่าลืมไม่ว่ากี่ข้อความก็ตาม"
    system_prompts = {
        'youth': f"You represent 'P\u2019CareFate', a cheerful, energetic AI assistant for teenagers. {name_note} Use casual Thai slang, emojis, be encouraging and fun. Keep responses short and lively. Speak in Thai.",
        'working': f"You are 'CareFate Assistant', a professional, efficient, and polite AI for working adults. {name_note} Be concise, informative, and helpful. Use formal but friendly Thai.",
        'elder': f"You are 'Nong CareFate', a respectful, warm grandchild-like assistant for elderly people. {name_note} Use very polite Thai, simple words, be patient and caring. Speak in Thai."
    }
    
    disclaimer_note = "\n\nCRITICAL SAFETY WARNING: You are a general wellness assistant, NOT a medical doctor. Provide general health guidance and lifestyle advice only. Never diagnose illnesses, prescribe medication, or make clinical claims. If the user asks about serious symptoms, severe pain, or medical emergencies, explicitly state that you are an AI assistant and advise them to consult a certified medical doctor or visit a hospital immediately."
    system_content = system_prompts.get(request.theme, system_prompts['working']) + disclaimer_note

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
def get_horoscope(request: HoroscopeRequest):
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
class FortuneTellerRequest(BaseModel):
    teller_id: str
    username: str = "ผู้ใช้"
    history_context: str = ""
    birth_date: str = ""

@app.post("/api/fortune-teller")
def get_fortune_teller_prediction(request: FortuneTellerRequest):
    print(f"DEBUG: Fortune Teller Request: teller_id={request.teller_id}, username={request.username}, dob={request.birth_date}")
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")  # Used as seed key
    thai_days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
    day_colors = {
        "จันทร์":   "สีเหลือง",
        "อังคาร":   "สีชมพู",
        "พุธ":      "สีเขียว",
        "พฤหัสบดี": "สีส้ม",
        "ศุกร์":    "สีฟ้า",
        "เสาร์":    "สีม่วง",
        "อาทิตย์":  "สีแดง",
    }
    weekday_th = thai_days[now.weekday()]
    thai_date = now.strftime(f"วัน{weekday_th} ที่ %d/%m/%Y")

    # Calculate birth weekday if available
    birth_weekday_th = "ไม่ระบุ"
    if request.birth_date:
        try:
            b_date = datetime.strptime(request.birth_date, "%Y-%m-%d")
            birth_weekday_th = thai_days[b_date.weekday()]
        except Exception:
            pass

    # Astrology lucky colors database based on Birth Day of the Week
    astrology_colors = {
        "อาทิตย์": {
            "love": "สีเขียว",
            "finance": "สีม่วง หรือ สีดำ",
            "work": "สีชมพู",
            "health": "สีขาว หรือ สีเหลือง",
            "overall": "สีครีม"
        },
        "จันทร์": {
            "love": "สีดำ หรือ สีม่วง",
            "finance": "สีส้ม หรือ สีแสด",
            "work": "สีเขียว",
            "health": "สีชมพู",
            "overall": "สีฟ้า"
        },
        "อังคาร": {
            "love": "สีทอง หรือ สีแสด",
            "finance": "สีเทา",
            "work": "สีดำ หรือ สีม่วง",
            "health": "สีเขียว",
            "overall": "สีแดง"
        },
        "พุธ": {
            "love": "สีเทา หรือ สีบรอนซ์เงิน",
            "finance": "สีฟ้า หรือ สีน้ำเงิน",
            "work": "สีส้ม หรือ สีทอง",
            "health": "สีดำ หรือ สีม่วง",
            "overall": "สีเขียว"
        },
        "พฤหัสบดี": {
            "love": "สีแดง",
            "finance": "สีส้ม หรือ สีทอง",
            "work": "สีฟ้า หรือ สีน้ำเงิน",
            "health": "สีเทา",
            "overall": "สีขาว หรือ สีเหลือง"
        },
        "ศุกร์": {
            "love": "สีชมพู",
            "finance": "สีเขียว",
            "work": "สีส้ม หรือ สีเหลือง",
            "health": "สีแดง",
            "overall": "สีน้ำเงิน หรือ สีฟ้า"
        },
        "เสาร์": {
            "love": "สีน้ำเงิน หรือ สีฟ้า",
            "finance": "สีแดง",
            "work": "สีดำ หรือ สีม่วง",
            "health": "สีส้ม หรือ สีเหลือง",
            "overall": "สีเทา"
        }
    }

    # Determine lucky color based on birth weekday, or fall back to today's weekday color
    teller_key = request.teller_id if request.teller_id in ['love', 'finance', 'work', 'health', 'overall'] else 'overall'
    
    if birth_weekday_th in astrology_colors:
        lucky_color = astrology_colors[birth_weekday_th][teller_key]
    else:
        # Fallback to today's general day color
        lucky_color = day_colors[weekday_th]

    personas = {
        'love': {
            'name': 'แม่หมอจันทรา',
            'focus': 'ความรัก ความสัมพันธ์ เสน่ห์ และคนรอบข้าง',
            'tone': 'ใช้ภาษาเป็นกันเอง อบอุ่น มีคำว่า "นะคะ/ค่า" ให้กำลังใจ'
        },
        'finance': {
            'name': 'ซินแสเศรษฐี',
            'focus': 'การเงิน โชคลาภ การลงทุน และรายรับรายจ่าย',
            'tone': 'ใช้ภาษาหนักแน่น น่าเชื่อถือ เรียกผู้ใช้ว่า "เถ้าแก่" หรือ "เศรษฐี"'
        },
        'work': {
            'name': 'อาจารย์ดวงดาว',
            'focus': 'การงาน หน้าที่ ความสำเร็จ และอุปสรรคในที่ทำงาน',
            'tone': 'ใช้ภาษาแบบมืออาชีพ ชัดเจน มีความมุ่งมั่น'
        },
        'health': {
            'name': 'ผู้เฒ่าโอสถ',
            'focus': 'สุขภาพ ร่างกาย การพักผ่อน และการดูแลตัวเอง',
            'tone': 'ใช้ภาษาคนแก่ใจดี ห่วงใย เรียกผู้ใช้ว่า "หลานเอ๊ย" หรือ "ลูกเอ๊ย"'
        },
        'overall': {
            'name': 'เซนมาสเตอร์',
            'focus': 'ภาพรวมชีวิต สติปัญญา ความสงบ และการใช้ชีวิต',
            'tone': 'ใช้ภาษาปรัชญา ลุ่มลึก แฝงข้อคิด'
        }
    }

    persona = personas.get(request.teller_id, personas['love'])

    # Fetch base raw fortune from central server's horoscope API integration
    # To prevent static predictions, we rotate the selected base fortune daily based on the day of the month!
    thai_days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
    lookup_weekday = birth_weekday_th if birth_weekday_th != "ไม่ระบุ" else weekday_th
    
    if birth_weekday_th in thai_days:
        birth_idx = thai_days.index(birth_weekday_th)
        # Shift index deterministically based on day of month (1-31) to fetch different raw fortunes
        lookup_idx = (birth_idx + now.day) % 7
        lookup_weekday = thai_days[lookup_idx]
        
    base_horoscope = get_base_fortune(lookup_weekday, teller_key)
    
    # Dynamically customize the weekday name in the text to match the user's birth weekday
    # so they read a customized prediction without confusing contradictions!
    if birth_weekday_th != "ไม่ระบุ":
        base_horoscope = base_horoscope.replace(lookup_weekday, birth_weekday_th)

    # Generate the prediction directly without AI to achieve 0 token usage and 100% stability
    username = request.username if request.username else "คุณ"
    
    # Simple check in history context for matching keywords
    health_ctx_lower = (request.history_context or "").lower()
    
    health_tips = {
        'love': {
            'sleep': "ช่วงนี้เห็นบ่นว่านอนหลับไม่ค่อยดี อย่าลืมหาสมุนไพรอุ่นๆ ดื่มก่อนนอนและแบ่งเวลาพักผ่อนเยอะๆ นะคะ แม่หมอเป็นห่วงค่า ❤️",
            'exercise': "ช่วงนี้เหนื่อยล้าหรือออกกำลังกายหักโหมเกินไปหรือเปล่าคะ ค่อยๆ ไปทีละนิด ดูแลหัวใจตัวเองให้ชุ่มชื่นไว้เสมอนะคะ ✨",
            'stress': "ถ้ารู้สึกเครียดๆ หรือเหนื่อยล้า ลองปล่อยวางเรื่องรอบตัวลงสักนิด แล้วไปคุยกับคนที่คุณรักเพื่อเติมพลังใจนะคะ 🥰",
            'default': "วันนี้อย่าลืมดื่มน้ำสะอาดเยอะๆ และดูแลรักษาสุขภาพร่างกายให้สดชื่นแจ่มใสอยู่เสมอนะคะ"
        },
        'finance': {
            'sleep': "ช่วงนี้หากนอนไม่ค่อยหลับ ให้หาเวลาพักผ่อนสายตาบ้างนะครับเถ้าแก่ ร่างกายแข็งแรงสมองแล่น เงินทองจะได้ไหลมาเทมาไหลลื่นครับ 💰",
            'exercise': "สุขภาพกายที่ดีคือทุนทรัพย์ที่ประเมินค่าไม่ได้ครับ อย่าลืมออกกำลังกายเบาๆ เพื่อเสริมความกระปรี้กระเป่ารับทรัพย์ในวันนี้นะครับ",
            'stress': "การงานการลงทุนมีความเสี่ยง ถ้ารู้สึกตึงเกินไปให้ถอยมาตั้งหลักสักนิด จิตใจมั่นคงจะช่วยประคองพอร์ตให้เฮงๆ ครับ 💸",
            'default': "การลงทุนที่ดีที่สุดคือการดูแลตัวเองครับ วันนี้ดื่มน้ำและรักษาสุขภาพกายใจให้มั่นคงเพื่อพร้อมรับทรัพย์นะครับ"
        },
        'work': {
            'sleep': "ช่วงนี้อาจมีการพักผ่อนน้อยหรือนอนหลับไม่สนิท แนะนำให้จัดสรรเวลาพักสายตาและนอนหลับให้เต็มอิ่ม เพื่อรักษาระดับสมาธิและความเป็นมืออาชีพในการทำงานค่ะ 💻",
            'exercise': "การนั่งทำงานนานๆ อาจทำให้ปวดบ่าไหล่ แนะนำให้ทำกายบริหารยืดเส้นยืดสายระหว่างวันบ่อยๆ เพื่อป้องกันออฟฟิศซินโดรมและทำงานอย่างมีความสุขค่ะ 🌟",
            'stress': "งานรุมเร้าอาจทำให้ระดับความเครียดสูงขึ้น แนะนำให้หยุดพักหายใจเข้าลึกๆ สัก 5 นาทีก่อนลุยงานต่อ จะช่วยเพิ่มประสิทธิภาพและวิสัยทัศน์ที่กว้างไกลค่ะ",
            'default': "วันนี้ควรจัดสรรเวลาดื่มน้ำและขยับตัวยืดเส้นยืดสายทุกๆ 1 ชั่วโมง เพื่อสุขภาพร่างกายที่ดีและผลงานที่มีประสิทธิภาพสูงสุดค่ะ"
        },
        'health': {
            'sleep': "ปู่เห็นช่วงนี้บ่นว่านอนไม่หลับรึเปล่าหลานเอ๊ย ก่อนนอนห้ามดูจอโทรศัพท์นะหลาน ปรับไฟสลัวๆ ทำจิตใจให้ร่มเย็นปู่เป็นห่วงสุขภาพหลานเสมอนะ 👴",
            'exercise': "ออกกำลังกายขยับแข้งขยับขาเป็นเรื่องดี แต่ปู่อยากเตือนว่าระวังหัวเข่าและข้อต่อให้ดีนะเออ อย่าหักโหมจนเกินงามล่ะหลานรัก",
            'stress': "จิตใจที่ฟุ้งซ่านจะทำให้ธาตุในกายแปรปรวนนะหลานเอ๊ย ลองหลับตาสูดหายใจเข้าลึกๆ ปล่อยวางเรื่องหนักๆ ลงบ้าง สุขภาพจะได้ยืนยาวนะ",
            'default': "ดื่มน้ำอุ่นเยอะๆ นะหลานเอ๊ย วันนี้หลีกเลี่ยงน้ำเย็นและอาหารรสจัดเพื่อรักษาสมดุลธาตุในร่างกายให้ดีนะหลานรัก"
        },
        'overall': {
            'sleep': "ช่วงนี้หากการนอนหลับไม่ปกติ พึงระลึกว่าความสงบทางกายเริ่มต้นด้วยการสงบทางจิตใจ ก่อนนอนให้ปล่อยวางความกังวลทั้งปวงลงเสีย 🧘",
            'exercise': "การเคลื่อนไหวทางกายอย่างพอเหมาะและมีสติ จะนำมาซึ่งพลังชีวิตที่สมดุล หลีกเลี่ยงความสุดโต่งในกิจกรรมต่างๆ ในวันนี้",
            'stress': "ความเครียดเปรียบเสมือนหมอกควันชั่วคราว ลองมองสิ่งต่างๆ ด้วยความปล่อยวางและเข้าใจ จิตใจจะพบความสงบที่แท้จริง",
            'default': "วันนี้พึงรักษาความสงบในจิตใจ ดื่มน้ำสะอาด และก้าวเดินอย่างมีสติในทุกๆ ย่างก้าวของวัน"
        }
    }
    
    t_tips = health_tips.get(request.teller_id, health_tips['overall'])
    chosen_tip = t_tips['default']
    if any(k in health_ctx_lower for k in ['นอน', 'หลับ', 'sleep', 'insomnia']):
        chosen_tip = t_tips['sleep']
    elif any(k in health_ctx_lower for k in ['ออกกำลัง', 'เดิน', 'วิ่ง', 'exercise', 'sport', 'gym']):
        chosen_tip = t_tips['exercise']
    elif any(k in health_ctx_lower for k in ['เครียด', 'เหนื่อย', 'กังวล', 'stress', 'anxiety', 'busy']):
        chosen_tip = t_tips['stress']

    # 1. Deterministic polynomial hash function to generate daily varying elements (0 tokens)
    def get_daily_seed(today_str: str, username: str, teller_id: str) -> int:
        seed_str = f"{today_str}_{username}_{teller_id}"
        hash_val = 0
        for char in seed_str:
            hash_val = (hash_val * 31 + ord(char)) & 0xFFFFFFFF
        return hash_val

    seed_val = get_daily_seed(today_str, request.username, request.teller_id)

    # 2. Select dynamic daily astrological aspect
    aspects = [
        "ดาวศุกร์เล็งหนุนดวงชะตา นำพาพลังงานแห่งความเมตตาและเสน่ห์ความสัมพันธ์ที่อบอุ่น",
        "ดาวพฤหัสบดีโคจรสถิตในตำแหน่งส่งเสริม ทำให้สติปัญญาแจ่มใสและมีวิสัยทัศน์ชีวิตที่เปิดกว้าง",
        "ดาวดวงธาตุประจำวันประสานงานสมดุลดีเลิศ หนุนนำจิตใจให้ราบรื่น สงบ และมีสติพร้อมเปิดรับสิ่งใหม่",
        "วันนี้กระแสลมปราณชีวิตไหลเวียนดีเลิศ มีเกราะดาวธรรมนำโชคคอยคุ้มครองจิตใจและสติให้แจ่มใส",
        "ดาวพุธโคจรเสวยทับดวงชะตา ส่งผลบวกต่อการสื่อสาร การคิดสร้างสรรค์ และความสัมพันธ์กับคนรอบตัว",
        "พลังงานกระแสดาวเสาร์เคลื่อนย้ายเปิดทางสะดวก ทำให้เมฆหมอกอุปสรรคเก่าๆ คลายตัวออกอย่างน่าอัศจรรย์",
        "ดวงดาวโคจรสถิตในตำแหน่งเปิดขุมพลังบารมี ดึงดูดความเมตตา ความช่วยเหลือ และโอกาสดีๆ เข้าหาตัว"
    ]
    aspect = aspects[seed_val % len(aspects)]

    # 3. Select dynamic daily lucky number and energy score
    lucky_number = (seed_val % 9) + 1
    energy_score = 75 + (seed_val % 21)  # 75% to 95%

    # 4. Select dynamic micro-action advice matching each teller's theme
    micro_advices = {
        'love': [
            "ลองยิ้มต้อนรับวันใหม่ให้ตัวเองในกระจกตอนเช้า และส่งข้อความดีๆ ทักทายคนสนิทสั้นๆ นะคะ",
            "วันนี้หาเวลาฟังเพลงจังหวะสบายๆ หรือเพลงรักเบาๆ เพื่อเติมพลังงานบวกและความชุ่มชื่นให้หัวใจนะคะ",
            "หากมีโอกาส ลองซื้อเครื่องดื่มหรือขนมอร่อยๆ ไปแบ่งปันเพื่อนร่วมงานข้างๆ เพื่อสร้างมิตรภาพและเสน่ห์ที่ดีค่ะ",
            "ลองจัดระเบียบของใช้ส่วนตัวหรือโต๊ะทำงานสั้นๆ เพื่อเปิดทางให้พลังงานเชิงบวกและความราบรื่นไหลเข้ามาหาตัวนะคะ"
        ],
        'finance': [
            "เช้านี้ก่อนเริ่มใช้จ่าย ให้จัดเรียงธนบัตรในกระเป๋าเงินให้เป็นระเบียบเรียบร้อยเพื่อเปิดทางเรียกทรัพย์ครับ",
            "หากมีโอกาส ลองทำบุญบริจาคทานเล็กๆ น้อยๆ เพื่อลดความตระหนี่และเปิดประตูแห่งโชคลาภให้ไหลคล่องตัวครับ",
            "วันนี้ให้จดบันทึกรายรับรายจ่ายสั้นๆ เพื่อสะสมพลังการเงินและปิดรอยรั่วของการไหลออกที่ไม่จำเป็นครับ",
            "ชะลอการตัดสินใจซื้อของชิ้นใหญ่ in วันนี้ออกไปสัก 24 ชั่วโมง เพื่อไตร่ตรองความคุ้มค่าอย่างเถ้าแก่มืออาชีพครับ"
        ],
        'work': [
            "เช้านี้ลองหลับตาทำสมาธิสั้นๆ 1 นาทีก่อนเริ่มทำงาน เพื่อรวบรวมโฟกัส สติปัญญา และความมั่นใจค่ะ",
            "จัดระเบียบไฟล์บนหน้าจอคอมพิวเตอร์และเคลียร์ถังขยะประวัติ เพื่อเพิ่มพลังสร้างสรรค์และความสมองปลอดโปร่งค่ะ",
            "หากมีเวลาว่างระหว่างงาน ลองขยับตัว ยืดเส้นสายคอบ่าไหล่สัก 2 นาที เพื่อประจุไอเดียสดใหม่และลดความเหนื่อยล้าค่ะ",
            "ก่อนกดส่งอีเมลหรือติดต่องานสำคัญในวันนี้ แนะนำให้ตรวจเช็กความเรียบร้อยรอบคอบอีกหนึ่งสเต็ปเพื่อความเป๊ะค่ะ"
        ],
        'health': [
            "ตื่นเช้ามาอย่าลืมดื่มน้ำอุ่นสะอาดสักแก้วทันทีเพื่อปลุกระบบขับถ่ายและธาตุในกายให้สมดุลนะหลานรัก",
            "หาเวลาเดินยืดเส้นยืดสายเบาๆ รับไอแดดอ่อนยามเช้าสัก 5 นาทีเพื่อเติมพลังปราณที่ดีนะหลานเอ๊ย",
            "วันนี้ลองงดเว้นของทอด ของมันจัด เพื่อรักษาสมดุลธาตุกระเพาะอาหารและตับให้สบายตัวตลอดวันนะหลาน",
            "ก่อนนอนคืนนี้ลองแช่เท้าในน้ำอุ่นๆ จะช่วยคลายกล้ามเนื้อระบบประสาทให้หลับลึกสบายขึ้นนะหลานรัก"
        ],
        'overall': [
            "ตื่นนอนเช้าวันนี้ ลองสูดลมหายใจเข้าลึกๆ 3 ครั้ง สังเกตสัมผัสของลมเพื่อตั้งมั่นสติให้อยู่กับกาย",
            "วันนี้พึงงดเว้นการบ่นหรือจับผิดสิ่งรอบตัว ลองมองหาและขอบคุณสิ่งดีๆ 3 อย่างที่มีในชีวิตตอนปัจจุบัน",
            "หาเวลาปิดหน้าจอโทรศัพท์สัก 15 นาที นั่งปล่อยวางความกังวลหรือเดินสูดอากาศธรรมชาติเพื่อชำระจิตใจให้สงบ",
            "จงก้าวเดินและพูดคุยอย่างใจเย็นและมีสติ สังเกตปฏิกิริยาทางอารมณ์ของตนเองแล้วปล่อยให้ไหลผ่านไป"
        ]
    }
    teller_advices = micro_advices.get(request.teller_id, micro_advices['overall'])
    micro_advice = teller_advices[seed_val % len(teller_advices)]

    prediction_text = ""
    if request.teller_id == 'love':
        prediction_text = (
            f"สวัสดีค่ะน้อง {username} วันนี้แม่หมอจันทรามีความยินดีอย่างยิ่งที่จะเปิดเผยดวงชะตาเรื่องความรัก ความสัมพันธ์ และเสน่ห์ "
            f"สำหรับคนเกิดวัน{birth_weekday_th}เป็นพิเศษในวันนี้ค่ะ 💖\n\n"
            f"🌟 **กระแสดวงความรักวันนี้**: ในวันนี้มี **{aspect}** ส่งผลให้ดวงชะตาความรักรอบตัวคุณมีระดับพลังงานบวกและเสน่ห์พุ่งสูงถึง **{energy_score}%** เลยค่ะ!\n\n"
            f"✨ คำทำนายดวงชะตาประจำวัน: \"{base_horoscope}\"\n\n"
            f"🎨 สีมงคลคู่กายเสริมโชคความรักและเสน่ห์ของคุณในวันนี้คือ **{lucky_color}** นะคะ "
            f"ลองเลือกสวมใส่เครื่องแต่งกาย หรือหยิบของใช้ใกล้ตัวที่เป็นโทนสีนี้ จะช่วยหนุนดวงความสัมพันธ์รอบตัวคุณให้ไหลลื่นยิ่งขึ้นค่ะ\n\n"
            f"🔮 เคล็ดลับเสริมดวงประจำวัน: {micro_advice}\n\n"
            f"👩‍⚕️ คำแนะนำสุขภาพจากแม่หมอ: {chosen_tip}\n\n"
            f"🔢 เลขนำโชคด้านความรักของคุณในวันนี้คือ: **{lucky_number}** ค่ะ"
        )
    elif request.teller_id == 'finance':
        prediction_text = (
            f"สวัสดีครับเถ้าแก่ {username}! ซินแสเศรษฐีพร้อมนำทางเปิดคลังทรัพย์และวิเคราะห์การเงิน "
            f"ของคนเกิดวัน{birth_weekday_th}มาส่งมอบให้ในวันนี้แล้วครับ 💰\n\n"
            f"🌟 **กระแสดวงการเงินวันนี้**: วันนี้มี **{aspect}** ช่วยประคองดวงการเงินและการเจรจาการค้าให้มีกระแสโชคลาภพุ่งสูงถึง **{energy_score}%** ครับ!\n\n"
            f"✨ คำทำนายดวงชะตาประจำวัน: \"{base_horoscope}\"\n\n"
            f"🎨 สีมงคลเปิดทรัพย์และเสริมโชคลาภของคุณในวันนี้คือ **{lucky_color}** ครับ "
            f"หากจะออกไปเจรจาการค้าหรือตัดสินใจเรื่องเงินทอง ลองพกสิ่งของหรือสวมใส่เสื้อผ้าโทนสีนี้ จะช่วยปรับสมดุลธาตุ ดึงดูดทรัพย์เข้ามาไหลลื่นไม่ติดขัดครับ\n\n"
            f"🔮 เคล็ดลับเปิดทรัพย์ประจำวัน: {micro_advice}\n\n"
            f"👨‍⚕️ คำแนะนำสุขภาพจากซินแส: {chosen_tip}\n\n"
            f"🔢 เลขนำโชคดึงทรัพย์ของคุณในวันนี้คือ: **{lucky_number}** ครับ"
        )
    elif request.teller_id == 'work':
        prediction_text = (
            f"สวัสดีค่ะคุณ {username} อาจารย์ดวงดาวได้ทำการวิเคราะห์ตำแหน่งดวงดาวการงานและความสำเร็จ "
            f"ของคนเกิดวัน{birth_weekday_th}สำหรับวันนี้มาให้เรียบร้อยแล้วค่ะ 💻\n\n"
            f"🌟 **กระแสดวงการงานวันนี้**: ในวันนี้มี **{aspect}** ส่งผลให้สมาธิ ความคิดสร้างสรรค์ และจังหวะความสำเร็จในหน้าที่การงานของคุณอยู่ที่ระดับ **{energy_score}%** ค่ะ!\n\n"
            f"✨ คำทำนายดวงชะตาประจำวัน: \"{base_horoscope}\"\n\n"
            f"🎨 สีมงคลนำโชคขจัดอุปสรรคและเสริมอำนาจบารมีของคุณในวันนี้คือ **{lucky_color}** ค่ะ "
            f"แนะนำให้สวมใส่เสื้อผ้าหรือใช้สิ่งของโทนสีนี้เพื่อเพิ่มพลังความมั่นใจ ความคิดสร้างสรรค์ และดึงดูดการยอมรับและการสนับสนุนจากหัวหน้างานค่ะ\n\n"
            f"🔮 เคล็ดลับสู่ความสำเร็จประจำวัน: {micro_advice}\n\n"
            f"👩‍⚕️ คำแนะนำสุขภาพจากอาจารย์ดวงดาว: {chosen_tip}\n\n"
            f"🔢 เลขนำโชคการงานของคุณในวันนี้คือ: **{lucky_number}** ค่ะ"
        )
    elif request.teller_id == 'health':
        prediction_text = (
            f"เจริญสุขนะหลานเอ๊ย! ปู่ผู้เฒ่าโอสถมาตรวจดวงชะตาร่างกายและปรับสมดุลธาตุพลังงาน "
            f"ของหลานรักที่เกิดวัน{birth_weekday_th}ในวันนี้แล้วนะหลาน 👴\n\n"
            f"🌟 **กระแสดวงสุขภาพวันนี้**: วันนี้มี **{aspect}** หนุนกายใจให้สดชื่นแจ่มใส มีภูมิต้านทานและพลังชีวิตเข้มแข็งถึง **{energy_score}%** เชียวนะหลานรัก!\n\n"
            f"✨ คำทำนายดวงชะตาประจำวัน: \"{base_horoscope}\"\n\n"
            f"🎨 สีมงคลเสริมอายุวัฒนะ ป้องกันภัย และฟื้นฟูสุขภาพพลังธาตุคือ **{lucky_color}** นะเออ "
            f"พกสีนี้ไว้ใกล้ตัวหรือสวมใส่เสื้อผ้าโทนสีนี้ จะช่วยกระตุ้นพลังดีๆ ให้กายใจสดชื่นและมีชีวิตชีวาตลอดทั้งวันนะหลานรัก\n\n"
            f"🔮 เคล็ดลับถนอมร่างกายประจำวัน: {micro_advice}\n\n"
            f"👴 คำแนะนำสุขภาพจากปู่โอสถ: {chosen_tip}\n\n"
            f"🔢 เลขมงคลเสริมพลังกายของคุณในวันนี้คือ: **{lucky_number}** นะหลานรัก"
        )
    else: # overall
        prediction_text = (
            f"เจริญพรคุณ {username} เซนมาสเตอร์ขอนำพาแสงสว่างแห่งปัญญาและแนวทางการดำเนินชีวิต "
            f"ของคนเกิดวัน{birth_weekday_th}ในเช้าวันใหม่อันผ่องใสนี้ 🧘\n\n"
            f"🌟 **ภาพรวมดวงชะตาวันนี้**: วันนี้มี **{aspect}** ช่วยประคองจิตใจให้ตั้งมั่น เกิดสติ และมีความสงบผ่องใสอยู่กับตัวถึง **{energy_score}%** แล้ว\n\n"
            f"✨ คำทำนายดวงชะตาประจำวัน: \"{base_horoscope}\"\n\n"
            f"🎨 สีมงคลเกื้อหนุนพลังชีวิต นำพาความสงบ และจิตใจที่ตั้งมั่นในวันนี้คือ **{lucky_color}** "
            f"จงพิจารณาและเลือกใช้สีนี้ติดตัวหรือใช้ประกอบในวัน เพื่อย้ำเตือนสติให้อยู่กับปัจจุบันขณะ ผ่อนคลายอารมณ์ และรักษาจิตใจให้เบิกบาน\n\n"
            f"🔮 เคล็ดลับขัดเกลาจิตใจประจำวัน: {micro_advice}\n\n"
            f"🧘 คำแนะนำสุขภาพจากเซนมาสเตอร์: {chosen_tip}\n\n"
            f"🔢 เลขนำทางปัญญาของคุณในวันนี้คือ: **{lucky_number}** เจริญพร"
        )

    print(f"DEBUG: Fortune Teller Success (Local): {prediction_text[:50]}...")
    return {"status": "success", "prediction": prediction_text, "date": today_str}




class HealthSummaryRequest(BaseModel):
    theme: str = "working"
    username: str = "ผู้ใช้"
    health_context: str = ""

@app.post("/api/health-summary")
def get_health_summary(request: HealthSummaryRequest):
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

วิเคราะห์ข้อมูลสุขภาพ 7 วันที่ผ่านมา แล้วสรุปให้ **สั้นและกระชับที่สุด (ไม่เกิน 2 ข้อ)** 
ข้อกำหนดสำคัญมาก:
- ห้ามกล่าวทักทาย (ห้ามมี สวัสดีค่ะ/ครับ)
- ห้ามมีประโยคเกริ่นนำหรือประโยคสรุปท้าย
- ตอบเฉพาะ bullet points เท่านั้น 
- ห้ามคิดค้น สมมุติ หรือคาดเดาข้อมูลกิจกรรม อาการ หรือ "เป้าหมาย" (Goals) ใดๆ ที่ไม่มีอยู่จริงหรือไม่ได้ปรากฏในประวัติสุขภาพ 7 วันล่าสุดที่ได้รับเด็ดขาด
- หากผู้ใช้ยังไม่ได้ตั้งเป้าหมาย หรือไม่มีข้อมูลเป้าหมายใดๆ ในข้อความที่ส่งมา ห้ามกล่าวถึงการบรรลุเป้าหมาย หรือประเด็นเกี่ยวกับเป้าหมายอย่างเด็ดขาด
- วิเคราะห์อย่างตรงไปตรงมาอ้างอิงจากประวัติสุขภาพที่มีอยู่จริงเท่านั้น

รูปแบบที่ต้องการ:
• [สรุปภาพรวมจากประวัติสุขภาพจริง 1 ประโยค]
• [คำแนะนำสั้นๆ ที่เป็นประโยชน์จริง 1 ประโยค]

ใช้ภาษาไทยเท่านั้น"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"ข้อมูลสุขภาพ 7 วันล่าสุด:\n{request.health_context}\n\nกรุณาสรุปข้อมูลและให้คำแนะนำตามรูปแบบที่กำหนด"}
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
    return FileResponse(
        os.path.join(BASE_DIR, 'dashboard.html'),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

@app.get("/feature-excretion.html")
async def read_excretion():
    return FileResponse(
        os.path.join(BASE_DIR, 'feature-excretion.html'),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

@app.get("/history.html")
async def read_history():
    return FileResponse(
        os.path.join(BASE_DIR, 'history.html'),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

@app.get("/settings.html")
async def read_settings():
    return FileResponse(
        os.path.join(BASE_DIR, 'settings.html'),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

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
        return FileResponse(
            file_path,
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )
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
