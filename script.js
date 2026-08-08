const BACKEND = "https://admflip-new.onrender.com";

const state = {
    token: localStorage.getItem("admflipToken") || "",
    user: null,
    selectedPet: null,
    selectedSide: null
};

const $ = id => document.getElementById(id);

function headers() {
    const result = {
        "Content-Type": "application/json"
    };

    if (state.token) {
        result.Authorization = `Bearer ${state.token}`;
    }

    return result;
}

async function api(path, options = {}) {
    const response = await fetch(BACKEND + path, {
        ...options,
        headers: {
            ...headers(),
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            success: false,
            message: "Invalid server response"
        };
    }

    if (response.status === 401) {
        state.token = "";
        state.user = null;
        localStorage.removeItem("admflipToken");
        localStorage.removeItem("admflipUser");
        updateAccountUI();
    }

    return data;
}

// =====================================================
// ACCOUNT
// =====================================================

function updateAccountUI() {
    if (state.user) {
        $("loginBtn").classList.add("hidden");
        $("inventoryBtn").classList.remove("hidden");
        $("userMini").classList.remove("hidden");
        $("logoutBtn").classList.remove("hidden");

        $("userMini").innerHTML = `
            <img
                src="${escapeAttr(state.user.avatar)}"
                title="${escapeAttr(state.user.username)}"
                alt=""
            >
        `;

        $("chatInput").placeholder = "Message chat...";
    } else {
        $("loginBtn").classList.remove("hidden");
        $("inventoryBtn").classList.add("hidden");
        $("userMini").classList.add("hidden");
        $("logoutBtn").classList.add("hidden");

        $("chatInput").placeholder = "Sign in to chat...";
    }
}

async function restoreSession() {
    if (!state.token) {
        updateAccountUI();
        return;
    }

    const data = await api("/me");

    if (data.success) {
        state.user = data.user;

        localStorage.setItem(
            "admflipUser",
            JSON.stringify(data.user)
        );
    } else {
        state.token = "";
        state.user = null;

        localStorage.removeItem("admflipToken");
        localStorage.removeItem("admflipUser");
    }

    updateAccountUI();
}

$("loginBtn").onclick = () => {
    $("loginModal").classList.remove("hidden");
};

$("loginCancel").onclick = () => {
    $("loginModal").classList.add("hidden");
};

$("logoutBtn").onclick = () => {
    state.token = "";
    state.user = null;

    localStorage.removeItem("admflipToken");
    localStorage.removeItem("admflipUser");

    updateAccountUI();
};

let phrase = "";

$("usernameInput").onchange = async () => {
    const username = $("usernameInput").value.trim();

    if (!username) return;

    const data = await api(
        "/user/" + encodeURIComponent(username)
    );

    if (!data.success) {
        showMessage(data.message || "Roblox username not found");
        return;
    }

    $("profilePreview").classList.remove("hidden");

    $("profilePreview").innerHTML = `
        <img src="${escapeAttr(data.user.avatar)}">
        <div><strong>${escapeHtml(data.user.username)}</strong></div>
    `;

    const phraseData = await api("/create");

    if (!phraseData.success) {
        showMessage("Could not create verification phrase");
        return;
    }

    phrase = phraseData.phrase;

    $("phraseBox").classList.remove("hidden");

    $("phraseBox").innerHTML = `
        Put this phrase in your Roblox bio:
        <br><br>
        <strong>${escapeHtml(phrase)}</strong>
    `;

    $("verifyBtn").classList.remove("hidden");
};

$("verifyBtn").onclick = async () => {
    const username = $("usernameInput").value.trim();

    if (!username || !phrase) return;

    $("verifyBtn").disabled = true;
    $("verifyBtn").textContent = "Checking...";

    const data = await api("/check", {
        method: "POST",
        body: JSON.stringify({
            username,
            phrase
        })
    });

    if (!data.success) {
        showMessage(
            data.message ||
            "Verification phrase not found."
        );

        $("verifyBtn").disabled = false;
        $("verifyBtn").textContent = "Verify";

        return;
    }

    state.token = data.token;
    state.user = data.user;

    localStorage.setItem(
        "admflipToken",
        state.token
    );

    localStorage.setItem(
        "admflipUser",
        JSON.stringify(state.user)
    );

    updateAccountUI();

    $("loginModal").classList.add("hidden");

    $("usernameInput").value = "";
    $("profilePreview").classList.add("hidden");
    $("phraseBox").classList.add("hidden");
    $("verifyBtn").classList.add("hidden");

    $("verifyBtn").disabled = false;
    $("verifyBtn").textContent = "Verify";

    await loadInventory();
};

$("inventoryBtn").onclick = async () => {
    if (!state.user) {
        $("loginModal").classList.remove("hidden");
        return;
    }

    $("inventoryModal").classList.remove("hidden");

    await loadInventory();
};

// =====================================================
// PAGES
// =====================================================

document.querySelectorAll(".menu button[data-page]")
    .forEach(button => {

        button.onclick = () => {
            openPage(button.dataset.page);
        };

    });

function openPage(page) {
    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    const target = $(page + "Page");

    if (target) {
        target.classList.add("active");
    }

    if (page === "coinflip") {
        loadCoinflips();
    }

    if (page === "values") {
        loadValues();
    }

    if (page === "leaderboard") {
        loadLeaderboard();
    }
}

// =====================================================
// CHAT
// =====================================================

const chatPanel = $("chatPanel");

$("chatNav").onclick = () => {
    chatPanel.classList.toggle("open");
};

$("chatClose").onclick = () => {
    chatPanel.classList.remove("open");
};

$("mobileChatBtn").onclick = () => {
    chatPanel.classList.toggle("open");
};

$("rulesBtn").onclick = () => {
    $("rulesBox").classList.toggle("hidden");
};

$("chatSend").onclick = sendChat;

$("chatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") {
        sendChat();
    }
});

