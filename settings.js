const SUPABASE_URL = 'https://rjszmmogkiblqojikcow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RoboGAH-Nqm1dQi3ORqYUQ_StZ7uU4Y';

let _supabase;
let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Auth Check
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;

    // Load Profile
    await loadUserProfile();

    // Listeners
    document.getElementById('avatarInput').addEventListener('change', uploadAvatar);
    document.getElementById('updateProfileBtn').addEventListener('click', updateProfile);
    document.getElementById('changePasswordBtn').addEventListener('click', changePassword);
    document.getElementById('saveThemeBtn').addEventListener('click', saveTheme);
});

let selectedThemeToSave = null; // Track pending theme change

async function loadUserProfile() {
    try {
        // Fetch from profiles
        const { data, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        // Fallback to metadata if profile missing
        currentProfile = data || {};

        const username = currentProfile.username || currentUser.user_metadata.username || '';
        const theme = currentProfile.theme || currentUser.user_metadata.theme || 'working';
        const avatarUrl = currentProfile.avatar_url; // Assuming this column exists or will be added

        // UI Populate
        document.getElementById('usernameInput').value = username;
        document.getElementById('emailInput').value = currentUser.email;

        // Theme UI
        applyTheme(theme);
        updateThemeSelectionUI(theme);

        // Avatar UI (Priority: Supabase -> LocalStorage -> Default)
        if (avatarUrl && avatarUrl.startsWith('http')) {
            const preview = document.getElementById('avatarPreview');
            preview.innerHTML = `<img src="${avatarUrl}" alt="Profile">`;
        } else {
            // Check LocalStorage Fallback
            const localAvatar = localStorage.getItem(`avatar_${currentUser.id}`);
            if (localAvatar) {
                const preview = document.getElementById('avatarPreview');
                preview.innerHTML = `<img src="${localAvatar}" alt="Profile">`;
            }
        }

    } catch (e) {
        console.error("Load Profile Error:", e);
    }
}

// --- Features ---

// 1. Theme Change
// 1. Theme Change (Visual Only)
function selectTheme(themeId) {
    applyTheme(themeId);
    updateThemeSelectionUI(themeId);
    selectedThemeToSave = themeId;
    // console.log(`Selected theme (pending save): ${themeId}`);
}

// Explicit Save Theme Button Logic
async function saveTheme() {
    if (!selectedThemeToSave) {
        // If user didn't select anything new, but clicked save, verify current
        selectedThemeToSave = currentProfile.theme || 'working';
    }

    const btn = document.getElementById('saveThemeBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    try {
        // 1. Update Profile (Priority)
        const { error } = await _supabase.from('profiles').upsert({
            id: currentUser.id,
            theme: selectedThemeToSave
            // updated_at removed due to schema mismatch
        });

        if (error) throw error;

        // 2. Update Metadata (Fallback)
        await _supabase.auth.updateUser({ data: { theme: selectedThemeToSave } });

        console.log("Theme saved successfully.");
        alert("บันทึกธีมเรียบร้อยแล้ว");

    } catch (e) {
        console.error("Failed to save theme:", e);
        alert("ไม่สามารถบันทึกธีมได้: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function applyTheme(themeId) {
    document.body.classList.remove('theme-youth', 'theme-working', 'theme-elder');
    document.body.classList.add(`theme-${themeId}`);

    // Helper to update CSS vars immediately if needed
    let primaryColor;
    if (themeId === 'youth') primaryColor = '#ec4899';
    else if (themeId === 'elder') primaryColor = '#10b981';
    else primaryColor = '#6366f1';
    document.documentElement.style.setProperty('--primary-color', primaryColor);
}

function updateThemeSelectionUI(activeId) {
    document.querySelectorAll('.theme-mini-card').forEach(c => c.classList.remove('active'));
    const btn = document.getElementById(`theme-btn-${activeId}`);
    if (btn) btn.classList.add('active');
}

// 2. Upload Avatar (with LocalStorage Fallback)
async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        alert("ขนาดไฟล์ต้องไม่เกิน 2MB");
        return;
    }

    // 1. Convert to Base64 for Preview & Fallback
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64String = ev.target.result;

        // Show Preview
        document.getElementById('avatarPreview').innerHTML = `<img src="${base64String}" alt="Preview">`;

        try {
            // Attempt Supabase Upload (Best Effort)
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Try to upload to 'avatars' bucket
            const { error: uploadError } = await _supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                // Determine if it is a missing bucket error
                if (uploadError.message.includes('Bucket not found') || uploadError.error === 'Bucket not found') {
                    console.warn("Avatars bucket missing, using LocalStorage fallback.");
                    saveAvatarToLocal(base64String);
                    alert("บันทึกรูปโปรไฟล์เรียบร้อย (บันทึกในเครื่อง)");
                } else {
                    throw uploadError;
                }
            } else {
                // Success Supabase Upload
                const { data: { publicUrl } } = _supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                // Update Profile with URL
                await _supabase.from('profiles').upsert({
                    id: currentUser.id,
                    avatar_url: publicUrl
                });
                alert('อัปโหลดรูปโปรไฟล์เรียบร้อย');
            }

        } catch (error) {
            console.error("Storage Error:", error);
            // General Fallback
            console.warn("Upload failed, falling back to LocalStorage");
            saveAvatarToLocal(base64String);
            alert("อัปโหลดไม่สำเร็จ บันทึกรูปลงในเครื่องแทน");
        }
    };
    reader.readAsDataURL(file);
}

