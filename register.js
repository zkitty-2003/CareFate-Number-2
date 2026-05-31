// Supabase Configuration
// IMPORTANT: Replace these with your actual Supabase URL and Key
const SUPABASE_URL = 'https://rjszmmogkiblqojikcow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RoboGAH-Nqm1dQi3ORqYUQ_StZ7uU4Y';

// Helper to check Supabase status
function getSupabase() {
    if (typeof window.supabase === 'undefined') {
        // Fallback for critical init error
        console.error("Supabase not loaded");
        // alert("ข้อผิดพลาด: ไม่สามารถโหลด Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
        throw new Error("Supabase not loaded");
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
    // Check for elements to determine which page logic to run
    const registerForm = document.getElementById('registerForm');
    const themeContainer = document.getElementById('themeContainer');
    const featureGrid = document.getElementById('featureGrid');

    if (registerForm) {
        initializeRegisterPage();
    } else if (themeContainer) {
        initializeThemePage();
    } else if (featureGrid) {
        initializeFeaturePage();
    }
});

// --- Register Page Logic ---
function initializeRegisterPage() {
    const form = document.getElementById('registerForm');

    // Date Logic
    const dobInput = document.getElementById('dob');
    const maxDob = (() => {
        const d = new Date();
        const year = d.getFullYear() - 13;
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })(); // 13 years ago today
    dobInput.setAttribute('max', maxDob);

    // Toggle Password Visibility Logic
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        const icon = btn.querySelector('i');

        btn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    };

    setupToggle('togglePasswordBtn', 'password');
    setupToggle('toggleConfirmPasswordBtn', 'confirmPassword');

    // --- Dynamic Password Validation ---
    const passwordInput = document.getElementById('password');
    const reqLength = document.getElementById('req-length');
    const reqEnglish = document.getElementById('req-english');
    const reqComplexity = document.getElementById('req-complexity');
    const reqSpecial = document.getElementById('req-special');

    const updateReqUI = (el, isValid) => {
        const icon = el.querySelector('i');
        if (isValid) {
            el.style.color = 'var(--success)';
            icon.className = 'fa-solid fa-circle-check';
            icon.style.color = 'var(--success)';
        } else {
            el.style.color = '#1e293b'; // สีเข้มขึ้น/สีดำตามที่ผู้ใช้ร้องขอ เพื่อให้อ่านชัดเจน
            icon.className = 'fa-solid fa-circle-info';
            icon.style.color = '#64748b'; // ปรับสีไอคอนให้ออกเทาเข้ม ชัดเจนขึ้น
        }
    };

    const validateRules = (pass) => {
        return {
            length: pass.length >= 7 && pass.length <= 20,
            english: /[a-z]/.test(pass) && /[A-Z]/.test(pass),
            number: /\d/.test(pass),
            noSpecial: /^[a-zA-Z0-9]+$/.test(pass)
        };
    };

    passwordInput.addEventListener('input', (e) => {
        const pass = e.target.value;
        const rules = validateRules(pass);

        updateReqUI(reqLength, rules.length);
        updateReqUI(reqEnglish, rules.english);
        updateReqUI(reqComplexity, rules.number);
        updateReqUI(reqSpecial, rules.noSpecial);
    });

    // เรียกอัปเดต UI ทันทีเมื่อโหลดหน้า เพื่อให้สีตัวหนังสือดำชัดเจนและไอคอนถูกต้องตามสภาพเริ่มต้น
    updateReqUI(reqLength, false);
    updateReqUI(reqEnglish, false);
    updateReqUI(reqComplexity, false);
    updateReqUI(reqSpecial, false);

    // Validation
    const validateDate = (input) => {
        if (!input.value) return;
        const birthDate = new Date(input.value);
        const todayDate = new Date();
        let age = todayDate.getFullYear() - birthDate.getFullYear();
        const m = todayDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && todayDate.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13) {
            showInAppNotification('ข้อผิดพลาด', "ผู้สมัครต้องมีอายุอย่างน้อย 13 ปีขึ้นไป");
            input.value = maxDob;
        }
    };
    dobInput.addEventListener('change', (e) => validateDate(e.target));
    dobInput.addEventListener('blur', (e) => validateDate(e.target));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Form submitted");

        const username = document.getElementById('username').value.trim();
        const dob = document.getElementById('dob').value;
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation 1: Date & Age (Strict 13+)
        const birthDate = new Date(dob);
        const todayDate = new Date();
        let age = todayDate.getFullYear() - birthDate.getFullYear();
        const m = todayDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && todayDate.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13) {
            showInAppNotification('ข้อผิดพลาด', "ผู้สมัครต้องมีอายุอย่างน้อย 13 ปีขึ้นไป");
            return;
        }

        // Validation 2: Password Complexity (Granular)
        const rules = validateRules(password);
        let errorMsg = "";

        if (!rules.length) {
            errorMsg = "รหัสผ่านต้องมีความยาว 7-20 ตัวอักษร";
        } else if (!rules.english) {
            errorMsg = "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ (ตัวเล็กและตัวใหญ่)";
        } else if (!rules.number) {
            errorMsg = "รหัสผ่านต้องมีตัวเลขประกอบด้วย";
        } else if (!rules.noSpecial) {
            errorMsg = "รหัสผ่านห้ามมีอักขระพิเศษ (@ # $ %)";
        }

        if (errorMsg) {
            showInAppNotification('รหัสผ่านไม่ปลอดภัย', errorMsg);
            // Highlight the specific failing requirement in red temporarily
            const failId = !rules.length ? 'req-length' :
                (!rules.english ? 'req-english' :
                    (!rules.number ? 'req-complexity' : 'req-special'));
            const failEl = document.getElementById(failId);
            if (failEl) {
                failEl.style.color = 'var(--danger)';
                failEl.querySelector('i').style.color = 'var(--danger)';
                failEl.querySelector('i').className = 'fa-solid fa-circle-xmark';
            }
            return;
        }

        // Validation 3: Password Confirmation Match
        if (password !== confirmPassword) {
            showInAppNotification('ข้อผิดพลาด', 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        // Precise age already calculated and validated above as `age`

        // UI Feedback
        const btn = form.querySelector('.btn-primary');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังประมวลผล...';
        btn.disabled = true;

        try {
            const _supabase = getSupabase();

            // Check if the email already exists in the system and if it is verified/confirmed
            try {
                const { data: checkData, error: checkError } = await _supabase.rpc('check_email_verified', { input_email: email });
                if (checkError) {
                    console.warn("check_email_verified failed:", checkError);
                } else if (checkData) {
                    if (checkData.exists) {
                        if (!checkData.verified) {
                            showInAppNotification('อีเมลเคยสมัครแล้วแต่ยังไม่ได้ยืนยัน', 'กรุณาเช็กในกล่อง Inbox หรืออีเมลขยะเพื่อกดยืนยันตัวตนก่อนเข้าใช้งาน หรือลองเข้าสู่ระบบด้วยอีเมลและรหัสผ่านเพื่อขอรับลิงก์ยืนยันตัวตนใหม่โดยอัตโนมัติครับ 📬');
                            btn.innerHTML = originalContent;
                            btn.disabled = false;
                            return;
                        } else {
                            showInAppNotification('อีเมลถูกใช้งานแล้ว', 'อีเมลนี้ได้ลงทะเบียนและยืนยันตัวตนเสร็จเรียบร้อยแล้ว หากเป็นบัญชีของคุณ สามารถกดเข้าสู่ระบบได้ทันทีครับ');
                            btn.innerHTML = originalContent;
                            btn.disabled = false;
                            return;
                        }
                    }
                }
            } catch (checkEx) {
                console.warn("Exception during email verification check:", checkEx);
            }

            // Sign Up with Metadata
            const { data: authData, error: authError } = await _supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        dob: dob,
                        age: age,
                        theme_selected: false
                    }
                }
            });

            if (authError) throw authError;

            // Supabase returns empty identities when email is already registered
            // (it hides this for security, but we can detect it this way)
            if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
                showInAppNotification('อีเมลถูกใช้งานแล้ว', 'หากเป็นอีเมลของคุณแต่ยังไม่ได้กดยืนยันตัวตน กรุณาตรวจสอบกล่องข้อความหรือกล่องจดหมายขยะเพื่อกดยืนยันก่อนเข้าใช้งานครับ');
                btn.innerHTML = originalContent;
                btn.disabled = false;
                return;
            }

            console.log("Signup success:", authData);

            // ตั้งค่า Cooldown ป้องกันสแปมสำหรับผู้สมัครใหม่ครั้งแรก (ต้องรอ 5 นาทีหากต้องการกดล็อกอินขอลิงก์ใหม่)
            try {
                localStorage.setItem('carefate_resend_count', '1');
                localStorage.setItem('carefate_next_resend_allowed_time', (Date.now() + 5 * 60 * 1000).toString());
            } catch (e) {
                console.warn("localStorage set failed:", e);
            }

            // บันทึกโปรไฟล์ลงในตาราง profiles ทันทีแบบ Best-effort (กรณีที่สิทธิ์ RLS หรือการตั้งค่าเปิดให้บันทึกได้เลย)
            if (authData.user) {
                try {
                    await _supabase.from('profiles').upsert({
                        id: authData.user.id,
                        username: username,
                        dob: dob,
                        resend_count: 1,
                        next_resend_allowed_time: Date.now() + 5 * 60 * 1000
                    });
                    console.log("Profile created successfully during registration with cooldown.");
                } catch (pe) {
                    console.warn("Failed to create profile row immediately:", pe);
                }
            }

            // Hide Form & Show Success Message
            const mainContainer = document.querySelector('.login-screen');
            mainContainer.innerHTML = `
                <div class="logo-container" style="text-align: center; animation: fadeIn 0.5s;">
                    <div class="logo-icon" style="margin: 0 auto 1.5rem; background: var(--success); box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.3);">
                        <i class="fa-regular fa-paper-plane" style="color: white; font-size: 2rem;"></i>
                    </div>
                    <h1 class="app-name" style="font-size: 1.875rem; color: #1e293b; margin-bottom: 0.5rem;">กรุณาตรวจสอบอีเมล</h1>
                    <p class="tagline" style="margin-top: 1rem; color: #475569; font-size: 1rem; line-height: 1.5;">
                        เราได้ส่งลิงก์ยืนยันไปที่ <br><strong style="color: #6366f1;">${email}</strong>
                    </p>
                    <p style="margin-top: 1.5rem; color: #475569; font-size: 0.825rem; background: #f8fafc; padding: 1.2rem; border-radius: 16px; border: 1px solid #f1f5f9; text-align: left; line-height: 1.6;">
                        • กรุณาคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชีของคุณ **ภายใน 24 ชั่วโมง**<br>
                        • หากไม่ได้ยืนยันภายใน 24 ชม. ลิงก์จะหมดอายุ คุณสามารถกรอก **อีเมลและรหัสผ่าน** นี้เข้าสู่ระบบได้เลย เพื่อให้ระบบส่งลิงก์ยืนยันตัวตนใหม่ให้โดยอัตโนมัติ 💡
                    </p>
                    <a href="index.html" class="btn-primary" style="margin-top: 2rem; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #0f172a; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3);">
                        กลับสู่หน้าเข้าสู่ระบบ
                    </a>
                </div>
            `;

        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}

