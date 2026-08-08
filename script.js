// ============================================================
// ADMFLIP FRONTEND
// ============================================================

const BACKEND = "https://admflip-new.onrender.com";

// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentSection = localStorage.getItem("admflipSection") || "home";

let pets = [];
let inventory = [];
let chatMessages = [];

let chatOpen = false;
let valuesOpen = false;

let onlineCount = Number(localStorage.getItem("admflipOnline") || 42);

let selectedTipPet = null;
let selectedCoinflipPet = null;

// ============================================================
// HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatNumber(value) {
    const n = Number(value || 0);

    if (!Number.isFinite(n)) {
        return "0";
    }

    return n.toLocaleString();
}

function saveSection(section) {
    currentSection = section;
    localStorage.setItem("admflipSection", section);
}

function getAvatar(user) {
    return user?.avatar || "roblox.png";
}

// ============================================================
// INITIAL PAGE SETUP
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    loadSavedUser();

    createApplicationUI();

    setupNavigation();

    restoreSection();

    await loadPets();

    await loadStatus();

    if (currentUser) {
        await loadInventory();
    }

    startOnlineCounter();

    startStatusPolling();

    startChatPolling();
});

// ============================================================
// LOGIN
// ============================================================

function loadSavedUser() {

    try {

        const saved = localStorage.getItem("admflipUser");

        if (!saved) {
            return;
        }

        currentUser = JSON.parse(saved);

        if (
            !currentUser ||
            !currentUser.id ||
            !currentUser.username
        ) {
            currentUser = null;
            localStorage.removeItem("admflipUser");
            return;
        }

        updateAccountUI();

    } catch (error) {

        console.error("Saved login error:", error);

        currentUser = null;

        localStorage.removeItem("admflipUser");
    }
}

function updateAccountUI() {

    const loginBtn = $("loginBtn");
    const logoutBtn = $("logoutBtn");

    if (!loginBtn) {
        return;
    }

    if (currentUser) {

        loginBtn.innerHTML = `
            <img
                src="${escapeHTML(getAvatar(currentUser))}"
                class="account-avatar"
                onerror="this.src='roblox.png'"
            >
            <span>${escapeHTML(currentUser.username)}</span>
        `;

        loginBtn.classList.add("logged");

        if (logoutBtn) {
            logoutBtn.style.display = "block";
        }

    } else {

        loginBtn.innerHTML = `
            <img src="roblox.png" class="account-avatar">
            <span>Sign In</span>
        `;

        loginBtn.classList.remove("logged");

        if (logoutBtn) {
            logoutBtn.style.display = "none";
        }
    }
}

// ============================================================
// CREATE / REPAIR UI
// ============================================================

