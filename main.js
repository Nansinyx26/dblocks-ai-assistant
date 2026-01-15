// Dblocks Assistant Logic - Optimized for Chrome/Edge/Chromium

const assistant = document.getElementById('voice-assistant');
const launcher = document.getElementById('assistant-launcher');
const closeBtn = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');

// --- Configuração ElevenLabs ---
// Chave oficial fornecida pelo usuário
const ELEVENLABS_API_KEY = "sk_bfec900de230605fa5c14611ae86e83b943d3138a23a9409";
const API_KEY = ELEVENLABS_API_KEY.trim();

console.log(`[ElevenLabs] Chave Inicializada. Comprimento: ${API_KEY.length}`);

// --- Opções de Vozes ---
// --- Opções de Vozes ---
const availableVoices = [
    { name: "Sarah (English)", id: "EXAVITQu4vr4xnSDxMaL", lang: "en" },
    { name: "Lily (Português)", id: "pFZP5JQG7iQjIQuC4Bku", lang: "pt" },
    { name: "Brian (English)", id: "nPczCjzI2devNBz1zQrb", lang: "en" },
    { name: "Charlie (Português)", id: "IKne3meq5aSn9XLyUdCD", lang: "pt" }
];

let VOICE_ID = localStorage.getItem('selected_voice_id');
let currentLang = localStorage.getItem('selected_lang') || 'pt';

// Validar se a voz salva ainda existe, senão pegar a primeira
const savedVoice = availableVoices.find(v => v.id === VOICE_ID);
if (!savedVoice) {
    VOICE_ID = availableVoices[1].id; // Default to Portuguese (Lily)
    currentLang = 'pt';
    localStorage.setItem('selected_voice_id', VOICE_ID);
    localStorage.setItem('selected_lang', currentLang);
} else {
    // If we want to enforce language matches voice on load? 
    // No, user wants independence. ensure currentLang is valid.
}

if (currentLang !== 'pt' && currentLang !== 'en') currentLang = 'pt';

// --- IndexedDB ---
const DB_NAME = 'DblocksChatDB';
const DB_VERSION = 2; // Atualizado para incluir store de créditos
const STORE_NAME = 'messages';
const CREDITS_STORE = 'credits';
let db;

// Dados iniciais de créditos (configuráveis)
const DEFAULT_CREDITS = {
    limit: 10000,
    used: 4500, // 45% usado conforme site ElevenLabs
    resetDay: 15, // Dia do mês que reseta
    lastReset: new Date().toISOString()
};

function initDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Store de mensagens
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
                // Store de créditos
                if (!db.objectStoreNames.contains(CREDITS_STORE)) {
                    const creditsStore = db.createObjectStore(CREDITS_STORE, { keyPath: 'id' });
                    // Inicializar com valores padrão
                }
            };
            request.onsuccess = (e) => {
                db = e.target.result;
                initCredits(); // Inicializar créditos
                resolve(db);
            };
            request.onerror = (e) => reject(e.target.error);
        } catch (err) { reject(err); }
    });
}

// --- Funções de Créditos ---
async function initCredits() {
    const credits = await getCredits();
    if (!credits) {
        await saveCredits(DEFAULT_CREDITS);
    } else {
        // Verificar reset automático
        checkAutoReset(credits);
    }
}

async function getCredits() {
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const transaction = db.transaction([CREDITS_STORE], 'readonly');
            const store = transaction.objectStore(CREDITS_STORE);
            const request = store.get('quota');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });
}

async function saveCredits(data) {
    if (!db) return;
    try {
        const transaction = db.transaction([CREDITS_STORE], 'readwrite');
        const store = transaction.objectStore(CREDITS_STORE);
        store.put({ id: 'quota', ...data });
    } catch (e) { console.warn("Erro ao salvar créditos:", e); }
}

async function subtractCredits(characters) {
    const credits = await getCredits();
    if (credits) {
        credits.used = Math.min(credits.limit, (credits.used || 0) + characters);
        await saveCredits(credits);
        console.log(`[Créditos] Gastou ${characters} caracteres. Total usado: ${credits.used}/${credits.limit}`);
    }
}

