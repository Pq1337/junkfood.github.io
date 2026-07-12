// --- 元素選取 ---
const music = document.getElementById("bg-music");
const bigBtn = document.getElementById("music-btn");
const prevBtn = document.getElementById("prevBtn");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const nowPlaying = document.getElementById("nowPlaying");

const subtitleBox = document.getElementById("subtitleBox");
const subtitleText = document.getElementById("subtitleText");

const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const curTime = document.getElementById("curTime");
const durTime = document.getElementById("durTime");

const fmiBtn = document.getElementById("fmi-btn");
const extraContent = document.getElementById("extra-content");
const arrow = document.querySelector(".arrow");

const launcher = document.getElementById('chatLauncher');
const windowEl = document.getElementById('chatWindow');
const closeBtn = document.getElementById('closeChat');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');

document.getElementById("year").textContent = new Date().getFullYear();

// --- 歌詞解析 ---
async function parseLRC(url, offset = 0) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch LRC: ${url} (${res.status})`);
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    const entries = [];
    for (let raw of lines) {
        const line = (raw || "").trim();
        if (!line) continue;
        const timeTags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
        if (!timeTags.length) continue;
        const content = line.replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, "").trim();
        for (const m of timeTags) {
            const min = parseInt(m[1], 10);
            const sec = parseFloat(m[2]);
            const t = Math.max(0, min * 60 + sec + offset);
            entries.push({ time: t, text: content });
        }
    }
    entries.sort((a, b) => a.time - b.time);
    return entries.map((item, i) => ({
        start: item.time,
        end: entries[i + 1] ? entries[i + 1].time : item.time + 5,
        text: item.text || "…"
    }));
}

async function getSubsForTrack(track) {
    if (track && track.lrc) {
        try {
            return await parseLRC(track.lrc, Number(track.offset || 0));
        } catch (e) {
            console.warn("LRC load failed, fallback to built-in subs:", e);
            return track.subs || [];
        }
    }
    return (track && track.subs) ? track.subs : [];
}

const playlist = [
    { title: "Si Tu Vois Ma Mère", src: "music disk.flac", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Music brings the page to life." }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "AnRain安林 - 星河不及你", src: "music3.ogg", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Do ya like soft music?" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "Wthegg - Wings！You Are My Future", src: "music4.ogg", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Best one" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "三葉のテーマ", src: "music1.flac", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "I can't make it up......" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "恋かもしれない何かの話", src: "music2.flac", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Soft music let us think more" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "松田彬人 - これが僕らの日常", src: "music5.flac", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Soft music ofc better then HipHop" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "さんうさぎ - 世界は私のためだけに", src: "music6.ogg", subs: [{ start: 0.0, end: 4.5, text: "此歌曲為沒有填詞的純音樂，請您欣賞" }, { start: 4.5, end: 9.0, text: "Soft music is the best" }, { start: 9.0, end: 14.0, text: "Enjoy :P" }] },
    { title: "Beyond - 不再猶豫", src: "music7.ogg", lrc: "不再犹豫_edited.lrc", offset: -1.8 },
    { title: "罗大佑 - 飛車", src: "music8.mp3", lrc: "飞车.lrc" },
    { title: "罗大佑/蒋志光 - 皇后大道东", src: "music9.mp3", lrc: "皇后大道东.lrc" },
    { title: "罗大佑 - 首都", src: "music10.mp3", lrc: "首都.lrc", offset: 1.0 }
];

let isPlaying = false;
let isSeeking = false;
let shuffleOn = true;
let repeatMode = 0;
let currentIndex = 0;
let shuffleBag = [];
let currentSubs = [];
let lastLine = "";

function fmt(t) {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function setSubtitleSmooth(text) {
    if (text === lastLine) return;
    lastLine = text;
    subtitleText.classList.add("fading");
    setTimeout(() => {
        subtitleText.textContent = text;
        subtitleText.classList.remove("fading");
    }, 180);
}

function updateSubtitle(time) {
    const line = currentSubs.find(s => time >= s.start && time < s.end);
    if (line) {
        subtitleBox.classList.remove("hidden");
        setSubtitleSmooth(line.text);
    } else {
        subtitleBox.classList.add("hidden");
        lastLine = "";
    }
}

function fadeTo(target, duration = 500) {
    const start = music.volume;
    const startTime = performance.now();
    target = Math.max(0, Math.min(1, target));
    function tick(now) {
        const t = Math.min(1, (now - startTime) / duration);
        music.volume = start + (target - start) * t;
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function refillShuffleBag() {
    shuffleBag = [...Array(playlist.length).keys()];
    for (let i = shuffleBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleBag[i], shuffleBag[j]] = [shuffleBag[j], shuffleBag[i]];
    }
}

function pickNextIndex(direction = +1) {
    if (shuffleOn) {
        if (shuffleBag.length === 0) refillShuffleBag();
        return shuffleBag.shift();
    }
    return (currentIndex + direction + playlist.length) % playlist.length;
}

async function loadTrack(index, { autoplay = false, keepTime = false } = {}) {
    if (index < 0 || index >= playlist.length) return;
    subtitleBox.classList.add("hidden");
    lastLine = "";
    const prevTime = music.currentTime || 0;
    currentIndex = index;
    const track = playlist[currentIndex];
    currentSubs = await getSubsForTrack(track);
    nowPlaying.textContent = `Now Playing: ${track.title}`;
    const targetVol = Number(volume.value);
    if (isPlaying) fadeTo(0, 220);
    await new Promise(r => setTimeout(r, isPlaying ? 240 : 0));
    music.src = track.src;
    music.load();
    if (keepTime) {
        music.addEventListener("loadedmetadata", () => {
            music.currentTime = Math.min(prevTime, music.duration || prevTime);
        }, { once: true });
    }
    if (autoplay) {
        try {
            await music.play();
            isPlaying = true;
            syncUIPlaying(true);
            fadeTo(targetVol, 320);
        } catch (e) {
            isPlaying = false;
            syncUIPlaying(false);
        }
    } else {
        syncUIPlaying(false);
    }
}

function syncUIPlaying(on) {
    bigBtn.setAttribute("aria-pressed", String(on));
    playBtn.setAttribute("aria-pressed", String(on));
    if (on) {
        bigBtn.classList.replace("is-off", "is-on");
        playBtn.textContent = "⏸";
    } else {
        bigBtn.classList.replace("is-on", "is-off");
        playBtn.textContent = "▶";
    }
}

function syncShuffleUI() {
    shuffleBtn.classList.toggle("on", shuffleOn);
    shuffleBtn.setAttribute("aria-pressed", String(shuffleOn));
}
function syncRepeatUI() {
    repeatBtn.classList.toggle("on", repeatMode !== 0);
    repeatBtn.textContent = repeatMode === 2 ? "🔂" : "🔁";
    repeatBtn.setAttribute("aria-pressed", String(repeatMode !== 0));
    repeatBtn.setAttribute("aria-label", repeatMode === 2 ? "repeat current track" : "repeat playlist");
}

// --- 音樂事件 ---
const savedVol = localStorage.getItem("vol");
if (savedVol !== null) { volume.value = savedVol; music.volume = Number(savedVol); }
else { music.volume = Number(volume.value); }

volume.addEventListener("input", () => {
    const v = Number(volume.value);
    music.volume = v;
    localStorage.setItem("vol", String(v));
});

music.addEventListener("loadedmetadata", () => {
    durTime.textContent = fmt(music.duration);
    if (!isSeeking) progress.value = 0;
    curTime.textContent = fmt(music.currentTime);
});

progress.addEventListener("input", () => {
    if (!music.duration) return;
    isSeeking = true;
    const t = (Number(progress.value) / 100) * music.duration;
    curTime.textContent = fmt(t);
});

progress.addEventListener("change", () => {
    if (!music.duration) return;
    music.currentTime = (Number(progress.value) / 100) * music.duration;
    isSeeking = false;
    if (isPlaying) updateSubtitle(music.currentTime);
});

music.addEventListener("timeupdate", () => {
    if (isPlaying) updateSubtitle(music.currentTime);
    if (!music.duration || isSeeking) return;
    progress.value = (music.currentTime / music.duration) * 100;
    curTime.textContent = fmt(music.currentTime);
});

async function playOrPause() {
    if (!music.src) {
        if (shuffleOn) refillShuffleBag();
        await loadTrack(shuffleOn ? pickNextIndex(+1) : 0, { autoplay: true });
        return;
    }
    if (!isPlaying) {
        await music.play();
        isPlaying = true;
        syncUIPlaying(true);
        fadeTo(Number(volume.value), 260);
    } else {
        isPlaying = false;
        syncUIPlaying(false);
        fadeTo(0, 220);
        setTimeout(() => music.pause(), 240);
        subtitleBox.classList.add("hidden");
    }
}

music.addEventListener("ended", async () => {
    if (repeatMode === 2) { await loadTrack(currentIndex, { autoplay: true }); return; }
    await loadTrack(pickNextIndex(+1), { autoplay: true });
});

bigBtn.addEventListener("click", playOrPause);
playBtn.addEventListener("click", playOrPause);
nextBtn.addEventListener("click", () => loadTrack(repeatMode === 2 ? currentIndex : pickNextIndex(+1), { autoplay: isPlaying }));
prevBtn.addEventListener("click", () => loadTrack(pickNextIndex(-1), { autoplay: isPlaying }));
shuffleBtn.addEventListener("click", () => { shuffleOn = !shuffleOn; if (shuffleOn) refillShuffleBag(); syncShuffleUI(); });
repeatBtn.addEventListener("click", () => { repeatMode = (repeatMode + 1) % 3; syncRepeatUI(); });

// ✨ 修復 FMI 按鈕
fmiBtn.addEventListener("click", () => {
    const isOpen = extraContent.classList.toggle("show");
    arrow.classList.toggle("rotate");
    extraContent.setAttribute("aria-hidden", String(!isOpen));
    fmiBtn.setAttribute("aria-expanded", String(isOpen));
});

// --- 人物資料 ---
const people = [
    { name: "ジャンクフード1337", subtitle: "I'll introduce myself?", hobby: "hobbies? Nah, I just wanna lie on my cozy bed.", skills: "I can play a nice HvH game on my dogshit laptop with 30 FPS", motto1: "Eat junk food, stay up late, and cheat in games.", motto2: "Trust in urself, u are the best!", qq: "2073095729", email: "yzxdsb123@gmail.com", discord: "yyyuuu_38459", avatar: "avatar.png", bilibili: "https://space.bilibili.com/391436861/upload/video", instagram: "https://www.instagram.com/yzxdsb123/", x: "https://x.com/Mina1337skeet" },
    { name: "yazawasaki", subtitle: "here is Kevin I’m a Cantonese not hongkongnese I know some English and Cantonese and if you want I can speak Mandarin", hobby: "Watching animes and play some dog shit cheats", skills: "Still loading...", motto1: "No cheat, no life.", motto2: "私はhungryのネガだろ", qq: "2141737297", email: "ccxhb298@gmail.com", discord: "ccxhb", avatar: "avatar1.png", bilibili: "https://space.bilibili.com/3493121857948256", x: "https://x.com/YazawaSakicn" },
    { name: "周防", subtitle: "老傻子", hobby: "喜欢唱跳rap打篮球", skills: "Also nope", motto1: "老傻子沒有座右铭", qq: "1736867100", email: "1736867100@qq.com", discord: "adafsgf", avatar: "avatar2.png" }
];

let currentPersonIndex = 0;
const cardUI = document.querySelector(".card");
const avatarEl = document.getElementById("cardAvatar");

function maskEmail(s) { const at = (s || "").indexOf("@"); return at <= 1 ? s : s.slice(0, 2) + "•••" + s.slice(at); }
function maskMiddle(s) { return (!s || s.length < 5) ? s : s.slice(0, 2) + "•••" + s.slice(-2); }

function renderPerson(index) {
    const p = people[index];
    document.getElementById("cardName").textContent = `Welcome to ${p.name}'s Personal Introduction`;
    document.getElementById("cardSubtitle").textContent = p.subtitle;
    document.getElementById("cardHobby").textContent = p.hobby;
    document.getElementById("cardSkills").textContent = p.skills;
    document.getElementById("cardMotto1").textContent = p.motto1;
    document.getElementById("cardMotto2").textContent = p.motto2;
    document.getElementById("cardQQ").textContent = maskMiddle(p.qq);
    document.getElementById("cardEmail").textContent = maskEmail(p.email);
    document.getElementById("cardDiscord").textContent = maskMiddle(p.discord);
    avatarEl.src = p.avatar;
    
    const b = document.getElementById("cardBili"), i = document.getElementById("cardIG"), x = document.getElementById("cardX");
    b.href = p.bilibili || "#"; b.style.display = p.bilibili ? "inline-flex" : "none";
    b.textContent = "Visit Bilibili";
    i.href = p.instagram || "#"; i.style.display = p.instagram ? "inline-flex" : "none";
    i.textContent = "Visit Instagram";
    x.href = p.x || "#"; x.style.display = p.x ? "inline-flex" : "none";
    x.textContent = "Visit X";
}