function createApplicationUI() {

    const body = document.body;

    // -------------------------
    // MAIN APPLICATION
    // -------------------------

    if (!$("admflipApp")) {

        const app = document.createElement("main");

        app.id = "admflipApp";

        app.innerHTML = `
            <section id="homeSection" class="page-section">
                <div class="hero">
                    <div class="hero-copy">
                        <div class="hero-kicker">ADMFLIP</div>

                        <h1>
                            Trade smarter.
                            <span>Flip better.</span>
                        </h1>

                        <p>
                            Trade pets, check values and connect with
                            other Adopt Me traders.
                        </p>

                        <div class="hero-actions">
                            <button id="heroCoinflip" class="primary-btn">
                                Coinflip
                            </button>

                            <button id="heroValues" class="secondary-btn">
                                Pet Values
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section id="coinflipSection" class="page-section hidden-section">
                <div class="section-header">
                    <div>
                        <span class="section-label">FLIP</span>
                        <h2>Coinflip</h2>
                        <p>Find another trader and post your side.</p>
                    </div>

                    <div class="section-actions">
                        <button id="createCoinflipBtn" class="primary-btn">
                            Create
                        </button>

                        <button id="historyCoinflipBtn" class="secondary-btn">
                            History
                        </button>
                    </div>
                </div>

                <div id="coinflipList" class="coinflip-list">
                    <div class="empty-state">
                        No active coinflips yet.
                    </div>
                </div>
            </section>

            <section id="valuesSection" class="page-section hidden-section">
                <div class="section-header">
                    <div>
                        <span class="section-label">VALUES</span>
                        <h2>Pet Values</h2>
                        <p>Browse current pet values.</p>
                    </div>

                    <input
                        id="petSearch"
                        class="pet-search"
                        placeholder="Search pets..."
                        autocomplete="off"
                    >
                </div>

                <div id="petsGrid" class="pets-grid"></div>
            </section>
        `;

        body.appendChild(app);
    }

    // -------------------------
    // CHAT
    // -------------------------

    if (!$("admflipChat")) {

        const chat = document.createElement("aside");

        chat.id = "admflipChat";

        chat.innerHTML = `
            <div class="chat-header">

                <div>
                    <strong>Community</strong>

                    <div class="online-indicator">
                        <span></span>
                        <b id="onlineCount">${onlineCount}</b> online
                    </div>
                </div>

                <button
                    id="chatRulesBtn"
                    class="chat-icon-btn"
                    title="Rules"
                >
                    ?
                </button>

            </div>

            <div id="chatRules" class="chat-rules hidden">
                <strong>Community Rules</strong>

                <div>• No advertising</div>
                <div>• No harassment</div>
                <div>• No sexual activities/content</div>
                <div>• No scams or impersonation</div>
                <div>• No malicious links</div>
            </div>

            <div id="chatMessages" class="chat-messages">
                <div class="chat-empty">
                    Loading community...
                </div>
            </div>

            <div id="chatLoginNotice" class="chat-login-notice hidden">
                Sign in to participate in chat.
            </div>

            <form id="chatForm" class="chat-form">

                <input
                    id="chatInput"
                    maxlength="300"
                    placeholder="Write a message..."
                    autocomplete="off"
                >

                <button type="submit">
                    Send
                </button>

            </form>
        `;

        body.appendChild(chat);
    }

    // -------------------------
    // CHAT MOBILE BUTTON
    // -------------------------

    if (!$("mobileChatButton")) {

        const button = document.createElement("button");

        button.id = "mobileChatButton";

        button.className = "mobile-chat-button";

        button.innerHTML = "Chat";

        document.body.appendChild(button);

        button.onclick = toggleChat;
    }

    // -------------------------
    // VALUES NAV BUTTON
    // -------------------------

    setupExistingMenu();

    // -------------------------
    // MODALS
    // -------------------------

    createModals();

    // -------------------------
    // EVENTS
    // -------------------------

    const loginBtn = $("loginBtn");

    if (loginBtn) {

        loginBtn.onclick = () => {

            if (!currentUser) {

                const modal = $("modal");

                if (modal) {
                    modal.classList.add("show");
                }
            }
        };
    }

    const logoutBtn = $("logoutBtn");

    if (logoutBtn) {

        logoutBtn.onclick = () => {

            currentUser = null;

            inventory = [];

            localStorage.removeItem("admflipUser");

            updateAccountUI();

            renderInventory();
        };
    }

    const heroCoinflip = $("heroCoinflip");

    if (heroCoinflip) {
        heroCoinflip.onclick = () => showSection("coinflip");
    }

    const heroValues = $("heroValues");

    if (heroValues) {
        heroValues.onclick = () => showSection("values");
    }

    const createCoinflipBtn = $("createCoinflipBtn");

    if (createCoinflipBtn) {
        createCoinflipBtn.onclick = openCoinflipModal;
    }

    const historyCoinflipBtn = $("historyCoinflipBtn");

    if (historyCoinflipBtn) {
        historyCoinflipBtn.onclick = loadCoinflipHistory;
    }

    const petSearch = $("petSearch");

    if (petSearch) {

        petSearch.addEventListener("input", () => {
            renderPets(petSearch.value);
        });
    }

    const chatRulesBtn = $("chatRulesBtn");

    if (chatRulesBtn) {

        chatRulesBtn.onclick = () => {

            const rules = $("chatRules");

            if (rules) {
                rules.classList.toggle("hidden");
            }
        };
    }

    const chatForm = $("chatForm");

    if (chatForm) {
        chatForm.addEventListener("submit", sendChatMessage);
    }

    // Username verification if original modal exists.
    setupRobloxLogin();
}