function checkAutoReset(credits) {
    const today = new Date();
    const lastReset = new Date(credits.lastReset || new Date());

    // Se passou de um mês e estamos no dia de reset ou depois
    if (today.getDate() >= credits.resetDay &&
        (today.getMonth() !== lastReset.getMonth() || today.getFullYear() !== lastReset.getFullYear())) {
        // Reset!
        credits.used = 0;
        credits.lastReset = today.toISOString();
        saveCredits(credits);
        console.log("[Créditos] Reset automático realizado!");
    }
}

async function saveMessageToDB(text, sender) {
    if (!db) return;
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.add({ text, sender, timestamp: Date.now() });
    } catch (e) { console.warn("Erro ao salvar mensagem:", e); }
}

async function loadMessagesFromDB() {
    try {
        if (!db) await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const messages = request.result;
            if (messages.length > 0) {
                // chatMessages.innerHTML = ''; // Não limpar para manter a mensagem de boas-vindas
                messages.forEach(msg => addMessage(msg.text, msg.sender, false));
            }
        };
    } catch (e) { console.error("Erro ao carregar banco:", e); }
}

// --- Estados ---
let isRecording = false;
let isAudioPlaying = false;
let recognition;
let recordingTimer;
let startTime;
let accumulatedTranscript = "";

function updateControlsState() {
    const shouldDisable = isRecording || isAudioPlaying;
    if (userInput) userInput.disabled = shouldDisable;
    if (sendBtn) {
        sendBtn.disabled = shouldDisable;
        sendBtn.style.opacity = shouldDisable ? "0.5" : "1";
    }
    if (voiceBtn) {
        voiceBtn.disabled = isAudioPlaying;
        voiceBtn.style.opacity = isAudioPlaying ? "0.5" : "1";
    }
}

// --- Knowledge Base ---
const dblocksKnowledge = {
    pt: {
        "controles": "Os blocos de controle permitem gerenciar o fluxo do seu programa, como loops e condições 'se'.",
        "sensores": "Sensores são os 'sentidos' do robô! Eles captam informações do ambiente (como luz, distância ou toque) e as transformam em dados que o código em blocos pode processar para tomar decisões.",
        "sensor": "Sensores são os 'sentidos' do robô! Eles captam informações do ambiente (como luz, distância ou toque) e as transformam em dados que o código em blocos pode processar para tomar decisões.",
        "blocos": "Programação em blocos é uma forma visual de criar lógica! Em vez de digitar códigos complexos, você encaixa peças coloridas (como um quebra-cabeça) que representam comandos, facilitando muito o aprendizado.",
        "bloco": "Programação em blocos é uma forma visual de criar lógica! Em vez de digitar códigos complexos, você encaixa peças coloridas (como um quebra-cabeça) que representam comandos, facilitando muito o aprendizado.",
        "atuadores": "Você pode controlar LEDs, Buzzer e motores usando os blocos de saídas e atuadores.",
        "amado": "Amado é a empresa criadora da Dblocks, focada em educação tecnológica e robótica.",
        "ajuda": "Eu posso te ajudar a entender os blocos, conectar dispositivos ou configurar sua placa Amado.",
        "olá": "Olá! Comece a programar em blocos! Sou o assistente da Dblocks. Como posso ajudar?",
        "ola": "Olá! Comece a programar em blocos! Sou o assistente da Dblocks. Como posso ajudar?",
        "bipes": "O BIPES é o nosso ambiente de desenvolvimento visual baseado em blocos, onde você prototipa suas ideias em minutos diretamente do navegador!",
        "programador": "Buscamos o programador dentro de você! Nossa interface visual torna o aprendizado acessível para todos.",
        "ensino": "Com a Dblocks, professores e alunos podem criar projetos educacionais incríveis sem precisar de configurações avançadas.",
        "guia": "Temos um guia completo de programação para te ajudar em guia.dblocks.com.br"
    },
    en: {
        "controls": "Control blocks allow you to manage the flow of your program, such as loops and 'if' conditions.",
        "sensors": "Sensors are the robot's 'senses'! They capture information from the environment (like light, distance, or touch) and turn it into data that block code can process to make decisions.",
        "sensor": "Sensors are the robot's 'senses'! They capture information from the environment (like light, distance, or touch) and turn it into data that block code can process to make decisions.",
        "blocks": "Block programming is a visual way to create logic! Instead of typing complex code, you snap together colorful pieces (like a puzzle) that represent commands, making learning much easier.",
        "block": "Block programming is a visual way to create logic! Instead of typing complex code, you snap together colorful pieces (like a puzzle) that represent commands, making learning much easier.",
        "actuators": "You can control LEDs, Buzzers, and motors using output blocks and actuators.",
        "amado": "Amado is the creator of Dblocks, focused on technology education and robotics.",
        "help": "I can help you understand blocks, connect devices, or set up your Amado board.",
        "hello": "Hello! Start programming with blocks! I am the Dblocks assistant. How can I help?",
        "hi": "Hello! Start programming with blocks! I am the Dblocks assistant. How can I help?",
        "bipes": "BIPES is our visual block-based development environment where you prototype your ideas in minutes directly from the browser!",
        "programmer": "We look for the programmer inside you! Our visual interface makes learning accessible to everyone.",
        "teaching": "With Dblocks, teachers and students can create amazing educational projects without needing advanced configurations.",
        "guide": "We have a complete programming guide to help you at guia.dblocks.com.br"
    }
};

