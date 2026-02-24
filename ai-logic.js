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
                const summary = sleep.map(s => `- Sleep: Quality ${s.detail}, Duration: ${s.note}`).join('\n');
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
                const summary = exercise.map(ex => `- Exercise: ${ex.detail} (${ex.calories || 0} cal), Note: ${ex.note}`).join('\n');
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
                const summary = excretion.map(ex => `- Excretion: Type ${ex.detail}, Note: ${ex.note}`).join('\n');
                contextParts.push("Recent Excretion/Digestion History:\n" + summary);
            }
        } catch (e) { console.warn("AI Context: Excretion fetch failed", e); }

        // Fallback to LocalStorage if Supabase is empty (for demo data consistency)
        if (contextParts.length === 0) {
            const localSleep = JSON.parse(localStorage.getItem('sleep_logs') || '[]');
            if (localSleep.length > 0) {
                const recentLocal = localSleep.slice(-3).map(s => `- Sleep: Quality ${s.detail}, Duration: ${s.note}`).join('\n');
                contextParts.push("Recent Sleep History (Local):\n" + recentLocal);
            }
        }

        return contextParts.join('\n\n');

    } catch (err) {
        console.error("Error gathering AI health context:", err);
        return "";
    }
}

// Export for use in HTML files
window.getAIHealthContext = getAIHealthContext;