// ✨ 修復切換資料按鈕
document.getElementById("changePersonBtn").addEventListener("click", () => {
    cardUI.classList.add("fade");
    avatarEl.classList.add("fade-avatar");
    setTimeout(() => {
        currentPersonIndex = (currentPersonIndex + 1) % people.length;
        renderPerson(currentPersonIndex);
        cardUI.classList.remove("fade");
        avatarEl.classList.remove("fade-avatar");
    }, 200);
});

// ✨ 修復點擊複製功能
function attachCopy(id, type) {
    const el = document.getElementById(id);
    if(!el) return;
    el.style.cursor = "pointer";
    el.addEventListener("click", async () => {
        const text = people[currentPersonIndex][type];
        await navigator.clipboard.writeText(text);
        const oldText = el.textContent;
        el.textContent = "已複製 ✅";
        setTimeout(() => { el.textContent = oldText; }, 650);
    });
}
attachCopy("cardQQ", "qq");
attachCopy("cardEmail", "email");
attachCopy("cardDiscord", "discord");

// ✨ 修復滑鼠跟隨卡片 3D 特效
let mx = 0, my = 0, ticking = false;
document.addEventListener("mousemove", (e) => {
    mx = e.pageX; my = e.pageY;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
        if (cardUI) {
            // 計算旋轉角度
            const rect = cardUI.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const maxTilt = 4.5;
            const rotateX = Math.max(-maxTilt, Math.min(maxTilt, (centerY - my) / 55));
            const rotateY = Math.max(-maxTilt, Math.min(maxTilt, -(centerX - mx) / 55));

            cardUI.style.setProperty("--rx", `${rotateX}deg`);
            cardUI.style.setProperty("--ry", `${rotateY}deg`);
        }
        ticking = false;
    });
});