// --- Theme Selection Page Logic ---
async function initializeThemePage() {
    let user;
    let _supabase;

    try {
        _supabase = getSupabase();
        const { data } = await _supabase.auth.getUser();
        user = data.user;
    } catch (e) {
        console.error(e);
        window.location.href = 'index.html';
        return;
    }

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const container = document.getElementById('themeContainer');
    const completeBtn = document.getElementById('completeRegistration');

    // Get Age from Metadata
    let age = 25;
    if (user.user_metadata?.age) age = user.user_metadata.age;

    // Define Themes
    const themes = [
        {
            id: 'youth',
            name: 'สดใส มีชีวิตชีวา',
            desc: 'สดใสและมีสีสัน สำหรับคนรุ่นใหม่',
            range: [0, 19],
            class: 'theme-youth',
            icon: 'fa-bolt',
            iconBg: 'background: linear-gradient(135deg, #e879f9, #ec4899);' // fuchsia-400 to pink-500
        },
        {
            id: 'working',
            name: 'เรียบหรู มืออาชีพ',
            desc: 'เรียบหรู สบายตา เน้นการใช้งาน',
            range: [20, 59],
            class: 'theme-working',
            icon: 'fa-briefcase',
            iconBg: 'background: linear-gradient(135deg, #3b82f6, #6366f1);' // blue-500 to indigo-500
        },
        {
            id: 'elder',
            name: 'ชัดเจน สบายตา',
            desc: 'คุมโทนชัดเจน อ่านง่าย สบายตา',
            range: [60, 150],
            class: 'theme-elder',
            icon: 'fa-leaf',
            iconBg: 'background: linear-gradient(135deg, #fb923c, #f59e0b);' // orange-400 to amber-500
        }
    ];

    // Determine Theme
    let recommendedThemeId = 'working';
    if (age <= 19) recommendedThemeId = 'youth';
    else if (age >= 20 && age <= 59) recommendedThemeId = 'working';
    else if (age >= 60) recommendedThemeId = 'elder';

    let selectedThemeId = recommendedThemeId;

    // Update Header with Age
    const tagline = document.getElementById('ageTagline');
    if (tagline) {
        tagline.innerHTML = `แนะนำธีมตามช่วงอายุ (อายุ ${age} ปี):`;
    }

    // Render Cards
    const renderCards = () => {
        container.innerHTML = ''; // clear
        themes.forEach(theme => {
            const isRecommended = theme.id === recommendedThemeId;
            const isSelected = theme.id === selectedThemeId;
            const card = document.createElement('button');
            
            // Format range text
            let rangeText = `อายุ ${theme.range[0]} - ${theme.range[1]} ปี`;
            if (theme.range[1] >= 100) rangeText = `อายุ ${theme.range[0]} ปีขึ้นไป`;
            if (theme.range[0] === 0) rangeText = `อายุ ${theme.range[1]} ปีลงไป`;

            card.className = `w-full relative flex items-center gap-4 p-5 rounded-[28px] transition-all duration-300 text-left border-2`;
            // Base styles
            card.style.width = '100%';
            card.style.position = 'relative';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '1rem';
            card.style.padding = '1.25rem';
            card.style.borderRadius = '28px';
            card.style.transition = 'all 0.3s ease';
            card.style.textAlign = 'left';
            card.style.border = '2px solid transparent';
            card.style.cursor = 'pointer';

            if (isSelected) {
                card.style.backgroundColor = '#E3F2FD';
                card.style.borderColor = '#2563eb';
                card.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                card.style.transform = 'scale(1.02)';
            } else {
                card.style.backgroundColor = 'rgba(148, 163, 184, 0.3)';
            }

            card.innerHTML = `
                ${isRecommended ? `
                <div style="position: absolute; top: 0.75rem; right: 1.25rem; background-color: #9333ea; color: white; font-size: 0.625rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
                  แนะนำ
                </div>` : ''}
                
                <div style="flex-shrink: 0; width: 3.5rem; height: 3.5rem; ${theme.iconBg} border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                    <i class="fa-solid ${theme.icon}" style="color: white; font-size: 1.25rem;"></i>
                </div>

                <div style="flex: 1;">
                    <h3 style="font-weight: 600; font-size: 1.125rem; line-height: 1.25; color: ${isSelected ? '#0f172a' : '#1e293b'}; margin-bottom: 0;">
                        ${theme.name}
                    </h3>
                    <div style="display: flex; align-items: center; gap: 0.375rem; margin-top: 0.125rem;">
                        <div style="width: 0.375rem; height: 0.375rem; border-radius: 9999px; background-color: ${isSelected ? '#9333ea' : '#64748b'};"></div>
                        <p style="font-size: 0.75rem; font-weight: 600; margin: 0; color: ${isSelected ? '#7e22ce' : '#334155'};">
                            ${rangeText}
                        </p>
                    </div>
                    <p style="font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600; line-height: 1.625; margin-bottom: 0; color: ${isSelected ? '#1e293b' : '#475569'};">
                        ${theme.desc}
                    </p>
                </div>

                <div style="flex-shrink: 0; width: 1.5rem; height: 1.5rem; border-radius: 9999px; border: 2px solid; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; ${isSelected ? 'background-color: #2563eb; border-color: #2563eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);' : 'background-color: white; border-color: #94a3b8;'}">
                    ${isSelected ? '<i class="fa-solid fa-check" style="color: white; font-size: 0.75rem; stroke-width: 3px;"></i>' : ''}
                </div>
            `;

            card.addEventListener('click', () => {
                selectedThemeId = theme.id;
                renderCards();
            });

            container.appendChild(card);
        });
    };

    renderCards();

    // Save Theme -> Go to Features
    completeBtn.addEventListener('click', async () => {
        const btn = completeBtn;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
        btn.disabled = true;

        try {
            // Update Auth Metadata AND Profile Table
            await _supabase.auth.updateUser({
                data: { theme: selectedThemeId, theme_selected: true }
            });

            // Also try update profiles table if possible (UPDATE to preserve other columns like dob)
            await _supabase
                .from('profiles')
                .update({ theme: selectedThemeId })
                .eq('id', user.id);

            // Redirect to Feature Selection
            window.location.href = 'feature-selection.html';

        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}

// --- Feature Selection Page Logic ---
async function initializeFeaturePage() {
    let user;
    let _supabase;

    try {
        _supabase = getSupabase();
        const { data } = await _supabase.auth.getUser();
        user = data.user;
    } catch (e) {
        window.location.href = 'index.html';
        return;
    }

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const grid = document.getElementById('featureGrid');
    const saveBtn = document.getElementById('saveFeaturesBtn');
    const ageTagline = document.getElementById('ageTagline');

    // Get Age and Theme
    let age = 25; // Default
    if (user.user_metadata?.age) age = user.user_metadata.age;
    
    let theme = user.user_metadata?.theme || 'working';

    if (ageTagline) {
        if (theme === 'elder') {
            ageTagline.innerHTML = `แนะนำสำหรับวัย <strong>60 ปีขึ้นไป (ธีมชัดเจน สบายตา)</strong>`;
        } else if (theme === 'working') {
            ageTagline.innerHTML = `แนะนำสำหรับวัย <strong>20 - 59 ปี (ธีมเรียบหรู มืออาชีพ)</strong>`;
        } else {
            ageTagline.innerHTML = `แนะนำสำหรับวัย <strong>ต่ำกว่า 20 ปี (ธีมสดใส มีชีวิตชีวา)</strong>`;
        }
    }

    // Define Features & Logic
    const features = [
        {
            id: 'goals',
            title: 'เป้าหมาย',
            icon: 'fa-bullseye',
            recommend: (a, t) => true // Goals are good for everyone!
        },
        {
            id: 'exercise',
            title: 'ออกกำลังกาย',
            icon: 'fa-dumbbell',
            recommend: (a, t) => true // Exercise is good for everyone!
        },
        {
            id: 'period',
            title: 'รอบเดือน',
            icon: 'fa-droplet',
            recommend: (a, t) => t === 'youth' || (t === 'working' && a >= 12 && a <= 50)
        }
    ];

    // Selected Set
    const selectedFeatures = new Set();

    // Load existing features
    const savedFeatureSet = new Set();
    const metadataFeatures = user.user_metadata?.features;

    // 1. From User Metadata
    if (Array.isArray(metadataFeatures)) {
        metadataFeatures.forEach(f => savedFeatureSet.add(f));
    }

    // 2. From Profile Table
    try {
        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profile && profile.features) {
            let parsed = profile.features;
            // Handle various formats (JSON, Postgres Array String, etc.)
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                } catch (e) {
                    // Clean curly braces, quotes, then split
                    parsed = parsed.replace(/[{}"']/g, '').split(',');
                }
            }

            if (Array.isArray(parsed)) {
                parsed.forEach(f => {
                    if (typeof f === 'string') savedFeatureSet.add(f.trim());
                    else savedFeatureSet.add(f);
                });
            }
        }
    } catch (e) {
        console.warn("Profile fetch warning:", e);
    }

    // Decision Logic: Use saved features if available OR if setup was marked complete
    const setupCompleted = user.user_metadata?.setup_completed === true;
    const hasSavedData = savedFeatureSet.size > 0;
    const useSaved = setupCompleted || hasSavedData;

    // Apply Logic
    features.forEach(feat => {
        const isRecommended = feat.recommend(age, theme);

        if (useSaved) {
            // Restore user choice
            if (savedFeatureSet.has(feat.id)) {
                selectedFeatures.add(feat.id);
            }
        } else {
            // Default for new users
            if (isRecommended) {
                selectedFeatures.add(feat.id);
            }
        }

        const isSelected = selectedFeatures.has(feat.id);

        const card = document.createElement('div');
        card.className = `feature-card ${isSelected ? 'selected' : ''}`;
        card.onclick = () => toggleFeature(card, feat.id);

        card.innerHTML = `
            ${isRecommended ? '<div class="recommend-badge">แนะนำ</div>' : ''}
            <div class="checkbox-overlay">
                <i class="fa-solid fa-check"></i>
            </div>
            <i class="fa-solid ${feat.icon} feature-icon"></i>
            <div class="feature-title">${feat.title}</div>
        `;

        grid.appendChild(card);
    });

    function updateWarningBanner() {
        const banner = document.getElementById('feature-warning-banner');
        if (!banner) return;
        
        const count = selectedFeatures.size;
        if (count === 0) {
            banner.style.background = 'rgba(239, 68, 68, 0.1)';
            banner.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            banner.style.color = '#b91c1c';
            banner.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>กรุณาเลือกฟีเจอร์อย่างน้อย 1 ฟีเจอร์เพื่อเสร็จสิ้นการตั้งค่า (จำเป็น)</span>`;
            
            // Highlight save button as disabled-looking
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';
        } else {
            banner.style.background = 'rgba(16, 185, 129, 0.1)';
            banner.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            banner.style.color = '#047857';
            banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>เลือกแล้ว ${count} ฟีเจอร์ (พร้อมใช้งาน)</span>`;
            
            // Restore save button style
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }

    function toggleFeature(cardDom, id) {
        if (selectedFeatures.has(id)) {
            selectedFeatures.delete(id);
            cardDom.classList.remove('selected');
        } else {
            selectedFeatures.add(id);
            cardDom.classList.add('selected');
        }
        updateWarningBanner();
    }

    // Initialize Warning Banner on startup
    updateWarningBanner();

    // Notify immediately if 0 features are selected on load, or if redirected from dashboard
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('warning') === 'select_at_least_one' || selectedFeatures.size === 0) {
        setTimeout(() => {
            if (typeof showInAppNotification === 'function') {
                showInAppNotification('ระบบตั้งค่า', 'กรุณาเลือกฟีเจอร์อย่างน้อย 1 ฟีเจอร์เพื่อเริ่มต้นการใช้งาน');
            }
        }, 300);
    }

    // Save Logic
    saveBtn.addEventListener('click', async () => {
        const btn = saveBtn;
        const originalContent = btn.innerHTML;

        if (selectedFeatures.size === 0) {
            alert('กรุณาเลือกฟีเจอร์อย่างน้อย 1 ฟีเจอร์เพื่อเสร็จสิ้นการตั้งค่า');
            if (typeof showInAppNotification === 'function') {
                showInAppNotification('กรุณาเลือกฟีเจอร์', 'กรุณาเลือกฟีเจอร์อย่างน้อย 1 ฟีเจอร์เพื่อเสร็จสิ้นการตั้งค่า');
            }
            return;
        }

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
        btn.disabled = true;

        try {
            const featuresArray = Array.from(selectedFeatures);

            // Update Auth Metadata
            await _supabase.auth.updateUser({
                data: {
                    features: featuresArray,
                    setup_completed: true
                }
            });

            // Update Profile Table (UPDATE to preserve other columns like dob)
            await _supabase
                .from('profiles')
                .update({ features: featuresArray })
                .eq('id', user.id);

            // Success redirect to dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}