async function sendChat() {
    if (!state.user || !state.token) {
        $("loginModal").classList.remove("hidden");
        return;
    }

    const input = $("chatInput");
    const message = input.value.trim();

    if (!message) return;

    if (containsLink(message)) {
        showMessage("Links are not allowed in chat.");
        return;
    }

    input.disabled = true;

    const data = await api("/chat", {
        method: "POST",
        body: JSON.stringify({
            message
        })
    });

    input.disabled = false;

    if (!data.success) {
        showMessage(data.message || "Could not send message");
        return;
    }

    input.value = "";

    loadChat();
}

async function loadChat() {
    const data = await api("/chat");

    if (!data.success) {
        $("chatMessages").innerHTML =
            `<div class="muted">Unable to load chat.</div>`;
        return;
    }

    $("onlineCount").textContent = data.online;

    if (!data.messages.length) {
        $("chatMessages").innerHTML =
            `<div class="muted">No messages yet.</div>`;
        return;
    }

    $("chatMessages").innerHTML =
        data.messages.map(message => {

            if (message.announcement) {
                return `
                    <div class="announcement">
                        <strong>ADMFLIP</strong>
                        <div>${escapeHtml(message.message)}</div>
                    </div>
                `;
            }

            return `
                <div class="chatMessage">
                    <img
                        class="chatAvatar"
                        src="${escapeAttr(message.avatar || "/roblox.png")}"
                        alt=""
                    >

                    <div>
                        <div class="chatName">
                            ${escapeHtml(message.username)}
                        </div>

                        <div class="chatText">
                            ${escapeHtml(message.message)}
                        </div>
                    </div>
                </div>
            `;

        }).join("");

    $("chatMessages").scrollTop =
        $("chatMessages").scrollHeight;
}

function containsLink(text) {
    return /https?:\/\//i.test(text) ||
        /www\./i.test(text) ||
        /\b[a-z0-9-]+\.(com|net|org|gg|io|co|me|xyz|dev|site|ly)\b/i.test(text) ||
        /discord\.gg/i.test(text) ||
        /discord\.com/i.test(text);
}

// Refresh messages without resetting the page or session.
setInterval(loadChat, 4000);

// =====================================================
// ONLINE
// =====================================================

// Server calculates this from a 100-second bucket.
// Therefore refreshes during the same bucket don't create
// ridiculous random changes.
async function refreshStatus() {
    const data = await api("/status");

    if (data.success) {
        $("onlineCount").textContent = data.onlineCount;
    }
}

refreshStatus();

setInterval(refreshStatus, 100000);

// =====================================================
// VALUES
// =====================================================

async function loadValues() {
    const container = $("valuesList");

    container.innerHTML = "Loading values...";

    const data = await api("/pets");

    if (!data.success || !Array.isArray(data.pets)) {
        container.innerHTML =
            `<div class="muted">Unable to load pet values.</div>`;
        return;
    }

    if (!data.pets.length) {
        container.innerHTML =
            `<div class="muted">No pet values available.</div>`;
        return;
    }

    container.innerHTML = data.pets.map(pet => {

        const image = getPetImage(pet.name);

        return `
            <div class="valueCard">

                ${
                    image
                    ? `
                        <img
                            class="petImage"
                            src="${escapeAttr(image)}"
                            onerror="this.style.display='none'"
                            alt=""
                        >
                    `
                    : ""
                }

                <div class="petInfo">
                    <div class="petName">
                        ${escapeHtml(pet.name)}
                    </div>

                    <div class="petValue">
                        ${formatValue(pet.value)}
                    </div>
                </div>

            </div>
        `;

    }).join("");
}