// --- 聊天室功能 ---
let chatBusy = false;
let chatController = null;

function setChatOpen(open) {
    windowEl.classList.toggle('active', open);
    windowEl.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    if (open) chatInput.focus();
    else launcher.focus();
}

launcher.addEventListener('click', () => setChatOpen(true));
closeBtn.addEventListener('click', () => setChatOpen(false));
windowEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setChatOpen(false);
});

function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

async function callDeepSeekStream(userMsg) {
    chatController = new AbortController();
    try {
        const response = await fetch('/api/chat', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMsg }),
            signal: chatController.signal
        });

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail.error || `API 請求失敗 (${response.status})`);
        }

        const aiMsgDiv = document.createElement('div');
        aiMsgDiv.className = 'message ai';
        aiMsgDiv.textContent = '';
        chatMessages.appendChild(aiMsgDiv);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let lastScrollTime = 0;
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const lines = buffer.split("\n");
            buffer = done ? "" : lines.pop();
            for (const line of lines) {
                const payload = line.startsWith("data: ") ? line.slice(6).trim() : "";
                if (payload && payload !== "[DONE]") {
                    try {
                        const jsonData = JSON.parse(payload);
                        const content = jsonData.choices?.[0]?.delta?.content || "";
                        aiMsgDiv.textContent += content;
                        
                        const now = Date.now();
                        if (now - lastScrollTime > 50) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                            lastScrollTime = now;
                        }
                    } catch (error) {
                        console.warn("忽略無法解析的串流資料", error);
                    }
                }
            }
            if (done) break;
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        if (error.name !== 'AbortError') addMessage('ai', error.message || "連線失敗...");
    } finally {
        chatController = null;
    }
}

async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || chatBusy) return;
    chatBusy = true;
    sendBtn.disabled = true;
    addMessage('user', text);
    chatInput.value = '';
    try {
        await callDeepSeekStream(text);
    } finally {
        chatBusy = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

sendBtn.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });

// 初始化
renderPerson(0);
syncUIPlaying(false);
syncShuffleUI();
syncRepeatUI();