// ============================================================
// NAVIGATION
// ============================================================

function setupExistingMenu() {

    const menu = document.querySelector(".menu");

    if (!menu) {
        return;
    }

    const links = menu.querySelectorAll("a");

    links.forEach(link => {

        const text = link.textContent.trim().toLowerCase();

        if (text.includes("coinflip")) {

            link.onclick = event => {

                event.preventDefault();

                showSection("coinflip");
            };
        }

        else if (text.includes("chat")) {

            link.onclick = event => {

                event.preventDefault();

                toggleChat();
            };
        }

        else if (text.includes("leaderboard") || text.includes("value")) {

            link.onclick = event => {

                event.preventDefault();

                showSection("values");
            };
        }
    });
}

function setupNavigation() {

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            const modal = $("modal");

            if (modal) {
                modal.classList.remove("show");
            }

            closeCoinflipModal();
            closeTipModal();
        }
    });
}

function restoreSection() {

    if (
        currentSection !== "home" &&
        currentSection !== "coinflip" &&
        currentSection !== "values"
    ) {
        currentSection = "home";
    }

    showSection(currentSection, false);
}

function showSection(section, save = true) {

    if (save) {
        saveSection(section);
    }

    const sections = [
        "homeSection",
        "coinflipSection",
        "valuesSection"
    ];

    sections.forEach(id => {

        const el = $(id);

        if (el) {
            el.classList.add("hidden-section");
        }
    });

    const target = $(section + "Section");

    if (target) {
        target.classList.remove("hidden-section");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ============================================================
// CHAT
// ============================================================

function toggleChat() {

    const chat = $("admflipChat");

    if (!chat) {
        return;
    }

    chatOpen = !chatOpen;

    chat.classList.toggle("open", chatOpen);

    document.body.classList.toggle(
        "chat-open",
        chatOpen
    );
}

async function startChatPolling() {

    await loadChat();

    setInterval(loadChat, 5000);
}

async function loadChat() {

    try {

        const response = await fetch(
            `${BACKEND}/chat`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (Array.isArray(data.messages)) {

            chatMessages = data.messages;

            renderChat();
        }

    } catch (error) {

        // Chat can be unavailable while backend is deploying.
        console.debug("Chat unavailable");
    }
}

function renderChat() {

    const container = $("chatMessages");

    if (!container) {
        return;
    }

    if (!chatMessages.length) {

        container.innerHTML = `
            <div class="chat-empty">
                No messages yet.
            </div>
        `;

        return;
    }

    container.innerHTML = chatMessages
        .slice(-100)
        .map(message => {

            const username =
                message.username ||
                message.user?.username ||
                "User";

            const avatar =
                message.avatar ||
                message.user?.avatar ||
                "roblox.png";

            const text =
                message.text ||
                message.message ||
                "";

            return `
                <div class="chat-message">

                    <img
                        src="${escapeHTML(avatar)}"
                        onerror="this.src='roblox.png'"
                        class="chat-avatar"
                    >

                    <div class="chat-message-content">

                        <div class="chat-name">
                            ${escapeHTML(username)}
                        </div>

                        <div class="chat-text">
                            ${escapeHTML(text)}
                        </div>

                    </div>

                </div>
            `;
        })
        .join("");

    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(event) {

    event.preventDefault();

    if (!currentUser) {

        alert("You must sign in before chatting.");

        return;
    }

    const input = $("chatInput");

    if (!input) {
        return;
    }

    const text = input.value.trim();

    if (!text) {
        return;
    }

    // Block links before they ever reach the backend.
    if (containsLink(text)) {

        alert("Links are not allowed in chat.");

        return;
    }

    if (containsBlockedContent(text)) {

        alert("That message is not allowed.");

        return;
    }

    input.disabled = true;

    try {

        const response = await fetch(
            `${BACKEND}/chat`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    robloxId: currentUser.id,
                    username: currentUser.username,
                    avatar: currentUser.avatar,
                    text
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {

            alert(
                data.message ||
                "Unable to send message."
            );

            return;
        }

        input.value = "";

        await loadChat();

    } catch (error) {

        console.error(error);

        alert("Chat server is unavailable.");

    } finally {

        input.disabled = false;

        input.focus();
    }
}

function containsLink(text) {

    return (
        /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|bit\.ly\/|\.com\b|\.net\b|\.org\b|\.gg\b)/i
            .test(text)
    );
}

function containsBlockedContent(text) {

    const blocked = [
        "porn",
        "sex",
        "nude",
        "nudes",
        "sexual"
    ];

    const lower = text.toLowerCase();

    return blocked.some(word => lower.includes(word));
}

// ============================================================
// ONLINE COUNT
// ============================================================

function startOnlineCounter() {

    updateOnlineDisplay();

    // Only update occasionally instead of every refresh.
    // Persisted value prevents absurd jumps.
    setInterval(() => {

        const change =
            Math.floor(Math.random() * 7) - 3;

        onlineCount += change;

        if (onlineCount < 30) {
            onlineCount = 30;
        }

        if (onlineCount > 54) {
            onlineCount = 54;
        }

        localStorage.setItem(
            "admflipOnline",
            String(onlineCount)
        );

        updateOnlineDisplay();

    }, 70000 + Math.random() * 30000);
}

function updateOnlineDisplay() {

    const el = $("onlineCount");

    if (el) {
        el.textContent = onlineCount;
    }
}

// ============================================================
// BACKEND STATUS
// ============================================================

async function loadStatus() {

    try {

        const response = await fetch(
            `${BACKEND}/status`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data.online === false) {

            showMaintenance();

        } else {

            hideMaintenance();
        }

    } catch (error) {

        console.debug("Status unavailable");
    }
}

function startStatusPolling() {

    setInterval(loadStatus, 30000);
}

function showMaintenance() {

    let overlay = $("maintenanceOverlay");

    if (!overlay) {

        overlay = document.createElement("div");

        overlay.id = "maintenanceOverlay";

        overlay.innerHTML = `
            <div class="maintenance-box">
                <div class="maintenance-icon">ADM</div>
                <h2>Temporarily offline</h2>
                <p>
                    ADMFLIP is currently unavailable.
                    Please check back shortly.
                </p>
            </div>
        `;

        document.body.appendChild(overlay);
    }
}

function hideMaintenance() {

    const overlay = $("maintenanceOverlay");

    if (overlay) {
        overlay.remove();
    }
}

// ============================================================
// PET VALUES
// ============================================================

async function loadPets() {

    try {

        const response = await fetch(
            `${BACKEND}/pets`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Pet endpoint unavailable");
        }

        const data = await response.json();

        pets = Array.isArray(data.pets)
            ? data.pets
            : [];

        renderPets();

    } catch (error) {

        console.error("Pet loading error:", error);

        const grid = $("petsGrid");

        if (grid) {

            grid.innerHTML = `
                <div class="empty-state">
                    Unable to load pet values.
                </div>
            `;
        }
    }
}

function renderPets(search = "") {

    const grid = $("petsGrid");

    if (!grid) {
        return;
    }

    const query = search.trim().toLowerCase();

    const filtered = pets.filter(pet => {

        return String(pet.name || "")
            .toLowerCase()
            .includes(query);
    });

    if (!filtered.length) {

        grid.innerHTML = `
            <div class="empty-state">
                No pets found.
            </div>
        `;

        return;
    }

    grid.innerHTML = filtered
        .map(pet => {

            const image =
                pet.image ||
                pet.imageUrl ||
                pet.thumbnail ||
                getPetImage(pet.name);

            return `
                <article class="pet-card">

                    <div class="pet-image-wrap">

                        <img
                            src="${escapeHTML(image)}"
                            class="pet-image"
                            loading="lazy"
                            onerror="
                                this.onerror=null;
                                this.src='logo.png';
                            "
                        >

                    </div>

                    <div class="pet-info">

                        <h3>
                            ${escapeHTML(pet.name)}
                        </h3>

                        <strong>
                            ${formatNumber(pet.value)}
                        </strong>

                    </div>

                </article>
            `;
        })
        .join("");
}

// Image lookup is intentionally done through your own backend.
// The browser should not scrape third-party calculators directly.
function getPetImage(name) {

    return (
        `${BACKEND}/pet-image?name=` +
        encodeURIComponent(name)
    );
}

// ============================================================
// ROBLOX LOGIN
// ============================================================

function setupRobloxLogin() {

    const usernameInput = $("username");
    const profile = $("profile");
    const phraseText = $("phrase");
    const verifyBtn = $("verify");

    if (
        !usernameInput ||
        !profile ||
        !phraseText ||
        !verifyBtn
    ) {
        return;
    }

    let phrase = "";

    usernameInput.onchange = async () => {

        const username =
            usernameInput.value.trim();

        if (!username) {
            return;
        }

        try {

            const response = await fetch(
                `${BACKEND}/user/${encodeURIComponent(username)}`
            );

            const data = await response.json();

            if (!data.success) {

                alert(
                    data.message ||
                    "Roblox username not found."
                );

                return;
            }

            currentUser = data.user;

            profile.classList.remove("hidden");

            profile.innerHTML = `
                <img
                    width="80"
                    src="${escapeHTML(currentUser.avatar)}"
                    onerror="this.src='roblox.png'"
                >

                <br><br>

                <b>
                    ${escapeHTML(currentUser.username)}
                </b>
            `;

            const phraseResponse =
                await fetch(`${BACKEND}/create`);

            const phraseData =
                await phraseResponse.json();

            phrase = phraseData.phrase;

            phraseText.classList.remove("hidden");

            phraseText.innerHTML = `
                Put this phrase in your Roblox bio:

                <br><br>

                <b>${escapeHTML(phrase)}</b>
            `;

            verifyBtn.style.display = "block";

        } catch (error) {

            console.error(error);

            alert(
                "The login server is temporarily unavailable."
            );
        }
    };

    verifyBtn.onclick = async () => {

        if (!currentUser || !phrase) {
            return;
        }

        verifyBtn.disabled = true;

        verifyBtn.innerText = "Checking...";

        try {

            const response = await fetch(
                `${BACKEND}/check`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        username: currentUser.username,
                        phrase
                    })
                }
            );

            const data = await response.json();

            if (!data.success) {

                alert(
                    data.message ||
                    "Verification phrase not found."
                );

                verifyBtn.disabled = false;
                verifyBtn.innerText = "Verify";

                return;
            }

            // Persist the actual verified user.
            localStorage.setItem(
                "admflipUser",
                JSON.stringify({
                    id: data.id || currentUser.id,
                    robloxId: data.id || currentUser.id,
                    username: data.username || currentUser.username,
                    avatar: currentUser.avatar
                })
            );

            currentUser = JSON.parse(
                localStorage.getItem("admflipUser")
            );

            updateAccountUI();

            const modal = $("modal");

            if (modal) {
                modal.classList.remove("show");
            }

            await loadInventory();

            alert("Verified successfully.");

        } catch (error) {

            console.error(error);

            alert(
                "The login server is temporarily unavailable."
            );

        } finally {

            verifyBtn.disabled = false;

            verifyBtn.innerText = "Verify";
        }
    };
}

// ============================================================
// INVENTORY
// ============================================================

async function loadInventory() {

    if (!currentUser) {
        inventory = [];
        renderInventory();
        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/inventory/${encodeURIComponent(currentUser.id)}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        inventory =
            Array.isArray(data.inventory)
                ? data.inventory
                : [];

        renderInventory();

    } catch (error) {

        console.debug("Inventory endpoint unavailable.");
    }
}

function renderInventory(containerId = "inventoryGrid") {

    const container = $(containerId);

    if (!container) {
        return;
    }

    if (!inventory.length) {

        container.innerHTML = `
            <div class="inventory-empty">

                <div>
                    You don't have any deposited pets.
                </div>

                <button
                    class="primary-btn"
                    onclick="openDepositModal()"
                >
                    Deposit
                </button>

                <small>
                    Deposit via Discord — safe option.
                    Automatic bot deposits coming soon.
                </small>

            </div>
        `;

        return;
    }

    container.innerHTML = inventory
        .map((pet, index) => {

            const image =
                pet.image ||
                getPetImage(pet.name);

            return `
                <button
                    class="inventory-item"
                    data-index="${index}"
                    onclick="selectInventoryPet(${index})"
                >

                    <img
                        src="${escapeHTML(image)}"
                        onerror="this.src='logo.png'"
                    >

                    <div>
                        <b>
                            ${escapeHTML(pet.name)}
                        </b>

                        <span>
                            ${formatNumber(pet.value)}
                        </span>
                    </div>

                </button>
            `;
        })
        .join("");
}

window.selectInventoryPet = function(index) {

    if (!inventory[index]) {
        return;
    }

    selectedCoinflipPet = inventory[index];

    document
        .querySelectorAll(".inventory-item")
        .forEach(el => el.classList.remove("selected"));

    const item =
        document.querySelector(
            `.inventory-item[data-index="${index}"]`
        );

    if (item) {
        item.classList.add("selected");
    }
};

// ============================================================
// COINFLIP
// ============================================================

async function loadCoinflips() {

    const container = $("coinflipList");

    if (!container) {
        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/coinflips`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Coinflip endpoint unavailable");
        }

        const data = await response.json();

        const flips =
            Array.isArray(data.coinflips)
                ? data.coinflips
                : [];

        if (!flips.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No active coinflips yet.
                </div>
            `;

            return;
        }

        container.innerHTML = flips.map(renderCoinflip).join("");

    } catch (error) {

        container.innerHTML = `
            <div class="empty-state">
                No active coinflips yet.
            </div>
        `;
    }
}

