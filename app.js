// HTML Sanitizer
function sanitizeAIOutput(htmlString) {
    let rawStr = htmlString.replace(/```html/gi, '').replace(/```/gi, '');
    let temp = document.createElement('div');
    temp.innerHTML = rawStr;
    // Nuke any head/style elements
    temp.querySelectorAll('script, style, link, meta').forEach(el => el.remove());
    // Strip inline styles off all remaining nodes
    temp.querySelectorAll('*').forEach(el => el.removeAttribute('style'));
    return temp.innerHTML;
}

// New Project Modal Logic
function openNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) modal.classList.add('active');
}

function closeNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) modal.classList.remove('active');
}

function startNewProject(viewId) {
    closeNewProjectModal();
    switchView(viewId);
}

// View Switching Logic
function switchView(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active-view'));

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active-view');

    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => item.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-links li[data-view="${viewId}"]`);
    if (targetNav) targetNav.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.getAttribute('data-view'));
        });
    });
    
    // Initialize Dashboard UI from Local Storage
    updateDashboardUI();
});

// Dashboard State Management
function updateDashboardUI() {
    const scripts = parseInt(localStorage.getItem('ai_scripts') || '0');
    const captions = parseInt(localStorage.getItem('ai_captions') || '0');
    const ideas = scripts + captions; // Simple sum metric
    
    const elScripts = document.getElementById('stat-scripts');
    if (elScripts) elScripts.innerText = scripts;
    const elCaptions = document.getElementById('stat-captions');
    if (elCaptions) elCaptions.innerText = captions;
    const elIdeas = document.getElementById('stat-ideas');
    if (elIdeas) elIdeas.innerText = ideas;
    
    const projectsList = document.getElementById('recent-projects-list');
    if (projectsList) {
        const history = JSON.parse(localStorage.getItem('ai_history') || '[]');
        if (history.length === 0) {
            projectsList.innerHTML = '<li class="project-item"><div class="project-info" style="justify-content:center; width:100%; color:var(--text-secondary);">No recent generations yet. Generate something!</div></li>';
        } else {
            projectsList.innerHTML = history.map((item, index) => `
                <li class="project-item" style="cursor: pointer;" onclick="openHistoryItem(${index})">
                    <div class="project-info">
                        <div class="project-icon"><i class="ph ${item.icon}"></i></div>
                        <div>
                            <strong>${item.title.substring(0, 30)}${item.title.length > 30 ? '...' : ''}</strong>
                            <span>${item.type} generated • Locally Saved</span>
                        </div>
                    </div>
                    <button class="btn-icon"><i class="ph ph-caret-right"></i></button>
                </li>
            `).join('');
        }
    }
}

function recordProject(type, title, iconStr, contentHtml) {
    // Update Counter
    const key = type === 'Script' ? 'ai_scripts' : 'ai_captions';
    localStorage.setItem(key, parseInt(localStorage.getItem(key) || '0') + 1);
    
    // Update History Array
    const history = JSON.parse(localStorage.getItem('ai_history') || '[]');
    history.unshift({ type, title, icon: iconStr, content: contentHtml });
    if (history.length > 4) history.pop(); // Keep last 4 items
    localStorage.setItem('ai_history', JSON.stringify(history));
    
    updateDashboardUI();
}

function openHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('ai_history') || '[]');
    const item = history[index];
    if (!item) return;

    document.getElementById('history-title').innerText = item.title;
    document.getElementById('history-meta').innerText = `${item.type} • Locally Saved`;
    document.getElementById('history-content-area').innerHTML = item.content || "<i>No content saved for this legacy item. Please generate a new one.</i>";
    
    switchView('history');
}

// Script Generator Logic
let selectedTone = 'Educational';
function selectTone(element) {
    document.querySelectorAll('.tone-chips .chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    selectedTone = element.innerText;
}

async function generateScript(event) {
    event.preventDefault();
    const topic = document.getElementById('script-topic').value;
    const btn = document.getElementById('btn-generate-script');
    const output = document.getElementById('script-output');

    if (!topic) {
        alert('Please enter a topic!');
        return;
    }

    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
    btn.disabled = true;

    try {
        // --- OPENROUTER API CONFIGURATION ---
        const API_KEY = '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';
        const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

        const promptText = `Generate a modern YouTube video script about "${topic}" in a ${selectedTone} tone. 
        Please format the output using ONLY HTML tags (like <h3>, <p>, <ul>, <li>, <strong>, <em>). 
        Do not use markdown backticks or blockquotes. Make discrete sections like: Hook, Introduction, Body, and Outro.`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'openrouter/free', // Automatically selects an available free model
                messages: [{ role: 'user', content: promptText }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Force DOM-based extraction to nuke ALL rogue css injections securely
        let generatedHtml = sanitizeAIOutput(data.choices[0].message.content);

        output.classList.remove('output-placeholder');
        output.innerHTML = `
            <div class="script-content-generated" style="padding-top: 15px;">
                ${generatedHtml}
            </div>
        `;
        
        // Record to dashboard tracking
        recordProject('Script', topic, 'ph-file-text', generatedHtml);

    } catch (error) {
        console.error('Error generating script:', error);
        output.classList.remove('output-placeholder');
        output.innerHTML = `
            <div class="script-content-generated" style="color: #ff6b6b; padding-top: 15px;">
                <h3><i class="ph ph-warning"></i> Error Generating Script</h3>
                <p>${error.message}</p>
                <p style="font-size: 0.9em; margin-top: 10px; color: #ccc;">Note: Remember to replace <strong>'YOUR_API_KEY_HERE'</strong> with a valid API key in <strong>app.js</strong>.</p>
            </div>
        `;
    } finally {
        btn.innerHTML = '<i class="ph ph-magic-wand"></i> Generate Script';
        btn.disabled = false;
    }
}

// Caption Generator Logic
async function generateCaption(event) {
    event.preventDefault();
    const topic = document.getElementById('caption-topic').value;
    const length = document.getElementById('caption-length').value;
    const tone = document.getElementById('caption-tone').value;
    const btn = document.getElementById('btn-generate-caption');
    const output = document.getElementById('caption-output');

    if (!topic) {
        alert('Please enter a video topic!');
        return;
    }

    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
    btn.disabled = true;

    try {
        // We reuse the user's OpenRouter API key that is already functioning securely
        const API_KEY = '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';
        const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

        const promptText = `Create an engaging YouTube or social media video caption about: "${topic}". 
        Make the length exactly: ${length}. 
        The tone of writing should be precisely: ${tone}. 
        Format it cleanly using emojis suitable for the tone. Do NOT use markdown backticks. Add 3-5 relevant hashtags at the very bottom.`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'openrouter/free', // We specifically stick to this dynamic free model alias 
                messages: [{ role: 'user', content: promptText }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        let generatedHtml = sanitizeAIOutput(data.choices[0].message.content);
        // Format linebreaks appropriately for browser display
        generatedHtml = generatedHtml.replace(/\n/g, '<br/>');

        output.classList.remove('output-placeholder');
        output.innerHTML = `
            <div class="script-content-generated" style="padding: 15px 5px;">
                <p style="font-size: 1.05em; line-height: 1.7; color: #e0e0e0;">${generatedHtml}</p>
            </div>
        `;

        // Record to dashboard tracking
        recordProject('Caption', topic, 'ph-text-aa', generatedHtml);

    } catch (error) {
        console.error('Error generating caption:', error);
        output.classList.remove('output-placeholder');
        output.innerHTML = `
            <div class="script-content-generated" style="color: #ff6b6b; padding-top: 15px;">
                <h3><i class="ph ph-warning"></i> Error Generating Caption</h3>
                <p>${error.message}</p>
                <p style="font-size: 0.9em; margin-top: 10px; color: #ccc;">Make sure your API key is still valid.</p>
            </div>
        `;
    } finally {
        btn.innerHTML = '<i class="ph ph-text-aa"></i> Generate Caption';
        btn.disabled = false;
    }
}

// Strategy Chat Logic
function handleChatEnter(event) {
    if (event.key === 'Enter') sendChatMessage();
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const history = document.getElementById('chat-history');

    // Add User Message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.innerHTML = `
        <div class="avatar" style="font-family: 'Outfit', sans-serif; font-weight: bold; font-size: 18px;">Y</div>
        <div class="message-bubble">${msg}</div>
    `;
    history.appendChild(userDiv);
    input.value = '';
    history.scrollTop = history.scrollHeight;

    // Add Typing Indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message ai ai-typing';
    typingDiv.innerHTML = `
        <div class="avatar"><i class="ph-fill ph-robot neon-icon-purple"></i></div>
        <div class="message-bubble">
            <div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
        </div>
    `;
    history.appendChild(typingDiv);
    history.scrollTop = history.scrollHeight;

    try {
        const API_KEY = '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';
        const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: [
                    { role: 'system', content: "You are a highly intelligent, versatile AI assistant. Answer the user's question directly and accurately, no matter the topic. Format your answers elegantly using HTML (like <strong> and <br/>) and emojis. Do NOT use markdown code blocks like ```." },
                    { role: 'user', content: msg }
                ]
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        let generatedHtml = sanitizeAIOutput(data.choices[0].message.content);
        generatedHtml = generatedHtml.replace(/\n/g, '<br/>');

        history.removeChild(typingDiv);
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai';
        aiDiv.innerHTML = `
            <div class="avatar"><i class="ph-fill ph-robot neon-icon-purple"></i></div>
            <div class="message-bubble" style="color: #e0e0e0; line-height: 1.5;">${generatedHtml}</div>
        `;
        history.appendChild(aiDiv);
        history.scrollTop = history.scrollHeight;

    } catch (error) {
        console.error('Error generating strategy:', error);
        history.removeChild(typingDiv);
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai';
        aiDiv.innerHTML = `
            <div class="avatar"><i class="ph-fill ph-robot neon-icon-purple"></i></div>
            <div class="message-bubble" style="color: #ff6b6b;"><i class="ph ph-warning"></i> Connection Error: ${error.message}</div>
        `;
        history.appendChild(aiDiv);
        history.scrollTop = history.scrollHeight;
    }
}