// We keep this centralized so you can replace the source later.
// It does NOT use your ADMFLIP logo as a pet image.
function getPetImage(name) {
    const encoded = encodeURIComponent(
        String(name).trim().replace(/\s+/g, "-")
    );

    // Adopt Me Wiki-style image endpoint.
    // If it fails, the image is simply hidden and the value remains.
    return `https://static.wikia.nocookie.net/adoptme/images/${encoded}.png`;
}

// =====================================================
// LEADERBOARD
// =====================================================

async function loadLeaderboard() {
    const container = $("leaderboardList");

    container.innerHTML = "Loading...";

    const data = await api("/leaderboard");

    if (!data.success) {
        container.innerHTML =
            `<div class="muted">Unable to load leaderboard.</div>`;
        return;
    }

    if (!data.users.length) {
        container.innerHTML =
            `<div class="muted">No wagers yet.</div>`;
        return;
    }

    container.innerHTML = data.users.map((user, index) => {

        return `
            <div class="leaderCard">

                <div class="rank">
                    ${index + 1}
                </div>

                <img
                    class="leaderAvatar"
                    src="${escapeAttr(user.avatar || "/roblox.png")}"
                    alt=""
                >

                <div class="leaderName">
                    ${escapeHtml(user.username)}
                </div>

                <div class="wagered">
                    ${formatValue(user.wagered)}
                </div>

            </div>
        `;

    }).join("");
}

// =====================================================
// INVENTORY
// =====================================================

async function loadInventory() {
    if (!state.token) {
        return;
    }

    const data = await api("/inventory");

    if (!data.success) {
        $("inventoryList").innerHTML =
            `<div class="muted">Unable to load inventory.</div>`;
        return;
    }

    state.user.inventory = data.inventory;

    localStorage.setItem(
        "admflipUser",
        JSON.stringify(state.user)
    );

    renderInventory(
        $("inventoryList"),
        data.inventory,
        false
    );
}

function renderInventory(container, inventory, selectable) {

    if (!inventory.length) {
        container.innerHTML = `
            <div class="muted">
                Your inventory is empty.
            </div>
        `;
        return;
    }

    container.innerHTML = inventory.map(pet => {

        const image = pet.image || getPetImage(pet.name);

        return `
            <div class="inventoryPet">

                ${
                    image
                    ? `
                        <img
                            class="petImage"
                            src="${escapeAttr(image)}"
                            onerror="this.style.display='none'"
                            alt=""
                        >
                    `
                    : ""
                }

                <div class="inventoryPetInfo">
                    <strong>${escapeHtml(pet.name)}</strong>

                    <div class="petValue">
                        ${formatValue(pet.value)}
                    </div>
                </div>

                ${
                    selectable
                    ? `
                        <button
                            class="selectPet"
                            data-pet="${escapeAttr(pet.id)}"
                        >
                            Select
                        </button>
                    `
                    : ""
                }

            </div>
        `;

    }).join("");

    if (selectable) {
        container.querySelectorAll(".selectPet")
            .forEach(button => {

                button.onclick = () => {
                    selectCreatePet(button.dataset.pet);
                };

            });
    }
}

// =====================================================
// CREATE COINFLIP
// =====================================================

$("createFlipBtn").onclick = async () => {

    if (!state.user || !state.token) {
        $("loginModal").classList.remove("hidden");
        return;
    }

    $("createModal").classList.remove("hidden");

    state.selectedPet = null;
    state.selectedSide = null;

    $("sideChooser").classList.add("hidden");
    $("confirmCreate").classList.add("hidden");

    const data = await api("/inventory");

    if (!data.success) {
        $("createInventory").innerHTML =
            `<div class="muted">Unable to load inventory.</div>`;
        return;
    }

    if (!data.inventory.length) {
        $("createInventory").innerHTML = `
            <div class="muted">
                You don't have any pets.
            </div>

            <button
                class="depositBtn"
                onclick="showDepositMessage()"
            >
                Deposit via Discord
            </button>
        `;

        return;
    }

    renderInventory(
        $("createInventory"),
        data.inventory,
        true
    );
};

function selectCreatePet(petId) {
    const pet = state.user.inventory.find(
        x => x.id === petId
    );

    if (!pet) return;

    state.selectedPet = pet;

    $("sideChooser").classList.remove("hidden");
}

document.querySelectorAll("#sideChooser button")
    .forEach(button => {

        button.onclick = () => {

            state.selectedSide =
                button.dataset.side;

            document.querySelectorAll(
                "#sideChooser button"
            ).forEach(x =>
                x.classList.remove("selected")
            );

            button.classList.add("selected");

            $("confirmCreate").classList.remove("hidden");
        };

    });