function renderCoinflip(flip) {

    const username =
        flip.username ||
        flip.user?.username ||
        "Trader";

    const avatar =
        flip.avatar ||
        flip.user?.avatar ||
        "roblox.png";

    const petName =
        flip.pet?.name ||
        flip.petName ||
        "Unknown Pet";

    const value =
        flip.pet?.value ||
        flip.value ||
        0;

    const side =
        flip.side ||
        "Heads";

    return `
        <article class="coinflip-card">

            <div class="coinflip-user">

                <img
                    src="${escapeHTML(avatar)}"
                    onerror="this.src='roblox.png'"
                >

                <div>
                    <b>${escapeHTML(username)}</b>
                    <span>${escapeHTML(side)}</span>
                </div>

            </div>

            <div class="coinflip-pet">

                <img
                    src="${escapeHTML(
                        flip.pet?.image ||
                        getPetImage(petName)
                    )}"
                    onerror="this.src='logo.png'"
                >

                <div>
                    <strong>${escapeHTML(petName)}</strong>
                    <span>${formatNumber(value)}</span>
                </div>

            </div>

            <button
                class="secondary-btn"
                onclick="joinCoinflip('${escapeHTML(flip._id || flip.id || "")}')"
            >
                Join
            </button>

        </article>
    `;
}

