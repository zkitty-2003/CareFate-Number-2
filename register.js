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
    const today = (() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })(); // Simple YYYY-MM-DD
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
            el.style.color = '#cbd5e1';
            icon.className = 'fa-solid fa-circle-info';
            icon.style.color = '#94a3b8';
        }
    };

    const validateRules = (pass) => {
        return {
            length: pass.length >= 7 && pass.length <= 20,
            english: /^[a-zA-Z0-9]*$/.test(pass), // Simplified: will be refined by complexity
            complexity: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])/.test(pass),
            noSpecial: !/[^a-zA-Z0-9]/.test(pass)
        };
    };

    passwordInput.addEventListener('input', (e) => {
        const pass = e.target.value;
        const rules = validateRules(pass);

        updateReqUI(reqLength, rules.length);
        updateReqUI(reqEnglish, /^[a-zA-Z0-9]*$/.test(pass) && pass.length > 0);
        updateReqUI(reqComplexity, rules.complexity);
        updateReqUI(reqSpecial, rules.noSpecial && pass.length > 0);
    });

    // Validation
    const validateDate = (input) => {
        if (input.value > today) {
            showInAppNotification('ข้อผิดพลาด', "วันเกิดไม่สามารถอยู่ในอนาคตได้");
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
        const password = passwordInput.value;

        // Validation 1: Date
        if (dob > today) {
            showInAppNotification('ข้อผิดพลาด', "วันเกิดไม่สามารถอยู่ในอนาคตได้");
            return;
        }

        // Validation 2: Password Complexity (Granular)
        const rules = validateRules(password);
        let errorMsg = "";

        if (!rules.length) {
            errorMsg = "รหัสผ่านต้องมีความยาว 7-20 ตัวอักษร";
        } else if (!/[a-zA-Z]/.test(password)) {
            errorMsg = "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ";
        } else if (!rules.complexity) {
            errorMsg = "รหัสผ่านต้องประกอบด้วยตัวเลข ตัวพิมพ์ใหญ่ และตัวพิมพ์เล็ก";
        } else if (!rules.noSpecial) {
            errorMsg = "รหัสผ่านห้ามมีอักขระพิเศษ (@ # $ %)";
        }

        if (errorMsg) {
            showInAppNotification('รหัสผ่านไม่ปลอดภัย', errorMsg);
            // Highlight the specific failing requirement in red temporarily
            const failId = !rules.length ? 'req-length' :
                (!/[a-zA-Z]/.test(password) ? 'req-english' :
                    (!rules.complexity ? 'req-complexity' : 'req-special'));
            const failEl = document.getElementById(failId);
            if (failEl) {
                failEl.style.color = 'var(--danger)';
                failEl.querySelector('i').style.color = 'var(--danger)';
                failEl.querySelector('i').className = 'fa-solid fa-circle-xmark';
            }
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

            // Supabase returns empty identities when email is already registered
            // (it hides this for security, but we can detect it this way)
            if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
                showInAppNotification('อีเมลซ้ำ', 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น');
                btn.innerHTML = originalContent;
                btn.disabled = false;
                return;
            }

            console.log("Signup success:", authData);

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
                    <p style="margin-top: 1.5rem; color: #64748b; font-size: 0.875rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #f1f5f9;">
                        คลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชีของคุณ
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
            id: 'goals',
            title: 'เป้าหมาย',
            icon: 'fa-bullseye',
            recommend: (a) => a >= 6 && a <= 59
        },
        {
            id: 'exercise',
            title: 'ออกกำลัง',
            icon: 'fa-dumbbell',
            recommend: (a) => a >= 6 && a <= 59
        },
        {
            id: 'period',
            title: 'รอบเดือน',
            icon: 'fa-droplet',
            recommend: (a) => a >= 12 && a <= 50
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
        const isRecommended = feat.recommend(age);

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
            // alert('ตั้งค่าสำเร็จ! เริ่มต้นใช้งาน CareFate'); // Redirecting anyway
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}