const voiceSelectorBtn = document.getElementById('voice-selector-btn');
const voiceMenu = document.getElementById('voice-menu');

// --- Language Toggle Logic ---
const langPtBtn = document.getElementById('lang-pt');
const langEnBtn = document.getElementById('lang-en');

function updateLanguageUI() {
    if (currentLang === 'pt') {
        langPtBtn.classList.add('active');
        langEnBtn.classList.remove('active');
    } else {
        langPtBtn.classList.remove('active');
        langEnBtn.classList.add('active');
    }
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('selected_lang', currentLang);
    updateLanguageUI();

    // Atualizar idioma do reconhecimento de voz
    if (recognition) {
        recognition.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';
        console.log(`[STT] Idioma de reconhecimento alterado para: ${recognition.lang}`);
    }

    const confirm = lang === 'pt' ? "Idioma alterado para Português." : "Language changed to English.";
    speak(confirm);
}

if (langPtBtn && langEnBtn) {
    updateLanguageUI(); // Init state

    langPtBtn.addEventListener('click', () => setLanguage('pt'));
    langEnBtn.addEventListener('click', () => setLanguage('en'));
}

// --- UI Interaction ---

launcher.addEventListener('click', () => {
    assistant.classList.add('assistant-expanded');
});

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    assistant.classList.remove('assistant-expanded');
});

// --- Info Panel Logic ---
const infoBtn = document.getElementById('info-btn');
const closeInfoBtn = document.getElementById('close-info');
const infoModal = document.getElementById('info-modal');

if (infoBtn && infoModal) {
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        infoModal.classList.add('show');
        fetchQuotaElevenLabs(); // Buscar saldo ao abrir
    });
}

if (closeInfoBtn && infoModal) {
    closeInfoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        infoModal.classList.remove('show');
    });
}

voiceSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    voiceMenu.classList.toggle('show');
});

// Close menu when clicking outside
window.addEventListener('click', () => {
    voiceMenu.classList.remove('show');
});

