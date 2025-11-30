const https = require('https');
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(__dirname, '.env');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.log("Could not read .env file");
}

const apiKey = process.env.OPENROUTER_API_KEY;
const model = "z-ai/glm-4.6";

console.log("Testing OpenRouter with model:", model);
console.log("API Key present:", !!apiKey);

if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY is missing in .env");
    process.exit(1);
}

const data = JSON.stringify({
    model: model,
    messages: [
        { role: "user", content: "Say hello" }
    ]
});

const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000', // Optional, for including your app on openrouter.ai rankings.
        'X-Title': 'MPAI Dev' // Optional. Shows in rankings on openrouter.ai.
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        if (res.statusCode === 200) {
            console.log('SUCCESS: OpenRouter API is working.');
        } else {
            console.log('FAILURE: Body:', body);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
