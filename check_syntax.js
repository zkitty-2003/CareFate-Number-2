const fs = require('fs');
const html = fs.readFileSync('c:/Users/siram/CareFate-Number-2/feature-goals.html', 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);
if (scripts) {
    scripts.forEach((script, index) => {
        const code = script.replace(/<\/?script>/g, '');
        try {
            new Function(code);
            console.log(`Script ${index + 1}: Syntax OK`);
        } catch (e) {
            console.error(`Script ${index + 1}: Syntax Error`, e.message);
            // Optionally print line numbers to help find the error
            const lines = code.split('\n');
            lines.forEach((l, i) => console.log(i + 1, l.substring(0, 50)));
        }
    });
} else {
    console.log("No scripts found");
}