function initVoiceMenu() {
    voiceMenu.innerHTML = '';
    availableVoices.forEach(voice => {
        const option = document.createElement('div');
        option.className = `voice-option ${voice.id === VOICE_ID ? 'active' : ''}`;
        option.innerHTML = `
            <span>${voice.name}</span>
            <i class="bi bi-check2"></i>
        `;
        option.addEventListener('click', () => {
            VOICE_ID = voice.id;
            localStorage.setItem('selected_voice_id', VOICE_ID);

            console.log("Voz alterada para:", voice.name, "ID:", VOICE_ID);
            updateVoiceMenuUI();
            voiceMenu.classList.remove('show');

            // Speak confirmation in CURRENT language
            const confirmText = currentLang === 'pt' ? `Voz ${voice.name} selecionada.` : `Voice ${voice.name} selected.`;
            speak(confirmText);
        });
        voiceMenu.appendChild(option);
    });
}

function updateVoiceMenuUI() {
    document.querySelectorAll('.voice-option').forEach(opt => {
        const voiceName = opt.querySelector('span').innerText;
        const voiceId = availableVoices.find(v => v.name === voiceName).id;
        opt.classList.toggle('active', voiceId === VOICE_ID);
    });
}

initVoiceMenu();


sendBtn.addEventListener('click', () => {
    handleMessage();
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleMessage();
});

function handleMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    userInput.value = '';
    generateResponse(text);
}

function addMessage(text, sender, save = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    const avatar = sender === 'bot' ? '<i class="bi bi-robot"></i>' : '<i class="bi bi-person-fill"></i>';

    let bubbleContent = text;
    if (sender === 'bot') {
        bubbleContent = `${text} <i class="bi bi-mic-fill playback-cue"></i>`;
    }

    msgDiv.innerHTML = `
        <div class="avatar">${avatar}</div>
        <div class="bubble ${sender === 'bot' ? 'speech-bubble' : ''}">${bubbleContent}</div>
    `;

    // Add click listener ONLY for the playback cue
    if (sender === 'bot') {
        const cue = msgDiv.querySelector('.playback-cue');
        if (cue) {
            cue.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling if we had other listeners
                speak(text, cue);
            });
        }
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (save) {
        saveMessageToDB(text, sender);
    }

    return msgDiv; // Return element for further manipulation
}

// Initialize playback for any pre-existing messages
function initClickableMessages() {
    document.querySelectorAll('.message.bot').forEach(msg => {
        const bubble = msg.querySelector('.bubble');
        const text = bubble.innerText.trim(); // Get text without HTML
        const cue = msg.querySelector('.playback-cue');

        if (cue) {
            // Remove old listeners by cloning (simple way to wipe events if not named)
            // or just add new one if we assume page reload clears them. 
            // Since this runs on load, we just add the listener.
            cue.addEventListener('click', (e) => {
                e.stopPropagation();
                speak(text, cue);
            });
        }
    });
}
initClickableMessages();
// Iniciar banco de dados e carregar mensagens
loadMessagesFromDB();


function generateResponse(text) {
    const lowerText = text.toLowerCase();
    let response = null;

    // Ensure currentLang is set (fallback)
    const lang = currentLang || 'pt';
    const knowledgeBase = dblocksKnowledge[lang];

    // Search in the specific language knowledge base
    if (knowledgeBase) {
        for (const key in knowledgeBase) {
            if (lowerText.includes(key.toLowerCase())) {
                response = knowledgeBase[key];
                console.log(`Match encontrado para: ${key} (${lang})`);
                break;
            }
        }
    }

    if (!response) {
        if (lang === 'pt') {
            response = "Ainda estou aprendendo sobre esse assunto. Tente me perguntar sobre 'como funcionam os sensores', 'o que são blocos' ou sobre o 'BIPES'.";
        } else {
            response = "I am still learning about this subject. Try asking me about 'how sensors work', 'what are blocks', or about 'BIPES'.";
        }
    }

    setTimeout(() => {
        const msgDiv = addMessage(response, 'bot');
        // speak(response, cue); // Removido para não tocar sozinho. Usuário deve clicar no mic.
    }, 600);
}

// --- VOICE: Speech-to-Text (STT) Logic ---

const recordingFeedback = document.getElementById('recording-feedback');
const timerDisplay = recordingFeedback.querySelector('.timer');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function updateTimer() {
    const now = Date.now();
    const diff = now - startTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const displaySeconds = (seconds % 60).toString().padStart(2, '0');
    const displayMinutes = minutes.toString().padStart(2, '0');
    timerDisplay.innerText = `${displayMinutes}:${displaySeconds}`;
}

voiceBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!SpeechRecognition) {
        alert("Seu navegador não suporta reconhecimento de voz embutido.");
        return;
    }

    startRecording();
});

voiceBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!SpeechRecognition) return;
    startRecording();
}, { passive: false });

window.addEventListener('mouseup', () => {
    if (isRecording) stopRecording();
});

window.addEventListener('touchend', () => {
    if (isRecording) stopRecording();
});

// Função auxiliar para verificar permissão se necessário
async function checkMicStatus() {
    try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        console.log("Status do microfone:", result.state);
    } catch (e) {
        console.warn("Não foi possível consultar status do microfone.");
    }
}
checkMicStatus();

function startRecording() {
    if (isRecording) return; // Evita múltiplas ativações

    // Alerta sobre protocolo file:// (apenas informativo)
    if (location.protocol === 'file:') {
        console.warn("Navegadores podem bloquear o microfone em arquivos locais (file://).");
    }

    isRecording = true;
    updateControlsState();
    accumulatedTranscript = "";
    userInput.value = "";
    userInput.placeholder = "Ouvindo...";
    voiceBtn.classList.add('recording');
    recordingFeedback.classList.add('active');
    startTime = Date.now();
    timerDisplay.innerText = "00:00";
    recordingTimer = setInterval(updateTimer, 1000);

    try {
        if (recognition) {
            // Atualizar idioma antes de iniciar para garantir sincronização
            recognition.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';
            recognition.start();
            console.log(`Iniciando captura de voz em ${recognition.lang}...`);
        } else {
            alert("Seu navegador não suporta reconhecimento de voz.");
            stopRecording();
        }
    } catch (e) {
        if (e.name === 'InvalidStateError') {
            console.log("Reconhecimento já estava em execução.");
        } else {
            console.error("Erro ao iniciar captura:", e);
            stopRecording();
        }
    }
}

