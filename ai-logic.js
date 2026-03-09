/**
 * CareFate AI Logic Helper
 * Gathers recent health data (3-5 days) for RAG (Retrieval Augmented Generation) Lite.
 */

async function getAIHealthContext(supabase, days = 3) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateISO = startDate.toISOString();

        let contextParts = [];

        // 1. Fetch Sleep Logs
        try {
            const { data: sleep } = await supabase
                .from('sleep_logs')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDateISO);

            if (sleep && sleep.length > 0) {
                const summary = sleep.map(s => `- Sleep: Quality ${s.detail || s.note || 'unknown'}, Duration: ${s.note || '-'}`).join('\n');
                contextParts.push("Recent Sleep History:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Sleep fetch failed", e); }

        // 2. Fetch Exercise Logs
        try {
            const { data: exercise } = await supabase
                .from('exercise_logs')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDateISO);

            if (exercise && exercise.length > 0) {
                const summary = exercise.map(ex => `- Exercise: ${ex.activity || '-'}, Duration: ${ex.duration || 0} นาที, Intensity: ${ex.intensity || '-'} (${ex.calories || 0} cal)`).join('\n');
                contextParts.push("Recent Exercise History:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Exercise fetch failed", e); }

        // 3. Fetch Excretion Logs
        try {
            const { data: excretion } = await supabase
                .from('excretion_logs')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDateISO);

            if (excretion && excretion.length > 0) {
                const typeMap = { 'hard': 'แข็ง/ท้องผูก', 'normal': 'ปกติ (สุขภาพดี)', 'soft': 'เหลว', 'liquid': 'ท้องเสีย' };
                const colorMap = { 'brown': 'น้ำตาล', 'green': 'เขียว', 'yellow': 'เหลือง', 'black': 'ดำ', 'red': 'แดง' };
                const summary = excretion.map(ex => {
                    const typeTh = typeMap[ex.type] || ex.type || 'ไม่ระบุ';
                    const colorTh = ex.color ? `สี${colorMap[ex.color] || ex.color}` : '';
                    const notePart = ex.note ? `, หมายเหตุ: ${ex.note}` : '';
                    return `- การขับถ่าย: ลักษณะ${typeTh}${colorTh ? ' ' + colorTh : ''}${notePart}`;
                }).join('\n');
                contextParts.push("Recent Excretion/Digestion History:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Excretion fetch failed", e); }

        // 4. Fetch Period Cycles
        try {
            const { data: cycles } = await supabase
                .from('period_cycles')
                .select('*')
                .eq('user_id', user.id)
                .order('start_date', { ascending: false })
                .limit(1);

            if (cycles && cycles.length > 0) {
                const c = cycles[0];
                const endStr = c.end_date ? `to ${c.end_date}` : 'and still active';
                contextParts.push(`Recent Period Cycle: Started ${c.start_date} ${endStr} (Duration: ${c.duration || '-'} days)`);
            }
        } catch (e) { console.warn("AI Context: Period cycles fetch failed", e); }

        // 5. Fetch Period Symptoms
        try {
            const { data: symptoms } = await supabase
                .from('period_symptoms')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDateISO)
                .order('date', { ascending: false });

            if (symptoms && symptoms.length > 0) {
                const summary = symptoms.map(s => {
                    const symList = Array.isArray(s.symptoms) ? s.symptoms.join(', ') : (s.symptoms || '-');
                    return `- Date: ${s.date}, Symptoms: ${symList}`;
                }).join('\n');
                contextParts.push("Recent Period Symptoms:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Period symptoms fetch failed", e); }

        // 6. Fetch Goals Schedule (Active Goals)
        try {
            const { data: goals } = await supabase
                .from('goals_schedule')
                .select('*')
                .eq('user_id', user.id);

            if (goals && goals.length > 0) {
                const summary = goals.map(g => `- Goal: ${g.name}, Type: ${g.type}, Value: ${g.duration}`).join('\n');
                contextParts.push("Current Active Goals:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Goals schedule fetch failed", e); }

        // 7. Fetch Recent Goal Logs (Completed/Not Completed)
        try {
            const { data: goalLogs } = await supabase
                .from('goal_logs')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDateISO);

            if (goalLogs && goalLogs.length > 0) {
                const summary = goalLogs.map(g => `- Goal Log: ${g.detail}, Status: ${g.note}`).join('\n');
                contextParts.push("Recent Goal Activity:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Goal logs fetch failed", e); }

        // No LocalStorage fallback — prevents data leakage between user accounts.
        // New users will simply have no health context, which is correct behavior.

        return contextParts.join('\n\n');

    } catch (err) {
        console.error("Error gathering AI health context:", err);
        return "";
    }
}

// Export for use in HTML files
window.getAIHealthContext = getAIHealthContext;
