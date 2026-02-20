/* ============================================
   CareFate - In-App Notification System
   ============================================
   Uses in-app popup + audio beep instead of 
   browser Notification API (which Windows may block).
   ============================================ */

// ─── Audio Context for Beep Sound ───
let audioCtx = null;
function playNotificationSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Play 3 short beeps
        [0, 200, 400].forEach(delay => {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = 880; // A5 note
                gain.gain.value = 0.3;
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.15);
            }, delay);
        });
    } catch (e) {
        console.warn('Audio not supported:', e);
    }
}

// ─── In-App Toast Notification ───
// ─── In-App Toast Notification ───
function showInAppNotification(title, body) {
    // Play sound
    playNotificationSound();

    // 1. Find the best container (Mobile Frame)
    const appFrame = document.querySelector('.app-container') ||
        document.querySelector('.dashboard-container') ||
        document.querySelector('.login-screen') ||
        document.body;

    // Ensure parent is relative if it's not body (so absolute positioning works inside it)
    if (appFrame !== document.body) {
        const style = window.getComputedStyle(appFrame);
        if (style.position === 'static') {
            appFrame.style.position = 'relative';
        }
    }

    // 2. Create toast container if not exists
    let container = document.getElementById('carefate-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'carefate-toast-container';

        // Strategy: Absolute if inside a frame, Fixed if body
        // We want it at the TOP of the frame.
        const posType = (appFrame === document.body) ? 'fixed' : 'absolute';

        container.style.cssText = `
            position: ${posType}; 
            top: 20px; 
            left: 0; 
            width: 100%; 
            z-index: 99999;
            display: flex; 
            flex-direction: column; 
            align-items: center; /* Center horizontally */
            gap: 10px;
            pointer-events: none; /* Let clicks pass through gaps */
        `;
        appFrame.appendChild(container);
    } else {
        // Safe check: if container exists but isn't in the current appFrame, move it.
        if (container.parentElement !== appFrame) {
            appFrame.appendChild(container);
        }
    }

    // 3. Create toast element (Mobile Banner Style)
    const toast = document.createElement('div');
    toast.className = 'carefate-toast';
    toast.style.cssText = `
        background: rgba(255, 255, 255, 0.95); 
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 16px; 
        padding: 12px 16px;
        width: 90%; 
        max-width: 360px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex; 
        align-items: center; 
        gap: 12px;
        animation: slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
        border: 1px solid rgba(0,0,0,0.05);
        position: relative;
        font-family: 'Outfit', sans-serif;
        overflow: hidden;
    `;

    toast.innerHTML = `
        <div style="
            width: 38px; height: 38px; background: linear-gradient(135deg, #f472b6, #ec4899);
            border-radius: 10px; display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; box-shadow: 0 2px 5px rgba(236, 72, 153, 0.3);
        ">
            <i class="fa-solid fa-bell" style="color: white; font-size: 1.1rem;"></i>
        </div>
        
        <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                <h4 style="margin: 0; color: #1e293b; font-size: 0.95rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${title}
                </h4>
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 400;">เมื่อสักครู่</span>
            </div>
            <p style="margin: 0; color: #475569; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${body}
            </p>
        </div>
    `;

    // Remove logic
    const close = () => {
        toast.style.animation = 'slideUpFade 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    };

    // Click to dismiss
    toast.onclick = close;

    // Auto dismiss after 5 seconds
    setTimeout(close, 5000);

    container.appendChild(toast);

    // Save to History
    try {
        const history = JSON.parse(localStorage.getItem('notification_history') || '[]');
        history.unshift({
            title,
            body,
            time: new Date().toISOString(),
            read: false
        });
        // Limit to 50 items
        if (history.length > 50) history.pop();
        localStorage.setItem('notification_history', JSON.stringify(history));

        // Update badge if on dashboard (optional, or handle via event)
        window.dispatchEvent(new Event('notification-updated'));
    } catch (e) { console.warn('Failed to save log', e); }

    // Desktop/Browser Notification (Bonus)
    try {
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/869/869869.png' });
        }
    } catch (e) { /* ignore */ }
}