function stopRecording() {
    isRecording = false;
    updateControlsState();
    voiceBtn.classList.remove('recording');
    recordingFeedback.classList.remove('active');
    userInput.placeholder = "Pergunte algo...";
    clearInterval(recordingTimer);

    if (recognition) {
        recognition.stop();
        console.log("Parando captura de voz.");
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Alterado para false para evitar duplicação
    recognition.interimResults = true; // Mostra texto enquanto fala
    recognition.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';

    recognition.onresult = (event) => {
        // Reconstruir transcrição completa a cada evento para evitar duplicação
        let finalTranscript = "";
        let interimTranscript = "";

        // Percorrer TODOS os resultados desde o início
        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Atualizar campo de texto com transcrição limpa
        userInput.value = (finalTranscript + interimTranscript).trim();
        console.log("Transcrição:", userInput.value);
    };

    recognition.onend = () => {
        const finalMessage = userInput.value.trim();
        console.log("Reconhecimento finalizado. Conteúdo:", finalMessage);

        // Só envia se estávamos gravando (não se parou por erro)
        if (finalMessage && !isRecording) {
            addMessage(finalMessage, 'user');
            generateResponse(finalMessage);
            userInput.value = "";
        } else if (!finalMessage) {
            console.warn("Nenhum texto detectado.");
        }

        // Limpar estado
        accumulatedTranscript = "";
    };

    recognition.onstart = () => {
        console.log("Reconhecimento iniciado");
        accumulatedTranscript = "";
        userInput.value = "";
    };

    recognition.onerror = (event) => {
        console.error("Erro Recognition:", event.error);
        if (event.error === 'not-allowed') {
            alert("Permissão de microfone negada pelo navegador.");
        } else if (event.error === 'no-speech') {
            console.warn("Nenhuma fala detectada.");
        }
        stopRecording();
    };
} else {
    alert("Reconhecimento de voz não disponível neste navegador. Recomendamos o Google Chrome ou Microsoft Edge.");
    console.error("Seu navegador não suporta a API de Reconhecimento de Voz.");
}


// --- VOICE: Text-to-Speech (TTS) ElevenLabs ---

async function speak(text, iconElement = null) {
    if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === "INSIRA_SUA_CHAVE_AQUI") {
        console.warn("ElevenLabs: Chave não configurada.");
        return;
    }

    // Stop previous animation if exists (global tracking could be added, but for now we rely on the specific element passed)
    // Ideally we should stop any currently playing audio before starting a new one, but the browser handles mixed audio. 
    // To fix animations of "previous" audio, we'd need a global 'currentAudioIcon'.
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio = null;
        if (window.currentAudioIcon) {
            window.currentAudioIcon.classList.remove('playing');
        }
    }

    try {
        if (iconElement) iconElement.classList.add('loading-audio'); // Optional: visual feedback while fetching

        console.log(`ElevenLabs: Chamando API (${VOICE_ID}) para o texto:`, text.substring(0, 30) + "...");
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            })
        });

        if (iconElement) iconElement.classList.remove('loading-audio');

        if (response.ok) {
            console.log("ElevenLabs: Resposta OK, reproduzindo áudio...");

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            window.currentAudio = audio; // Track global audio
            window.currentAudioIcon = iconElement;

            audio.onplay = () => {
                isAudioPlaying = true;
                updateControlsState();
                if (iconElement) iconElement.classList.add('playing');
            };

            audio.onended = () => {
                isAudioPlaying = false;
                updateControlsState();
                if (iconElement) iconElement.classList.remove('playing');
                window.currentAudio = null;
                window.currentAudioIcon = null;
            };

            audio.play().catch(e => {
                console.error("Erro ao dar play no áudio:", e);
                alert("Erro ao reproduzir áudio. Verifique se o som do navegador está habilitado.");
                isAudioPlaying = false;
                updateControlsState();
                if (iconElement) iconElement.classList.remove('playing');
            });
        } else {
            const errorData = await response.json();
            console.error("ElevenLabs API Error:", errorData);

            let detailedError = errorData.detail?.message || errorData.detail?.status || "Erro desconhecido.";
            alert(`Erro na ElevenLabs (${response.status}): ${detailedError}\n\nSe o erro for 'voice_not_found', escolha outra voz no menu.`);
        }
    } catch (e) {
        if (iconElement) iconElement.classList.remove('loading-audio');
        console.error("Falha na requisição ElevenLabs:", e);
        alert("Falha na requisição para ElevenLabs. Verifique sua conexão.");
    }
}


// --- Consultar Saldo de Créditos (Aviso Estático) ---

function fetchQuotaElevenLabs() {
    const quotaDisplay = document.getElementById('quota-display');
    if (!quotaDisplay) return;

    // Calcular próxima data de reset (Dia 15)
    const today = new Date();
    let nextReset = new Date(today.getFullYear(), today.getMonth(), 15);

    // Se hoje já passou do dia 15, o próximo é no mês seguinte
    if (today.getDate() >= 15) {
        nextReset.setMonth(nextReset.getMonth() + 1);
    }

    const resetDate = nextReset.toLocaleDateString('pt-BR');

    quotaDisplay.innerHTML = `
        <div style="background: rgba(0, 163, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--accent-blue);">
            <div style="display: flex; align-items: start; gap: 10px;">
                <i class="bi bi-info-circle-fill" style="color: var(--accent-blue); font-size: 18px; margin-top: 2px;"></i>
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #fff;">Limite de Áudio Mensal</h4>
                    <p style="margin: 0; font-size: 12px; color: #ccc; line-height: 1.4;">
                        Este assistente usa uma cota gratuita de voz. 
                        <strong>Se o áudio parar de funcionar</strong>, significa que o limite do mês foi atingido.
                    </p>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <p style="margin: 0; font-size: 12px; color: #888;">
                            <i class="bi bi-calendar-check"></i> Próxima renovação: <strong style="color: var(--accent-green);">${resetDate}</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}