async function openCoinflipModal() {

    if (!currentUser) {

        alert("Sign in first.");

        return;
    }

    const modal = $("coinflipModal");

    if (!modal) {
        return;
    }

    await loadInventory();

    modal.classList.add("show");
}

function closeCoinflipModal() {

    const modal = $("coinflipModal");

    if (modal) {
        modal.classList.remove("show");
    }
}

async function createCoinflip() {

    if (!currentUser) {
        alert("Sign in first.");
        return;
    }

    if (!selectedCoinflipPet) {

        alert(
            "Choose a pet from your inventory."
        );

        return;
    }

    const sideElement =
        document.querySelector(
            'input[name="coinflipSide"]:checked'
        );

    if (!sideElement) {

        alert("Choose Heads or Tails.");

        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/coinflips`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    userId: currentUser.id,
                    username: currentUser.username,
                    side: sideElement.value,
                    petId:
                        selectedCoinflipPet._id ||
                        selectedCoinflipPet.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {

            alert(
                data.message ||
                "Unable to create coinflip."
            );

            return;
        }

        selectedCoinflipPet = null;

        closeCoinflipModal();

        await loadInventory();

        await loadCoinflips();

    } catch (error) {

        console.error(error);

        alert(
            "Coinflip server is unavailable."
        );
    }
}

window.joinCoinflip = async function(id) {

    if (!currentUser) {

        alert("Sign in first.");

        return;
    }

    if (!id) {
        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/coinflips/${encodeURIComponent(id)}/join`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    userId: currentUser.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {

            alert(
                data.message ||
                "Unable to join coinflip."
            );

            return;
        }

        await loadInventory();

        await loadCoinflips();

    } catch (error) {

        console.error(error);

        alert(
            "Coinflip server is unavailable."
        );
    }
};