// ─── Bell Button Handler ───
function requestNotificationPermission() {
    // Show a test notification immediately
    showInAppNotification(
        'ทดสอบการแจ้งเตือน 🔔',
        'ระบบแจ้งเตือนทำงานปกติครับ! เมื่อถึงเวลาที่ตั้งไว้ จะมีข้อความแบบนี้เด้งขึ้นมา'
    );

    // Also request browser permission in background
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ─── Check Goals & Fire Notifications ───
function checkGoalNotifications() {
    const goals = JSON.parse(localStorage.getItem('goals_schedule') || '[]');
    if (goals.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayStr = now.toDateString();

    // Check Day Frequency
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const isWeekend = (day === 0 || day === 6);

    // Sent log to avoid duplicates
    const sentLogs = JSON.parse(localStorage.getItem('goal_notifications_sent') || '{}');

    goals.forEach(goal => {
        if (!goal.time) return;

        // Freq Check
        if (goal.freq === 'weekdays' && isWeekend) return;
        if (goal.freq === 'weekends' && !isWeekend) return;

        // Time Check (Exact Minute Match)
        if (goal.time === currentTime) {
            if (sentLogs[goal.id] !== todayStr) {
                // Determine unit
                let unit = 'นาที';
                if (goal.type === 'count') unit = 'ครั้ง';
                if (goal.type === 'distance') unit = 'กม.';

                // Show In-App Notification!
                showInAppNotification(
                    'ถึงเวลาทำเป้าหมาย! 🎯',
                    `${goal.name} (${goal.value} ${unit})`
                );

                // Mark as sent
                sentLogs[goal.id] = todayStr;
                localStorage.setItem('goal_notifications_sent', JSON.stringify(sentLogs));
                console.log(`[Notif] ✅ Goal sent: ${goal.name}`);
            }
        }
    });
}

// ─── Check Medication & Fire Notifications ───
function checkMedicationNotifications() {
    const meds = JSON.parse(localStorage.getItem('med_schedule') || '[]');
    if (meds.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayStr = now.toDateString();

    // Check if already taken today
    const medLogs = JSON.parse(localStorage.getItem('med_logs') || '{}');
    const todayMedLogs = medLogs[todayStr] || {};

    // Sent log to avoid duplicate notifications
    const sentLogs = JSON.parse(localStorage.getItem('med_notifications_sent') || '{}');

    // Filter by duration logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    meds.forEach(med => {
        // Use custom notifyTime if available, else default to med.time
        const checkTime = med.notifyTime || med.time;
        if (!checkTime) return;

        // Duration check
        if (med.durationDays && med.startDate) {
            const start = new Date(med.startDate);
            start.setHours(0, 0, 0, 0);
            if (today < start) return; // Not started yet
            const diffDays = Math.ceil(Math.abs(today - start) / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > parseInt(med.durationDays)) return; // Expired
        }

        // Already taken? Skip notification
        if (todayMedLogs[med.id] === true) return;

        // Time Check (Exact Minute Match)
        if (checkTime === currentTime) {
            const key = `med_${med.id}`;
            if (sentLogs[key] !== todayStr) {
                showInAppNotification(
                    'ถึงเวลาทานยา! 💊',
                    `${med.name} ${med.dose ? '(' + med.dose + ')' : ''}`
                );

                sentLogs[key] = todayStr;
                localStorage.setItem('med_notifications_sent', JSON.stringify(sentLogs));
                console.log(`[Notif] ✅ Med sent: ${med.name}`);
            }
        }
    });
}

// ─── Check Appointment & Fire Notifications ───
function checkAppointmentNotifications() {
    const appointments = JSON.parse(localStorage.getItem('appointment_logs') || '[]');
    if (appointments.length === 0) return;

    const now = new Date();
    const todayStr = now.toDateString();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    // Sent log to avoid duplicate notifications
    const sentLogs = JSON.parse(localStorage.getItem('appt_notifications_sent') || '{}');

    appointments.forEach((appt, index) => {
        if (!appt.appointment_date) return;
        const apptDate = new Date(appt.appointment_date);

        // 1. Check Custom Notification Date/Time (Exact match)
        if (appt.notify_date) {
            const notifyDate = new Date(appt.notify_date);
            // Check if same date and same minute
            if (notifyDate.toDateString() === todayStr) {
                const notifyTimeStr = `${notifyDate.getHours().toString().padStart(2, '0')}:${notifyDate.getMinutes().toString().padStart(2, '0')}`;

                if (notifyTimeStr === currentTime) {
                    const key = `appt_custom_${index}_${appt.appointment_date}`;
                    if (sentLogs[key] !== todayStr) {
                        showInAppNotification(
                            'แจ้งเตือนนัดหมายแพทย์ 🏥',
                            `${appt.detail} (ตามเวลาที่ตั้งไว้: ${notifyTimeStr})`
                        );
                        sentLogs[key] = todayStr;
                        localStorage.setItem('appt_notifications_sent', JSON.stringify(sentLogs));
                        console.log(`[Notif] ✅ Custom Appointment sent: ${appt.detail}`);
                    }
                }
            }
        }

        // Only future appointments logic for default reminders
        if (apptDate <= now) return;

        // 2. Default: Notify at 30 minutes before (ONLY if no custom time set? OR always? Let's keep existing logic as backup)
        // Actually, if custom time is set, maybe user ONLY wants that? 
        // Let's keep both for safety, or user might miss it if they set custom time to yesterday by mistake.

        const diffMs = apptDate - now;
        const diffMinutes = Math.floor(diffMs / 60000);

        const key30 = `appt_30_${index}_${appt.appointment_date}`;
        if (diffMinutes <= 30 && diffMinutes >= 0 && sentLogs[key30] !== todayStr) {
            const timeStr = apptDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            showInAppNotification(
                'นัดหมายแพทย์ใกล้ถึงแล้ว! (30 นาที) 🏥',
                `${appt.detail} เวลา ${timeStr}`
            );
            sentLogs[key30] = todayStr;
            localStorage.setItem('appt_notifications_sent', JSON.stringify(sentLogs));
        }

        // 3. Default: Notify Morning 08:00
        const isSameDay = apptDate.toDateString() === now.toDateString();
        const morningKey = `appt_morning_${index}_${appt.appointment_date}`;

        if (isSameDay && currentHour === '08' && currentMinute === '00' && sentLogs[morningKey] !== todayStr) {
            const timeStr = apptDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            showInAppNotification(
                'วันนี้มีนัดหมายแพทย์ 📋',
                `${appt.detail} เวลา ${timeStr}`
            );
            sentLogs[morningKey] = todayStr;
            localStorage.setItem('appt_notifications_sent', JSON.stringify(sentLogs));
        }
    });
}

// ─── Inject CSS Animations ───
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown { from { transform: translateY(-150%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-150%); opacity: 0; } }
    @keyframes progress { from { width: 100%; } to { width: 0%; } }
`;
document.head.appendChild(style);

// ─── Run All Checks ───
function runAllChecks() {
    const now = new Date();
    const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    console.log(`[Notif] Checking all at ${t}`);
    checkGoalNotifications();
    checkMedicationNotifications();
    checkAppointmentNotifications();
}

// ─── Start Checking ───
runAllChecks();
setInterval(runAllChecks, 10000); // Every 10 seconds