// Fallback Helper
async function saveAvatarToLocal(base64) {
    try {
        // Save to LocalStorage
        localStorage.setItem(`avatar_${currentUser.id}`, base64);

        // Also try to update profile with a flag or just rely on local loader
        // We will store a special 'local' marker or just rely on the frontend to check LS
    } catch (e) {
        console.error("LocalStorage Error (Quota?)", e);
        alert("ไม่สามารถบันทึกรูปได้ (ความจำเต็ม)");
    }
}

// 3. Update Profile (Name & Email)
async function updateProfile() {
    const btn = document.getElementById('updateProfileBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    const newName = document.getElementById('usernameInput').value.trim();
    const newEmail = document.getElementById('emailInput').value.trim();

    try {
        // Update Name
        if (newName) {
            await _supabase.from('profiles').upsert({
                id: currentUser.id,
                username: newName
            });
            // Update Metadata as fallback
            await _supabase.auth.updateUser({ data: { username: newName } });
        }

        // Update Email (if changed)
        if (newEmail && newEmail !== currentUser.email) {
            const { error } = await _supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
            alert(`กรุณาตรวจสอบอีเมล ${newEmail} เพื่อยืนยันการเปลี่ยนแปลง`);
        }

        alert('บันทึกข้อมูลเรียบร้อย');

    } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 4. Change Password
async function changePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (!oldPass || !newPass || !confirmPass) {
        alert('กรุณากรอกข้อมูลให้ครบ');
        return;
    }

    if (newPass !== confirmPass) {
        alert('รหัสผ่านใหม่ไม่ตรงกัน');
        return;
    }

    if (newPass === oldPass) {
        alert('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
        return;
    }

    // Complexity Check (Reuse logic)
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{7,20}$/;
    if (!passwordRegex.test(newPass)) {
        alert("รหัสผ่านใหม่ต้องมีความยาว 7-20 ตัวอักษร มีตัวเลข ตัวพิมพ์ใหญ่ และตัวพิมพ์เล็ก");
        return;
    }

    const btn = document.getElementById('changePasswordBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังเปลี่ยน...';
    btn.disabled = true;

    try {
        // 1. Verify Old Password by trying to Sign In strictly
        // Supabase doesn't have a direct "verify password" API without signing in.
        // So we just attempt a re-auth.
        const { error: signInError } = await _supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: oldPass
        });

        if (signInError) {
            throw new Error("รหัสผ่านเดิมไม่ถูกต้อง");
        }

        // 2. Update Password
        const { error: updateError } = await _supabase.auth.updateUser({
            password: newPass
        });

        if (updateError) throw updateError;

        alert('เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่');
        await _supabase.auth.signOut();
        window.location.href = 'index.html';

    } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function logout() {
    if (confirm('ยืนยันการออกจากระบบ?')) {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}