$("confirmCreate").onclick = async () => {

    if (!state.selectedPet || !state.selectedSide) {
        return;
    }

    $("confirmCreate").disabled = true;
    $("confirmCreate").textContent = "Creating...";

    const data = await api("/coinflips", {
        method: "POST",
        body: JSON.stringify({
            petId: state.selectedPet.id,
            side: state.selectedSide
        })
    });

    $("confirmCreate").disabled = false;
    $("confirmCreate").textContent = "Create Coinflip";

    if (!data.success) {
        showMessage(data.message || "Could not create coinflip");
        return;
    }

    $("createModal").classList.add("hidden");

    await restoreSession();
    await loadCoinflips();
};

async function loadCoinflips() {
    const container = $("coinflipList");

    container.innerHTML = "Loading...";

    const data = await api("/coinflips");

    if (!data.success) {
        container.innerHTML =
            `<div class="muted">Unable to load active coinflips.</div>`;
        return;
    }

    if (!data.coinflips.length) {
        container.innerHTML =
            `<div class="muted">No active coinflips yet.</div>`;
        return;
    }

    container.innerHTML = data.coinflips.map(flip => {

        const image =
            flip.petImage ||
            getPetImage(flip.petName);

        return `
            <div class="coinflipCard">

                ${
                    image
                    ? `
                        <img
                            class="petImage"
                            src="${escapeAttr(image)}"
                            onerror="this.style.display='none'"
                            alt=""
                        >
                    `
                    : ""
                }

                <div class="petInfo">

                    <div class="petName">
                        ${escapeHtml(flip.petName)}
                    </div>

                    <div class="petValue">
                        ${formatValue(flip.petValue)}
                    </div>

                    <div class="muted">
                        ${escapeHtml(flip.creatorUsername)}
                    </div>

                </div>

                <div class="sideBadge">
                    ${escapeHtml(flip.side.toUpperCase())}
                </div>

                ${
                    state.user &&
                    state.user.id !== flip.creatorId
                    ? `
                        <button
                            class="joinBtn"
                            data-join="${escapeAttr(flip._id)}"
                        >
                            Join
                        </button>
                    `
                    : ""
                }

            </div>
        `;

    }).join("");

    container.querySelectorAll("[data-join]")
        .forEach(button => {

            button.onclick = () => {
                joinCoinflip(button.dataset.join);
            };

        });
}

async function joinCoinflip(id) {

    if (!state.user || !state.token) {
        $("loginModal").classList.remove("hidden");
        return;
    }

    const data = await api(
        `/coinflips/${encodeURIComponent(id)}/join`,
        {
            method: "POST"
        }
    );

    if (!data.success) {
        showMessage(
            data.message ||
            "Could not join coinflip"
        );
        return;
    }

    // Temporary result until the visual animation is added.
    showMessage(
        data.winnerId === state.user.id
            ? "You won the coinflip!"
            : "You lost the coinflip."
    );

    await restoreSession();
    await loadCoinflips();
}

// =====================================================
// MODALS
// =====================================================

document.querySelectorAll("[data-close]")
    .forEach(button => {

        button.onclick = () => {
            const id = button.dataset.close;
            $(id).classList.add("hidden");
        };

    });

$("depositBtn").onclick = showDepositMessage;

function showDepositMessage() {
    showMessage(
        "Discord deposit is the temporary deposit option. Automatic deposits will be added later."
    );
}

// =====================================================
// UTILITIES
// =====================================================

function formatValue(value) {
    const number = Number(value) || 0;

    return number.toLocaleString();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function showMessage(message) {
    // Site-native message instead of browser alert / "vercel.app says".
    const box = document.createElement("div");

    box.style.position = "fixed";
    box.style.left = "50%";
    box.style.bottom = "25px";
    box.style.transform = "translateX(-50%)";
    box.style.zIndex = "5000";
    box.style.background = "#171020";
    box.style.border = "1px solid #3b2a4d";
    box.style.color = "white";
    box.style.padding = "13px 18px";
    box.style.borderRadius = "11px";
    box.style.boxShadow = "0 15px 50px rgba(0,0,0,.4)";
    box.textContent = message;

    document.body.appendChild(box);

    setTimeout(() => {
        box.remove();
    }, 3500);
}

// =====================================================
// INITIALIZE
// =====================================================

(async function init() {

    await restoreSession();

    await Promise.all([
        loadCoinflips(),
        loadValues(),
        loadLeaderboard(),
        loadChat(),
        refreshStatus()
    ]);

})();