// ============================================================
// HISTORY
// ============================================================

async function loadCoinflipHistory() {

    if (!currentUser) {

        alert("Sign in first.");

        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/coinflips/history/${encodeURIComponent(currentUser.id)}`
        );

        const data = await response.json();

        const flips =
            Array.isArray(data.coinflips)
                ? data.coinflips
                : [];

        const container = $("coinflipList");

        if (!container) {
            return;
        }

        if (!flips.length) {

            container.innerHTML = `
                <div class="empty-state">
                    You have no coinflip history.
                </div>
            `;

            return;
        }

        container.innerHTML = flips
            .map(renderCoinflip)
            .join("");

    } catch (error) {

        alert("Unable to load history.");
    }
}

// ============================================================
// TIPPING
// ============================================================

async function openTipModal(userId, username) {

    if (!currentUser) {

        alert("Sign in first.");

        return;
    }

    if (
        String(userId) ===
        String(currentUser.id)
    ) {

        alert("You cannot tip yourself.");

        return;
    }

    const modal = $("tipModal");

    if (!modal) {
        return;
    }

    modal.dataset.userId = userId;

    modal.dataset.username = username;

    const title = $("tipUsername");

    if (title) {
        title.textContent = username;
    }

    await loadInventory();

    renderInventory("tipInventory");

    modal.classList.add("show");
}

function closeTipModal() {

    const modal = $("tipModal");

    if (modal) {
        modal.classList.remove("show");
    }

    selectedTipPet = null;
}

window.selectTipPet = function(index) {

    if (!inventory[index]) {
        return;
    }

    selectedTipPet = inventory[index];

    document
        .querySelectorAll("#tipInventory .inventory-item")
        .forEach(el => el.classList.remove("selected"));

    const selected =
        document.querySelector(
            `#tipInventory .inventory-item[data-index="${index}"]`
        );

    if (selected) {
        selected.classList.add("selected");
    }
};

