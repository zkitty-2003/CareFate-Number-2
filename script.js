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
            showNotification('เข้าสู่ระบบไม่สำเร็จ: อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
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
                    <div class="input-group">
                        <i class="fa-solid fa-lock input-icon"></i>
                        <input type="password" id="newPassword" placeholder="รหัสผ่านใหม่" style="width:100%; padding: 12px 12px 12px 40px; border-radius:12px; border:1px solid #ddd;">
                    </div>
                    <button id="updatePasswordBtn" class="btn-primary" style="margin-top:1rem; width:100%;">ยืนยัน</button>
                    <div style="text-align:center; margin-top:1rem;">
                        <a href="index.html" style="color:#666; font-size:0.9rem;">ยกเลิก</a>
                    </div>
                </div>
            </div>
        `;

        // Re-attach listener
        setTimeout(() => {
            const btn = document.getElementById('updatePasswordBtn');
            if (btn) {
                btn.onclick = async () => {
                    const newPwd = document.getElementById('newPassword').value;
                    if (!newPwd) return alert('กรุณากรอกรหัสผ่าน');

                    const btn = document.getElementById('updatePasswordBtn');
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังเปลี่ยน...';
                    btn.disabled = true;

                    const { error } = await _supabase.auth.updateUser({ password: newPwd });

                    if (error) {
                        alert('เกิดข้อผิดพลาด: ' + error.message);
                        btn.innerHTML = 'ยืนยัน';
                        btn.disabled = false;
                    } else {
                        alert('เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่');
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
                        <div class="logo-icon" style="margin: 0 auto 1.5rem; background: var(--success);">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <h1 class="app-name">ยืนยันอีเมลเรียบร้อย!</h1>
                        <p class="tagline" style="margin-top: 1rem; color: #fff;">
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

                const { error } = await _supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/index.html#reset=true',
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
});
