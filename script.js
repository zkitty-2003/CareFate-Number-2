document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const togglePasswordIcon = togglePasswordBtn.querySelector('i');

    // Initialize Supabase
    const SUPABASE_URL = 'https://rjszmmogkiblqojikcow.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_RoboGAH-Nqm1dQi3ORqYUQ_StZ7uU4Y';
    let _supabase;

    try {
        if (typeof window.supabase !== 'undefined') {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error("Supabase library not loaded!");
        }
    } catch (e) { console.error("Supabase init error:", e); }

    // State
    let isPasswordVisible = false;

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        isPasswordVisible = !isPasswordVisible;
        if (isPasswordVisible) {
            passwordInput.type = 'text';
            togglePasswordIcon.classList.remove('fa-eye-slash');
            togglePasswordIcon.classList.add('fa-eye');
        } else {
            passwordInput.type = 'password';
            togglePasswordIcon.classList.remove('fa-eye');
            togglePasswordIcon.classList.add('fa-eye-slash');
        }
    });

    // Handle Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const btn = document.querySelector('.btn-primary');
        const originalContent = btn.innerHTML;

        if (!validateEmail(email)) {
            showNotification('กรุณากรอกอีเมลให้ถูกต้อง', 'error');
            return;
        }

        // Loading UI
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังเข้าสู่ระบบ...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        if (!_supabase) {
            showNotification('ข้อผิดพลาดระบบ: Supabase ไม่ได้โหลด', 'error');
            btn.innerHTML = originalContent;
            btn.disabled = false;
            return;
        }

        try {
            // 1. Login with Supabase
            const { data, error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            console.log("Login success, checking profile...");
            const user = data.user;

            // ── Clear stale data from previous user session ──
            const previousUserId = localStorage.getItem('carefate_user_id');
            if (previousUserId && previousUserId !== user.id) {
                const healthKeys = [
                    'sleep_logs', 'exercise_logs', 'excretion_logs',
                    'med_schedule', 'goals_data', 'period_logs',
                    'food_logs', 'vehicle_logs', 'medication_logs',
                    'appointment_logs', 'notification_history', 'chat_history'
                ];
                healthKeys.forEach(key => localStorage.removeItem(key));
                console.log('Health data cleared: new user session detected.');
            }
            localStorage.setItem('carefate_user_id', user.id);

            // 2. Check Profile Strategy
            let hasTheme = false;
            let hasFeatures = false;

            try {
                // Check profiles table
                const { data: profile, error: profileError } = await _supabase
                    .from('profiles')
                    .select('theme, features')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.warn("Profile query error:", profileError.message);
                }

                if (profile) {
                    if (profile.theme) hasTheme = true;
                    if (profile.features && Array.isArray(profile.features) && profile.features.length > 0) hasFeatures = true;
                }
            } catch (err) {
                console.warn("Profile check failed", err);
            }

            // Fallback 1: check user_metadata (theme-selection saves here)
            if (!hasTheme && user.user_metadata?.theme) {
                hasTheme = true;
                console.log("Theme found in user_metadata:", user.user_metadata.theme);
            }
            if (!hasFeatures && user.user_metadata?.features && Array.isArray(user.user_metadata.features) && user.user_metadata.features.length > 0) {
                hasFeatures = true;
                console.log("Features found in user_metadata:", user.user_metadata.features);
            }

            // Fallback 2: check localStorage
            if (!hasTheme && localStorage.getItem('selectedTheme')) {
                hasTheme = true;
            }
            if (!hasFeatures && localStorage.getItem('selectedFeatures')) {
                hasFeatures = true;
            }

            console.log("hasTheme:", hasTheme, "hasFeatures:", hasFeatures);

            // Redirect Logic
            if (!hasTheme) {
                window.location.href = 'theme-selection.html';
            } else if (!hasFeatures) {
                window.location.href = 'feature-selection.html';
            } else {
                showNotification(`กำลังพาไปหน้าหลัก...`, 'success');
                window.location.href = 'dashboard.html';
            }

        } catch (error) {
            console.error(error);
            const errorMsg = error.message || '';
            if (errorMsg.toLowerCase().includes('confirm') || errorMsg.toLowerCase().includes('verify')) {
                await handleAutoResendVerification(email);
            } else {
                showNotification('เข้าสู่ระบบไม่สำเร็จ: อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
            }
            btn.innerHTML = originalContent;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });

    // Input animation helpers
    const inputs = [emailInput, passwordInput];
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });

    // --- Helper Functions ---
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications first to prevent stacking
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';

        notification.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        // Inline styles for reliability
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%) translateY(-20px)',
            opacity: '0',
            background: type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : '#333'),
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: '9999',
            transition: 'all 0.3s ease',
            fontSize: '0.9rem',
            fontWeight: '500',
            minWidth: '300px'
        });

        document.body.appendChild(notification);

        // Animate In
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // --- Supabase Auth State Change Listener ---
    _supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth Event:", event);

        if (event === 'PASSWORD_RECOVERY') {
            console.log("PASSWORD_RECOVERY event received");
            renderResetPasswordUI();
        }
    });

    function renderResetPasswordUI() {
        document.body.innerHTML = `
            <div class="app-container" style="display:flex; justify-content:center; align-items:center; min-height:100vh;">
                <div class="login-screen" style="width:100%; max-width:400px; padding:2rem;">
                    <div class="login-header">
                        <h1 class="app-name">ตั้งรหัสผ่านใหม่</h1>
                        <p class="tagline">กรุณากรอกรหัสผ่านใหม่ของคุณ</p>
                    </div>

                    <div class="input-group" style="margin-bottom: 1rem; position:relative; display:flex; align-items:center;">
                        <i class="fa-solid fa-key input-icon"></i>
                        <input type="password" id="newPassword" placeholder="รหัสผ่านใหม่" style="width:100%; background:transparent; border:none; padding:1.2rem 1.2rem 1.2rem 3.5rem; color:#0f172a; font-size:1rem; outline:none;">
                        <button type="button" id="toggleNew" style="position:absolute; right:1.25rem; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; padding:0; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-eye-slash" id="eyeNewIcon" style="font-size:1.1rem;"></i>
                        </button>
                    </div>

                    <div class="input-group" style="margin-bottom: 1rem; position:relative; display:flex; align-items:center;">
                        <i class="fa-solid fa-circle-check input-icon"></i>
                        <input type="password" id="confirmPassword" placeholder="ยืนยันรหัสผ่านใหม่" style="width:100%; background:transparent; border:none; padding:1.2rem 1.2rem 1.2rem 3.5rem; color:#0f172a; font-size:1rem; outline:none;">
                        <button type="button" id="toggleConfirm" style="position:absolute; right:1.25rem; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; padding:0; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-eye-slash" id="eyeConfirmIcon" style="font-size:1.1rem;"></i>
                        </button>
                    </div>
                    
                    <div style="font-size:0.85rem; color:#64748b; margin-top:0.75rem; line-height:1.5; background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:left;">
                        <strong style="color:#475569; display:block; margin-bottom:4px;">เงื่อนไขรหัสผ่าน:</strong>
                        • ความยาว 7-20 ตัวอักษร<br>
                        • ต้องเป็นตัวอักษรภาษาอังกฤษ<br>
                        • ต้องมีตัวเลข, ตัวพิมพ์เล็ก และตัวพิมพ์ใหญ่<br>
                        • ห้ามมีอักขระพิเศษ (@ # $ %)
                    </div>

                    <button id="updatePasswordBtn" class="btn-primary" style="margin-top:1.5rem; width:100%;">ยืนยัน</button>
                    <div style="text-align:center; margin-top:1.2rem;">
                        <a href="index.html" style="color:#64748b; font-size:0.9rem; text-decoration:none; font-weight:600; transition:color 0.3s;" onmouseover="this.style.color='#8b5cf6'" onmouseout="this.style.color='#64748b'">ยกเลิก</a>
                    </div>
                </div>
            </div>
        `;

        // Re-attach listener
        setTimeout(() => {
            // Eye toggle — newPassword
            document.getElementById('toggleNew').addEventListener('click', () => {
                const inp = document.getElementById('newPassword');
                const icon = document.getElementById('eyeNewIcon');
                const show = inp.type === 'password';
                inp.type = show ? 'text' : 'password';
                icon.className = show ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
            });
            // Eye toggle — confirmPassword
            document.getElementById('toggleConfirm').addEventListener('click', () => {
                const inp = document.getElementById('confirmPassword');
                const icon = document.getElementById('eyeConfirmIcon');
                const show = inp.type === 'password';
                inp.type = show ? 'text' : 'password';
                icon.className = show ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
            });

            const btn = document.getElementById('updatePasswordBtn');
            if (btn) {
                btn.onclick = async () => {
                    const newPwd = document.getElementById('newPassword').value;
                    const confirmPwd = document.getElementById('confirmPassword').value;

                    // Basic Empty Check
                    if (!newPwd) return alert('กรุณากรอกรหัสผ่านใหม่');
                    if (!confirmPwd) return alert('กรุณายืนยันรหัสผ่านใหม่');

                    // Match Check
                    if (newPwd !== confirmPwd) {
                        return alert('รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน');
                    }

                    // Validation Rules: 7-20 chars, A-Z, a-z, 0-9, No Special Chars
                    const lengthValid = newPwd.length >= 7 && newPwd.length <= 20;
                    const hasNumber = /\d/.test(newPwd);
                    const hasLower = /[a-z]/.test(newPwd);
                    const hasUpper = /[A-Z]/.test(newPwd);
                    // Ensure only alphanumeric (bans special chars including @ # $ %)
                    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(newPwd);

                    if (!lengthValid) return alert('รหัสผ่านต้องมีความยาว 7-20 ตัวอักษร');
                    if (!hasNumber) return alert('รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว');
                    if (!hasLower) return alert('รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว');
                    if (!hasUpper) return alert('รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว');
                    if (!isAlphanumeric) return alert('รหัสผ่านต้องเป็นตัวอักษรภาษาอังกฤษ และห้ามมีอักขระพิเศษ (@ # $ %)');

                    const btn = document.getElementById('updatePasswordBtn');
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังเปลี่ยน...';
                    btn.disabled = true;

                    const { error } = await _supabase.auth.updateUser({ password: newPwd });

                    if (error) {
                        let msg = `เกิดข้อผิดพลาด: ${error.message}`;
                        const e = error.message.toLowerCase();
                        if (e.includes('same password') || e.includes('different from') || e.includes('previously used')) {
                            msg = '❌ ไม่สามารถใช้รหัสผ่านเดิมได้ กรุณาตั้งรหัสผ่านใหม่ที่แตกต่างออกไป';
                        } else if (e.includes('session missing') || e.includes('auth session') || e.includes('not authenticated')) {
                            msg = `⏰ ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว\nกรุณาขอลิงก์ใหม่อีกครั้งที่หน้า Login\n(รายละเอียด: ${error.message})`;
                        } else if (e.includes('weak password') || e.includes('password')) {
                            msg = '❌ รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย กรุณาตรวจสอบเงื่อนไขด้านล่าง';
                        }
                        alert(msg);
                        btn.innerHTML = 'ยืนยัน';
                        btn.disabled = false;
                    } else {
                        try {
                            await _supabase.auth.signOut();
                        } catch (signOutErr) {
                            console.warn("Sign out during recovery failed:", signOutErr);
                        }
                        alert('✅ เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่');
                        window.location.href = 'index.html';
                    }
                };
            }
        }, 100);
    }

    // --- Auto-Login Check (for Email Redirect) ---
    checkSession();

    async function checkSession() {
        if (!_supabase) return;

        // --- Manual Session Recovery for malformed hashes (e.g. starting with #reset=true) ---
        const rawHash = window.location.hash;
        if (rawHash.includes('access_token=')) {
            console.log("Access token found in hash. Attempting manual session recovery...");
            const hashParts = rawHash.substring(1).split(/[#&]/);
            let accessToken = '';
            let refreshToken = '';
            let isRecovery = false;

            hashParts.forEach(part => {
                const subParts = part.split('?');
                subParts.forEach(sp => {
                    if (sp.startsWith('access_token=')) {
                        accessToken = sp.substring('access_token='.length);
                    } else if (sp.startsWith('refresh_token=')) {
                        refreshToken = sp.substring('refresh_token='.length);
                    } else if (sp.startsWith('type=')) {
                        const t = sp.substring('type='.length);
                        if (t === 'recovery') isRecovery = true;
                    } else if (sp === 'type=recovery') {
                        isRecovery = true;
                    }
                });
            });

            if (accessToken) {
                console.log("Manually setting session from hash to fix GoTrue parsing...");
                try {
                    const { data, error } = await _supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || accessToken
                    });
                    if (error) {
                        console.error("Manual setSession error:", error);
                    } else {
                        console.log("Manual setSession successful!", data);
                        // Force render Reset Password UI if this is a recovery attempt
                        if (isRecovery || rawHash.includes('recovery') || rawHash.includes('reset=')) {
                            showNotification('กรุณาตั้งรหัสผ่านใหม่', 'info');
                            renderResetPasswordUI();
                            // Clean up hash from URL
                            window.history.replaceState(null, '', window.location.pathname);
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Manual setSession exception:", e);
                }
            }
        }

        // Force Supabase GoTrue to parse URL hash parameters and establish session first
        try {
            await _supabase.auth.getSession();
        } catch (e) {
            console.warn("Hash parsing error:", e);
        }

        // 0. PRIORITY CHECK: Password Recovery
        // Check if URL contains recovery token or identifier
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        if (params.get('type') === 'recovery' || params.get('reset') === 'true') {
            console.log("Recovery flow detected from URL");
            // Stop auto-redirect logic and let onAuthStateChange handle it, 
            // OR handle it explicitly here if onAuthStateChange is too slow.

            // Let's handle it explicitly to be safe:
            showNotification('กรุณาตั้งรหัสผ่านใหม่', 'info');
            renderResetPasswordUI();
            return;
        }

        // 1. Check for URL Errors (e.g. Link Expired from Supabase)
        // Supabase returns errors in the hash fragment: #error=access_denied&error_code=403...
        // const hash = window.location.hash.substring(1); // Already got hash above
        const errorDesc = params.get('error_description');

        if (errorDesc) {
            console.error("Auth Error:", errorDesc);
            showNotification('เกิดข้อผิดพลาดในการยืนยันตัวตน หรือลิงก์หมดอายุ', 'error');
            // Clean URL to avoid confusion
            window.history.replaceState(null, '', window.location.pathname);
            return;
        }

        // 2. Check Session
        const { data: { session } } = await _supabase.auth.getSession();

        if (session) {
            console.log("Session found.");

            // Try to check profile silently
            let hasTheme = false;
            try {
                const { data: profile } = await _supabase
                    .from('profiles')
                    .select('theme')
                    .eq('id', session.user.id)
                    .single();
                if (profile && profile.theme) hasTheme = true;
            } catch (e) {
                console.warn("Silent profile check failed", e);
            }

            // Fallback: check user_metadata
            if (!hasTheme && session.user.user_metadata?.theme) {
                hasTheme = true;
            }

            if (!hasTheme) {
                // --- NEW FLOW: Show "Email Verified" UI instead of Redirecting ---
                // This gives the user the "Press to Confirm" step they wanted.

                const loginScreen = document.querySelector('.login-screen');
                // Replace the entire login form with a success message
                loginScreen.innerHTML = `
                    <div class="logo-container" style="text-align: center; animation: fadeIn 0.5s;">
                        <div class="logo-icon" style="margin: 0 auto 1.5rem; background: var(--success); box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.3);">
                            <i class="fa-solid fa-check" style="color: white; font-size: 2rem;"></i>
                        </div>
                        <h1 class="app-name" style="font-size: 1.875rem; color: #1e293b; margin-bottom: 0.5rem;">ยืนยันอีเมลเรียบร้อย!</h1>
                        <p class="tagline" style="margin-top: 1rem; color: #64748b; font-size: 1rem; line-height: 1.5;">
                            บัญชีของคุณได้รับการเปิดใช้งานแล้ว
                        </p>
                        
                        <div style="margin-top: 2rem;">
                            <button id="continueBtn" class="btn-primary" style="width: 100%;">
                                <span>ไปที่หน้าเลือกธีม</span>
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Add click listener to the new button
                document.getElementById('continueBtn').addEventListener('click', () => {
                    window.location.href = 'theme-selection.html';
                });

            } else {
                // User already has a theme — go directly to dashboard
                window.location.href = 'dashboard.html';
            }
        }
    }

    // --- Forgot Password Logic ---
    const forgotPasswordLink = document.querySelector('.forgot-password');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeCallbacks = document.querySelectorAll('.close-modal, .close-modal-btn');
    const sendResetLinkBtn = document.getElementById('sendResetLinkBtn');
    const resetEmailInput = document.getElementById('resetEmail');

    // Open Modal
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordModal.classList.add('active');
        });
    }

    // Close Modal
    closeCallbacks.forEach(btn => {
        btn.addEventListener('click', () => {
            forgotPasswordModal.classList.remove('active');
        });
    });

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.classList.remove('active');
        }
    });

    // Send Reset Link
    if (sendResetLinkBtn) {
        sendResetLinkBtn.addEventListener('click', async () => {
            const email = resetEmailInput.value.trim();
            const btn = sendResetLinkBtn;
            const originalContent = btn.innerHTML;

            if (!validateEmail(email)) {
                showNotification('กรุณากรอกอีเมลให้ถูกต้อง', 'error');
                return;
            }

            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังส่ง...';
            btn.disabled = true;

            try {
                if (!_supabase) throw new Error("Supabase not initialized");

                // 1. Check if the email exists and is verified first
                try {
                    const { data: checkData, error: checkError } = await _supabase.rpc('check_email_verified', { input_email: email });
                    if (checkError) {
                        throw checkError;
                    }
                    if (checkData) {
                        if (!checkData.exists) {
                            showNotification('ไม่พบอีเมลนี้ในระบบ', 'error');
                            return;
                        }
                        if (!checkData.verified) {
                            showNotification('❌ ไม่สามารถรีเซ็ตได้: บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณากดยืนยันอีเมลของคุณก่อน หรือล็อกอินด้วยอีเมล/รหัสผ่านเพื่อรับลิงก์ยืนยันตัวตนใหม่', 'error');
                            return;
                        }
                    } else {
                        throw new Error('ไม่สามารถตรวจสอบสถานะการยืนยันอีเมลได้');
                    }
                } catch (ce) {
                    console.error("check_email_verified RPC failed:", ce);
                    let msg = '❌ ระบบความปลอดภัย: ไม่สามารถตรวจสอบสถานะบัญชีได้';
                    if (ce.message && ce.message.includes('does not exist')) {
                        msg += '\n(ตรวจสอบเพิ่มเติม: กรุณารันสคริปต์ SQL ใน Supabase Dashboard SQL Editor เพื่อลงทะเบียนฟังก์ชัน check_email_verified)';
                    } else {
                        msg += '\n(กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ)';
                    }
                    showNotification(msg, 'error');
                    return; // Block! Do not proceed to reset password.
                }

                // 2. Proceed with resetPasswordForEmail
                const { error } = await _supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/index.html',
                });

                if (error) throw error;

                showNotification('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว', 'success');
                forgotPasswordModal.classList.remove('active');
                resetEmailInput.value = ''; // Clear input

            } catch (error) {
                console.error("Reset Password Error:", error);

                let msg = 'ไม่สามารถส่งลิงก์ได้: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง');

                // Translate common errors
                if (error.message.includes("Rate limit")) msg = 'คุณขอรหัสผ่านบ่อยเกินไป กรุณารอสักครู่ (60 วินาที)';
                if (error.message.includes("User not found")) msg = 'ไม่พบอีเมลนี้ในระบบ';

                showNotification(msg, 'error');
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });
    }

    async function handleAutoResendVerification(email) {
        let allowed = true;
        let diffMs = 0;
        let resendCount = 0;
        let nextCooldownMins = 5;
        let useFallback = false;

        // Try calling the Supabase RPC first to check and update database state
        try {
            const { data: dbData, error: dbError } = await _supabase.rpc('check_and_update_resend_cooldown', { input_email: email });
            
            if (dbError) throw dbError;

            if (dbData) {
                if (dbData.status === 'error') {
                    showNotification(`❌ ${dbData.message}`, 'error');
                    return;
                }

                allowed = dbData.allowed;
                diffMs = dbData.diff_ms || 0;
                resendCount = dbData.resend_count || 0;
                nextCooldownMins = dbData.next_cooldown_mins || 5;
            } else {
                useFallback = true;
            }
        } catch (e) {
            console.warn("Supabase RPC failed or migration not run. Falling back to localStorage:", e);
            useFallback = true;
        }

        // Fallback to client-side localStorage cooldown
        if (useFallback) {
            const now = Date.now();
            resendCount = parseInt(localStorage.getItem('carefate_resend_count') || '0');
            const nextAllowedTime = parseInt(localStorage.getItem('carefate_next_resend_allowed_time') || '0');

            if (nextAllowedTime && now < nextAllowedTime) {
                allowed = false;
                diffMs = nextAllowedTime - now;
            } else {
                allowed = true;
                resendCount += 1;
                nextCooldownMins = 5 * Math.pow(2, resendCount - 1);
            }
        }

        // Enforce cooldown if not allowed
        if (!allowed) {
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.ceil((diffMs % 60000) / 1000);
            
            let timeDesc = '';
            if (diffMins > 0) {
                timeDesc = `${diffMins} นาที ${diffSecs} วินาที`;
            } else {
                timeDesc = `${diffSecs} วินาที`;
            }

            const existing = document.querySelector('.notification');
            if (existing) existing.remove();

            showNotification(`🔒 คุณส่งคำขอถี่เกินไป กรุณารออีก ${timeDesc} เพื่อขอลิงก์ใหม่ (หรือเช็กในกล่อง Inbox/อีเมลขยะ)`, 'error');
            return;
        }

        // Show loading notification first
        showNotification('กำลังส่งลิงก์ยืนยันตัวตนใหม่...', 'info');

        try {
            const { error } = await _supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                    emailRedirectTo: window.location.origin + '/index.html'
                }
            });

            if (error) throw error;

            // If we used the localStorage fallback, write back the updated state to localStorage
            if (useFallback) {
                localStorage.setItem('carefate_resend_count', resendCount.toString());
                localStorage.setItem('carefate_next_resend_allowed_time', (Date.now() + nextCooldownMins * 60 * 1000).toString());
            }

            // Show beautiful custom notification for success
            showAutoResendSuccessNotification(email, nextCooldownMins);

        } catch (err) {
            console.error("Auto resend error:", err);
            
            // Rollback database/local cooldown since resend failed
            try {
                if (!useFallback) {
                    await _supabase.rpc('rollback_resend_cooldown', { input_email: email });
                } else {
                    localStorage.setItem('carefate_resend_count', Math.max(0, resendCount - 1).toString());
                    localStorage.setItem('carefate_next_resend_allowed_time', '0');
                }
            } catch (re) {
                console.warn("Rollback failed:", re);
            }

            let msg = err.message || '';
            if (msg.includes('security purposes') || msg.includes('after') || msg.includes('rate_limit') || msg.includes('Rate limit')) {
                const secondsMatch = msg.match(/\d+/);
                const secs = secondsMatch ? secondsMatch[0] : '60';
                msg = `⏳ ระบบความปลอดภัย: เพิ่งมีการส่งอีเมลไปเมื่อครู่ กรุณารออีกประมาณ ${secs} วินาที ก่อนลองล็อกอินใหม่อีกครั้ง (หรือตรวจสอบกล่อง Inbox/อีเมลขยะ)`;
            } else {
                msg = 'อีเมลนี้ยังไม่ได้ยืนยันตัวตน แต่ไม่สามารถส่งลิงก์ใหม่ได้โดยอัตโนมัติ: ' + msg;
            }
            
            showNotification(msg, 'error');
        }
    }

    function showAutoResendSuccessNotification(email, nextCooldownMins) {
        // Remove existing notifications first
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification success`;

        notification.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-paper-plane" style="font-size: 1.1rem; color: #ffffff;"></i>
                    <span style="font-weight:700; font-size:0.95rem; color: #ffffff;">ส่งลิงก์ยืนยันฉบับใหม่แล้ว!</span>
                </div>
                <span style="font-size:0.8rem; line-height:1.4; color: rgba(255,255,255,0.95);">
                    เราได้ส่งลิงก์ยืนยันตัวตนฉบับใหม่ไปที่ <strong style="text-decoration:underline;">${email}</strong> เรียบร้อยแล้ว กรุณากดยืนยันตัวตนภายใน 24 ชม. 📬
                </span>
                <span style="font-size:0.725rem; line-height:1.3; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.15); padding: 6px 10px; border-radius: 8px; margin-top: 4px;">
                    💡 <strong>เพื่อป้องกันสแปม:</strong> หากขอลิงก์ใหม่ครั้งถัดไป คุณจะต้องรอเป็นเวลา <strong>${nextCooldownMins} นาที</strong>
                </span>
            </div>
        `;

        // Inline styles matching showNotification but styled as success green
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%) translateY(-20px)',
            opacity: '0',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            zIndex: '9999',
            transition: 'all 0.3s ease',
            fontSize: '0.9rem',
            width: '90%',
            maxWidth: '360px'
        });

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Remove notification after 15 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 15000);
    }
});