async function sendTip() {

    const modal = $("tipModal");

    if (!modal || !selectedTipPet) {

        alert("Choose a pet.");

        return;
    }

    if (!currentUser) {

        alert("Sign in first.");

        return;
    }

    const recipientId =
        modal.dataset.userId;

    if (!recipientId) {
        return;
    }

    try {

        const response = await fetch(
            `${BACKEND}/tips`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    fromUserId: currentUser.id,
                    toUserId: recipientId,
                    petId:
                        selectedTipPet._id ||
                        selectedTipPet.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {

            alert(
                data.message ||
                "Unable to send tip."
            );

            return;
        }

        closeTipModal();

        await loadInventory();

        alert("Tip sent.");

    } catch (error) {

        console.error(error);

        alert(
            "Tip server is unavailable."
        );
    }
}

// ============================================================
// USER PROFILE
// ============================================================

async function openUserProfile(userId, username, avatar) {

    const modal = $("profileModal");

    if (!modal) {
        return;
    }

    $("profileName").textContent =
        username || "Trader";

    $("profileAvatar").src =
        avatar || "roblox.png";

    $("profileStats").innerHTML = `
        <div class="profile-stat">
            <span>Wagered</span>
            <strong>Loading...</strong>
        </div>

        <div class="profile-stat">
            <span>Profit</span>
            <strong>Loading...</strong>
        </div>
    `;

    modal.classList.add("show");

    try {

        const response = await fetch(
            `${BACKEND}/profile/${encodeURIComponent(userId)}`
        );

        const data = await response.json();

        const wagered =
            data.wagered ||
            data.totalWagered ||
            0;

        const profit =
            data.profit ||
            data.totalProfit ||
            0;

        $("profileStats").innerHTML = `
            <div class="profile-stat">
                <span>Wagered</span>
                <strong>${formatNumber(wagered)}</strong>
            </div>

            <div class="profile-stat">
                <span>Profit</span>
                <strong>${formatNumber(profit)}</strong>
            </div>
        `;

    } catch (error) {

        $("profileStats").innerHTML = `
            <div class="profile-stat">
                <span>Wagered</span>
                <strong>0</strong>
            </div>

            <div class="profile-stat">
                <span>Profit</span>
                <strong>0</strong>
            </div>
        `;
    }
}

// ============================================================
// DEPOSIT
// ============================================================

function openDepositModal() {

    alert(
        "Deposit via Discord is coming soon. " +
        "Automatic bot deposits will be added later."
    );
}

window.openDepositModal = openDepositModal;

// ============================================================
// MODALS
// ============================================================

function createModals() {

    // -------------------------
    // COINFLIP
    // -------------------------

    if (!$("coinflipModal")) {

        const modal = document.createElement("div");

        modal.id = "coinflipModal";

        modal.className = "modal";

        modal.innerHTML = `
            <div class="box large-box">

                <button
                    class="modal-close"
                    onclick="closeCoinflipModal()"
                >
                    ×
                </button>

                <h2>Create Coinflip</h2>

                <p class="modal-description">
                    Choose one pet from your deposited inventory.
                </p>

                <div id="inventoryGrid" class="inventory-grid">
                    Loading inventory...
                </div>

                <div class="side-picker">

                    <label>
                        <input
                            type="radio"
                            name="coinflipSide"
                            value="Heads"
                        >
                        Heads
                    </label>

                    <label>
                        <input
                            type="radio"
                            name="coinflipSide"
                            value="Tails"
                        >
                        Tails
                    </label>

                </div>

                <button
                    class="primary-btn full-btn"
                    onclick="createCoinflip()"
                >
                    Create Coinflip
                </button>

            </div>
        `;

        document.body.appendChild(modal);
    }

    // -------------------------
    // TIP
    // -------------------------

    if (!$("tipModal")) {

        const modal = document.createElement("div");

        modal.id = "tipModal";

        modal.className = "modal";

        modal.innerHTML = `
            <div class="box large-box">

                <button
                    class="modal-close"
                    onclick="closeTipModal()"
                >
                    ×
                </button>

                <h2>
                    Tip <span id="tipUsername">Trader</span>
                </h2>

                <p class="modal-description">
                    Select a pet to transfer.
                </p>

                <div
                    id="tipInventory"
                    class="inventory-grid"
                ></div>

                <button
                    class="primary-btn full-btn"
                    onclick="sendTip()"
                >
                    Send Tip
                </button>

            </div>
        `;

        document.body.appendChild(modal);
    }

    // -------------------------
    // PROFILE
    // -------------------------

    if (!$("profileModal")) {

        const modal = document.createElement("div");

        modal.id = "profileModal";

        modal.className = "modal";

        modal.innerHTML = `
            <div class="box">

                <button
                    class="modal-close"
                    onclick="
                        document
                            .getElementById('profileModal')
                            .classList.remove('show')
                    "
                >
                    ×
                </button>

                <img
                    id="profileAvatar"
                    class="profile-large-avatar"
                    src="roblox.png"
                >

                <h2 id="profileName">
                    Trader
                </h2>

                <div id="profileStats">
                    Loading...
                </div>

            </div>
        `;

        document.body.appendChild(modal);
    }
}

// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.toggleChat = toggleChat;
window.showSection = showSection;
window.openCoinflipModal = openCoinflipModal;
window.closeCoinflipModal = closeCoinflipModal;
window.loadCoinflips = loadCoinflips;
window.openTipModal = openTipModal;
window.closeTipModal = closeTipModal;
window.openUserProfile = openUserProfile;

// ============================================================
// INITIAL COINFLIP LOAD
// ============================================================

setTimeout(() => {

    if (currentSection === "coinflip") {
        loadCoinflips();
    }

}, 500);

// ============================================================
// PROTECTION AGAINST BASIC CLIENT-SIDE TAMPERING
// ============================================================

// This is NOT security by itself.
// The backend must independently validate every operation.

Object.freeze({
    formatNumber,
    containsLink,
    containsBlockedContent
});
