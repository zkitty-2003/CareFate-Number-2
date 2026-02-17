// Supabase Configuration
// IMPORTANT: Replace these with your actual Supabase URL and Key
const SUPABASE_URL = 'https://rjszmmogkiblqojikcow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RoboGAH-Nqm1dQi3ORqYUQ_StZ7uU4Y';

// Helper to check Supabase status
function getSupabase() {
    if (typeof window.supabase === 'undefined') {
        alert("ข้อผิดพลาด: ไม่สามารถโหลด Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
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
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Simple YYYY-MM-DD
    dobInput.setAttribute('max', today);

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

    // Validation
    const validateDate = (input) => {
        if (input.value > today) {
            alert("วันเกิดไม่สามารถอยู่ในอนาคตได้");
            input.value = today;
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
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation 1: Date
        if (dob > today) {
            alert("วันเกิดไม่สามารถอยู่ในอนาคตได้");
            return;
        }

        // Validation 2: Password Complexity
        const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{7,20}$/;

        if (!passwordRegex.test(password)) {
            alert("รหัสผ่านต้องมีความยาว 7-20 ตัวอักษร ประกอบด้วยตัวเลข ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และห้ามมีอักขระพิเศษ");
            return;
        }

        // Validation 3: Confirm Match
        if (password !== confirmPassword) {
            alert("รหัสผ่านไม่ตรงกัน!");
            return;
        }

        // Calculate Age
        const birthDate = new Date(dob);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        // UI Feedback
        const btn = form.querySelector('.btn-primary');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังประมวลผล...';
        btn.disabled = true;

        try {
            const _supabase = getSupabase();

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

            console.log("Signup success:", authData);

            // Hide Form & Show Success Message
            const mainContainer = document.querySelector('.login-screen');
            mainContainer.innerHTML = `
                <div class="logo-container" style="text-align: center; animation: fadeIn 0.5s;">
                    <div class="logo-icon" style="margin: 0 auto 1.5rem; background: var(--success);">
                        <i class="fa-regular fa-paper-plane"></i>
                    </div>
                    <h1 class="app-name">กรุณาตรวจสอบอีเมล</h1>
                    <p class="tagline" style="margin-top: 1rem; color: #fff;">
                        เราได้ส่งลิงก์ยืนยันไปที่ <br><strong>${email}</strong>
                    </p>
                    <p style="margin-top: 2rem; color: var(--text-muted); font-size: 0.9rem;">
                        คลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชีของคุณ
                    </p>
                    <a href="index.html" class="btn-primary" style="margin-top: 2rem; text-decoration: none; display: inline-flex;">
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
            range: [6, 23],
            class: 'theme-youth',
            icon: 'fa-bolt'
        },
        {
            id: 'working',
            name: 'เรียบหรู มืออาชีพ',
            desc: 'เรียบหรู สบายตา เน้นการใช้งาน',
            range: [24, 59],
            class: 'theme-working',
            icon: 'fa-briefcase'
        },
        {
            id: 'elder',
            name: 'ชัดเจน สบายตา',
            desc: 'คุมโทนชัดเจน อ่านง่าย สบายตา',
            range: [60, 150],
            class: 'theme-elder',
            icon: 'fa-leaf'
        }
    ];

    // Determine Theme
    let recommendedThemeId = 'working';
    if (age >= 6 && age <= 23) recommendedThemeId = 'youth';
    else if (age >= 24 && age <= 59) recommendedThemeId = 'working';
    else if (age >= 60) recommendedThemeId = 'elder';

    let selectedThemeId = recommendedThemeId;

    // Update Header with Age
    const tagline = document.querySelector('.tagline');
    if (tagline) {
        tagline.innerHTML = `แนะนำธีมตามช่วงอายุ (<strong>อายุ ${age} ปี</strong>):`;
    }

    // Render Cards
    themes.forEach(theme => {
        const isRecommended = theme.id === recommendedThemeId;
        const card = document.createElement('div');
        card.className = `theme-card ${theme.class} ${isRecommended ? 'recommended selected' : ''}`;

        // Format range text
        let rangeText = `อายุ ${theme.range[0]} - ${theme.range[1]} ปี`;
        if (theme.range[1] > 100) rangeText = `อายุ ${theme.range[0]} ปีขึ้นไป`;

        card.innerHTML = `
            ${isRecommended ? '<span class="badge">แนะนำ</span>' : ''}
            <div class="theme-icon">
                <i class="fa-solid ${theme.icon}"></i>
            </div>
            <div class="theme-info">
                <h3>${theme.name}</h3>
                <p class="theme-range" style="font-size: 0.75rem; color: #a855f7; margin-bottom: 0.2rem; font-weight: 600;">
                    <i class="fa-regular fa-clock"></i> ${rangeText}
                </p>
                <p>${theme.desc}</p>
            </div>
            <div style="margin-left: auto;">
                ${isRecommended ? '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>' : '<i class="fa-regular fa-circle"></i>'}
            </div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.theme-card').forEach(c => {
                c.classList.remove('selected');
                c.querySelector('.fa-circle-check')?.classList.replace('fa-circle-check', 'fa-circle');
                c.querySelector('.fa-circle')?.classList.add('fa-regular');
            });
            card.classList.add('selected');
            const iconContainer = card.lastElementChild;
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>';
            selectedThemeId = theme.id;
        });

        container.appendChild(card);
    });

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

            // Also try update profiles table if possible (UPSERT)
            await _supabase.from('profiles').upsert({ id: user.id, theme: selectedThemeId });

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

    // Get Age
    let age = 25; // Default
    if (user.user_metadata?.age) age = user.user_metadata.age;

    if (ageTagline) {
        ageTagline.innerHTML = `แนะนำสำหรับวัย <strong>${age} ปี</strong>`;
    }

    // Define Features & Logic
    const features = [
        {
            id: 'medication',
            title: 'การรับประทานยา',
            desc: 'แจ้งเตือนและบันทึกการทานยา',
            icon: 'fa-pills',
            recommend: (a) => a >= 60 // Elder
        },
        {
            id: 'excretion',
            title: 'การขับถ่าย',
            desc: 'บันทึกสุขภาพการขับถ่าย',
            icon: 'fa-toilet',
            recommend: (a) => a >= 60 || (a >= 6 && a <= 12) // Elder & Kids
        },
        {
            id: 'sleep',
            title: 'การนอนหลับ',
            desc: 'วิเคราะห์คุณภาพการนอน',
            icon: 'fa-bed',
            recommend: (a) => a >= 24 // Working & Elder
        },
        {
            id: 'goals',
            title: 'ตั้งเป้าหมาย',
            desc: 'ตั้งเป้าหมายชีวิตและการเรียน',
            icon: 'fa-bullseye',
            recommend: (a) => a >= 13 && a <= 59 // Teen & Working
        },
        {
            id: 'exercise',
            title: 'ออกกำลังกาย',
            desc: 'ติดตามกิจกรรมออกกำลังกายรายวัน',
            icon: 'fa-dumbbell',
            recommend: (a) => a >= 13 && a <= 59 // Teen & Working
        },
        {
            id: 'period',
            title: 'ติดตามรอบเดือน',
            desc: 'บันทึกและคาดการณ์รอบเดือน',
            icon: 'fa-droplet',
            recommend: (a) => a >= 12 && a <= 50 // Teen & Working (Female context implied)
        },
        {
            id: 'vehicle',
            title: 'ยานพาหนะ',
            desc: 'ดูแลรถ/มอเตอร์ไซค์คู่ใจ',
            icon: 'fa-motorcycle',
            recommend: (a) => a >= 16 && a <= 59 // Teen & Working
        },
        {
            id: 'diet',
            title: 'บันทึกอาหาร',
            desc: 'คุมน้ำหนักและดูแลโภชนาการ',
            icon: 'fa-utensils',
            recommend: (a) => a >= 24 // Working (Diet) & Elder (Health)
        },
        {
            id: 'appointment',
            title: 'นัดหมายแพทย์',
            desc: 'แจ้งเตือนวันนัดหมอและวัคซีน',
            icon: 'fa-user-doctor',
            recommend: (a) => a >= 60 || (a >= 25 && a <= 45) // Elder & Parents
        }
    ];

    // Selected Set
    const selectedFeatures = new Set();

    // Load existing features if available
    let existingFeatures = [];
    if (user.user_metadata?.features) {
        existingFeatures = user.user_metadata.features;
    }

    // Check profile table too (Best effort)
    try {
        const { data: profile } = await _supabase
            .from('profiles')
            .select('features')
            .eq('id', user.id)
            .single();

        if (profile && profile.features) {
            let parsed = profile.features;
            if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed); }
                catch (e) { parsed = parsed.replace(/[{}"']/g, '').split(','); }
            }
            if (Array.isArray(parsed)) existingFeatures = parsed;
        }
    } catch (e) {
        // Ignore fetch error, start fresh or use metadata
    }

    if (Array.isArray(existingFeatures)) {
        existingFeatures.forEach(f => selectedFeatures.add(f));
    }

    // Render
    features.forEach(feat => {
        const isRecommended = feat.recommend(age);

        // Auto-select recommended ones initially?
        // Let's auto-select recommended ones for convenience
        if (isRecommended) selectedFeatures.add(feat.id);

        const card = document.createElement('div');
        card.className = `feature-card ${isRecommended ? 'selected' : ''}`;
        card.onclick = () => toggleFeature(card, feat.id);

        card.innerHTML = `
            ${isRecommended ? '<div class="recommend-badge">แนะนำ</div>' : ''}
            <div class="checkbox-overlay">
                <i class="fa-solid fa-check"></i>
            </div>
            <i class="fa-solid ${feat.icon} feature-icon"></i>
            <div class="feature-title">${feat.title}</div>
            <div class="feature-desc">${feat.desc}</div>
        `;

        grid.appendChild(card);
    });

    function toggleFeature(cardDom, id) {
        if (selectedFeatures.has(id)) {
            selectedFeatures.delete(id);
            cardDom.classList.remove('selected');
        } else {
            selectedFeatures.add(id);
            cardDom.classList.add('selected');
        }
    }

    // Save Logic
    saveBtn.addEventListener('click', async () => {
        const btn = saveBtn;
        const originalContent = btn.innerHTML;
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

            // Update Profile Table (UPSERT for robustness)
            // upsert will insert if it doesn't exist, or update if it does.
            await _supabase.from('profiles').upsert({
                id: user.id,
                features: featuresArray
            });

            // Success redirect to dashboard
            alert('ตั้งค่าสำเร็จ! เริ่มต้นใช้งาน CareFate');
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}
