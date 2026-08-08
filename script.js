const BACKEND = "https://admflip-new.onrender.com";

const $ = id => document.getElementById(id);

let token = localStorage.getItem("admflipToken") || "";
let currentUser = JSON.parse(localStorage.getItem("admflipUser") || "null");

let pets = [];
let selectedPet = null;
let selectedSide = null;
let chatOpen = true;
let lastChatTime = "";
let chatTimer = null;


/* =========================
   API
========================= */

async function api(path, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(BACKEND + path, {
        ...options,
        headers
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        token = "";
        currentUser = null;

        localStorage.removeItem("admflipToken");
        localStorage.removeItem("admflipUser");

        updateAccountUI();

        throw new Error("AUTH");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}


/* =========================
   SESSION
========================= */

function saveSession(user, newToken) {

    currentUser = user;

    if (newToken) {
        token = newToken;
        localStorage.setItem("admflipToken", token);
    }

    localStorage.setItem(
        "admflipUser",
        JSON.stringify(currentUser)
    );

    updateAccountUI();
}


async function restoreSession() {

    if (!token) {
        updateAccountUI();
        return;
    }

    try {

        const data = await api("/auth/me");

        if (data.success) {
            saveSession(data.user, token);
            loadInventory();
        }

    } catch {

        token = "";
        currentUser = null;

        localStorage.removeItem("admflipToken");
        localStorage.removeItem("admflipUser");

        updateAccountUI();
    }
}


function updateAccountUI() {

    const login = $("loginBtn");
    const account = $("accountBtn");
    const logout = $("logoutBtn");

    if (!currentUser) {

        login.style.display = "flex";
        account.style.display = "none";
        logout.style.display = "none";

        $("chatInput").placeholder = "Sign in to chat...";

        return;
    }

    login.style.display = "none";
    account.style.display = "flex";
    logout.style.display = "block";

    $("accountAvatar").src =
        currentUser.avatar || "roblox.png";

    $("accountName").textContent =
        currentUser.username;

    $("chatInput").placeholder =
        "Send a message...";

}


/* =========================
   LOGIN
========================= */

$("loginBtn").onclick = () => {

    $("loginModal").classList.add("show");

    setTimeout(() => {
        $("username").focus();
    }, 100);
};


$("closeLogin").onclick = () => {
    $("loginModal").classList.remove("show");
};


$("username").addEventListener("change", verifyUsername);

$("username").addEventListener("keydown", e => {

    if (e.key === "Enter") {
        verifyUsername();
    }

});


async function verifyUsername() {

    const username =
        $("username").value.trim();

    if (!username) return;

    $("profile").innerHTML =
        `<div class="loading">Finding Roblox profile...</div>`;

    $("phrase").innerHTML = "";

    $("verify").style.display = "none";

    try {

        const data =
            await api(
                "/user/" + encodeURIComponent(username)
            );

        if (!data.success) {
            $("profile").innerHTML =
                `<div class="error">${data.message || "User not found"}</div>`;
            return;
        }

        $("profile").innerHTML = `

            <img src="${escapeAttr(data.user.avatar)}">

            <div>
                <b>${escapeHtml(data.user.username)}</b>
                <small>Roblox profile found</small>
            </div>

        `;

        const phraseData =
            await api("/create");

        $("phrase").innerHTML = `

            <span>Put this phrase in your Roblox bio:</span>

            <strong>
                ${escapeHtml(phraseData.phrase)}
            </strong>

        `;

        $("verify").style.display = "block";

        $("verify").onclick = () =>
            finishVerification(
                data.user.username,
                phraseData.phrase
            );

    } catch (error) {

        $("profile").innerHTML =
            `<div class="error">Could not connect to the server.</div>`;

    }
}


async function finishVerification(username, phrase) {

    const button = $("verify");

    button.disabled = true;
    button.textContent = "Checking...";

    try {

        const response = await fetch(
            BACKEND + "/check",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    phrase
                })
            }
        );

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(
                data.message || "Verification failed"
            );
        }

        saveSession(
            data.user,
            data.token
        );

        $("loginModal").classList.remove("show");

        $("username").value = "";
        $("profile").innerHTML = "";
        $("phrase").innerHTML = "";
        button.style.display = "none";

        loadInventory();
        loadCoinflips();
        loadChat();

    } catch (error) {

        alert(error.message || "Verification failed");

        button.disabled = false;
        button.textContent = "Verify";
    }
}


/* =========================
   LOGOUT
========================= */

$("logoutBtn").onclick = () => {

    token = "";
    currentUser = null;

    localStorage.removeItem("admflipToken");
    localStorage.removeItem("admflipUser");

    updateAccountUI();

    showPage("home");
};


/* =========================
   NAVIGATION
========================= */

function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    const target =
        $("page-" + page);

    if (target) {
        target.classList.add("active");
    }

    history.replaceState(
        null,
        "",
        "#/" + page
    );

    if (page === "values") {
        loadValues();
    }

    if (page === "coinflip") {
        loadCoinflips();
    }

    if (page === "leaderboard") {
        loadLeaderboard();
    }

    if (page === "profile") {
        loadInventory();
    }
}


document.addEventListener("click", e => {

    const button =
        e.target.closest("[data-page]");

    if (!button) return;

    e.preventDefault();

    showPage(button.dataset.page);

});


function loadPageFromHash() {

    let page =
        location.hash.replace("#/", "");

    if (
        ![
            "home",
            "coinflip",
            "leaderboard",
            "values",
            "profile"
        ].includes(page)
    ) {
        page = "home";
    }

    showPage(page);
}


window.addEventListener(
    "hashchange",
    loadPageFromHash
);


/* =========================
   CHAT
========================= */

function openChat() {

    chatOpen = true;

    $("chatPanel").classList.add("open");
    document.body.classList.add("chat-open");

    loadChat();
}


function closeChat() {

    chatOpen = false;

    $("chatPanel").classList.remove("open");
    document.body.classList.remove("chat-open");
}


$("chatNav").onclick = () => {

    if (window.innerWidth <= 800) {

        if (chatOpen) closeChat();
        else openChat();

    } else {

        openChat();

    }
};


$("mobileChatButton").onclick = () => {

    if (chatOpen) closeChat();
    else openChat();

};


$("mobileCloseChat").onclick = closeChat;


$("rulesButton").onclick = () => {
    $("rulesModal").classList.add("show");
};


$("closeRules").onclick = () => {
    $("rulesModal").classList.remove("show");
};


async function loadChat() {

    try {

        const data =
            await api(
                "/chat/messages" +
                (
                    lastChatTime
                        ? "?since=" +
                          encodeURIComponent(lastChatTime)
                        : ""
                )
            );

        $("onlineCount").textContent =
            data.onlineCount;

        if (data.messages?.length) {

            for (const message of data.messages) {

                appendChatMessage(message);

                lastChatTime =
                    message.createdAt;
            }

        }

    } catch (error) {

        if (error.message === "AUTH") {
            $("chatInput").placeholder =
                "Sign in to chat...";
        }

    }
}


function appendChatMessage(message) {

    if (
        document.querySelector(
            `[data-message-id="${message._id}"]`
        )
    ) return;

    const div =
        document.createElement("div");

    div.className = "chat-message";
    div.dataset.messageId =
        message._id;

    div.innerHTML = `

        <img
            class="chat-avatar"
            src="${escapeAttr(message.avatar || "roblox.png")}"
            alt=""
        >

        <div class="chat-content">

            <button
                class="chat-username"
                data-user-id="${message.userId}"
            >
                ${escapeHtml(message.username)}
            </button>

            <div class="chat-text">
                ${escapeHtml(message.message)}
            </div>

        </div>

    `;

    div
        .querySelector(".chat-username")
        .onclick = () =>
            openUserProfile(message.userId);

    $("chatMessages").appendChild(div);

    $("chatMessages").scrollTop =
        $("chatMessages").scrollHeight;
}


$("sendChat").onclick = sendChat;


$("chatInput").addEventListener(
    "keydown",
    e => {

        if (e.key === "Enter") {
            e.preventDefault();
            sendChat();
        }

    }
);


async function sendChat() {

    if (!currentUser || !token) {

        $("loginModal").classList.add("show");

        return;
    }

    const input =
        $("chatInput");

    const message =
        input.value.trim();

    if (!message) return;

    try {

        const data =
            await api(
                "/chat/messages",
                {
                    method: "POST",
                    body: JSON.stringify({
                        message
                    })
                }
            );

        input.value = "";

        appendChatMessage(
            data.message
        );

        lastChatTime =
            data.message.createdAt;

    } catch (error) {

        if (error.message === "AUTH") {

            $("loginModal")
                .classList.add("show");

        } else {

            alert(error.message);

        }

    }
}


/* =========================
   USER PROFILE
========================= */

async function openUserProfile(id) {

    try {

        const data =
            await api(
                "/profile/" + id
            );

        if (!data.success) return;

        $("userModalAvatar").src =
            data.user.avatar || "roblox.png";

        $("userModalName").textContent =
            data.user.username;

        $("userWagered").textContent =
            formatValue(data.user.wagered);

        $("userProfit").textContent =
            formatValue(data.user.profit);

        $("userModal").classList.add("show");

    } catch {}
}


$("closeUser").onclick = () => {
    $("userModal").classList.remove("show");
};


/* =========================
   VALUES
========================= */

async function loadValues() {

    try {

        const data =
            await api("/pets");

        pets = data.pets || [];

        renderValues(
            $("petSearch").value
        );

    } catch {

        $("valuesList").innerHTML =
            `<div class="empty">
                Pet values unavailable.
             </div>`;

    }
}


function renderValues(search = "") {

    const query =
        search.trim().toLowerCase();

    const filtered =
        pets.filter(p =>
            !query ||
            p.name.toLowerCase().includes(query)
        );

    if (!filtered.length) {

        $("valuesList").innerHTML =
            `<div class="empty">No pets found.</div>`;

        return;
    }

    $("valuesList").innerHTML =
        filtered.map(petCard).join("");

    attachImageFallbacks(
        $("valuesList")
    );
}


$("petSearch").addEventListener(
    "input",
    e => renderValues(e.target.value)
);


function petCard(pet, extraClass = "") {

    return `

        <div class="pet-card ${extraClass}">

            <div class="pet-image-wrap">

                <img
                    src="${escapeAttr(pet.image || petImage(pet.name))}"
                    alt="${escapeAttr(pet.name)}"
                    class="pet-image"
                    loading="lazy"
                >

            </div>

            <div class="pet-info">

                <strong>
                    ${escapeHtml(pet.name)}
                </strong>

                <span>
                    ${formatValue(pet.value)}
                </span>

            </div>

        </div>

    `;
}


function petImage(name) {

    return (
        "https://amvgg.com/items/" +
        encodeURIComponent(name) +
        ".webp"
    );
}


function attachImageFallbacks(container) {

    container
        .querySelectorAll("img.pet-image")
        .forEach(img => {

            img.onerror = () => {

                img.style.display = "none";

            };

        });

}


/* =========================
   INVENTORY
========================= */

async function loadInventory() {

    if (!currentUser || !token) {

        $("inventoryList").innerHTML =
            `<div class="empty">
                Sign in to view your inventory.
             </div>`;

        return;
    }

    try {

        const data =
            await api("/inventory");

        renderInventory(
            data.inventory || []
        );

    } catch {

        $("inventoryList").innerHTML =
            `<div class="empty">
                Unable to load inventory.
             </div>`;

    }
}


function renderInventory(inventory) {

    if (!inventory.length) {

        $("inventoryList").innerHTML =
            `<div class="empty">
                Your inventory is empty.
             </div>`;

        return;
    }

    $("inventoryList").innerHTML =
        inventory.map(pet => {

            const p =
                pets.find(
                    x =>
                        x.name.toLowerCase() ===
                        pet.name.toLowerCase()
                );

            return petCard({
                name: pet.name,
                value: pet.value || p?.value || 0,
                image: petImage(pet.name)
            });

        }).join("");

    attachImageFallbacks(
        $("inventoryList")
    );
}


/* =========================
   COINFLIP
========================= */

$("createCoinflipBtn").onclick = async () => {

    if (!currentUser || !token) {

        $("loginModal").classList.add("show");

        return;
    }

    $("coinflipModal").classList.add("show");

    selectedPet = null;
    selectedSide = null;

    $("sideChooser").style.display = "none";
    $("postCoinflip").disabled = true;

    await loadCreateInventory();
};


$("closeCoinflip").onclick = () => {
    $("coinflipModal").classList.remove("show");
};


async function loadCreateInventory() {

    const box =
        $("createInventory");

    box.innerHTML =
        `<div class="loading">Loading inventory...</div>`;

    try {

        const data =
            await api("/inventory");

        if (!data.inventory.length) {

            box.innerHTML =
                `<div class="empty">
                    No pets available.
                    <button class="deposit-inline">
                        Deposit via Discord
                    </button>
                 </div>`;

            return;
        }

        box.innerHTML =
            data.inventory.map((pet, index) => {

                const p =
                    pets.find(
                        x =>
                            x.name.toLowerCase() ===
                            pet.name.toLowerCase()
                    );

                return `

                    <button
                        class="select-pet"
                        data-index="${index}"
                    >

                        <div class="pet-image-wrap">

                            <img
                                class="pet-image"
                                src="${escapeAttr(
                                    petImage(pet.name)
                                )}"
                                alt=""
                            >

                        </div>

                        <strong>
                            ${escapeHtml(pet.name)}
                        </strong>

                        <span>
                            ${formatValue(
                                pet.value ||
                                p?.value ||
                                0
                            )}
                        </span>

                    </button>

                `;

            }).join("");

        attachImageFallbacks(box);

        box.querySelectorAll(
            ".select-pet"
        ).forEach(button => {

            button.onclick = () => {

                box
                    .querySelectorAll(".select-pet")
                    .forEach(x =>
                        x.classList.remove("selected")
                    );

                button.classList.add("selected");

                selectedPet =
                    data.inventory[
                        Number(button.dataset.index)
                    ];

                $("sideChooser").style.display =
                    "block";

                updatePostButton();

            };

        });

    } catch {

        box.innerHTML =
            `<div class="error">
                Unable to load inventory.
             </div>`;

    }
}


document
    .querySelectorAll(".side-btn")
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(".side-btn")
                .forEach(x =>
                    x.classList.remove("selected")
                );

            button.classList.add("selected");

            selectedSide =
                button.dataset.side;

            updatePostButton();
        };

    });


function updatePostButton() {

    $("postCoinflip").disabled =
        !(selectedPet && selectedSide);

}


$("postCoinflip").onclick =
    async () => {

        if (!selectedPet || !selectedSide)
            return;

        const button =
            $("postCoinflip");

        button.disabled = true;
        button.textContent = "Posting...";

        try {

            await api(
                "/coinflips",
                {
                    method: "POST",
                    body: JSON.stringify({
                        petName: selectedPet.name,
                        side: selectedSide
                    })
                }
            );

            $("coinflipModal")
                .classList.remove("show");

            loadCoinflips();
            loadInventory();

        } catch (error) {

            alert(error.message);

            button.disabled = false;
            button.textContent =
                "Post Coinflip";
        }

    };


async function loadCoinflips() {

    try {

        const data =
            await api("/coinflips");

        const list =
            data.coinflips || [];

        if (!list.length) {

            $("coinflipList").innerHTML =
                `<div class="empty">
                    No active coinflips yet.
                 </div>`;

            return;
        }

        $("coinflipList").innerHTML =
            list.map(renderCoinflip).join("");

        $("coinflipList")
            .querySelectorAll(".join-cf")
            .forEach(button => {

                button.onclick =
                    () =>
                        joinCoinflip(
                            button.dataset.id
                        );

            });

    } catch {

        $("coinflipList").innerHTML =
            `<div class="empty">
                Unable to load active coinflips.
             </div>`;

    }
}


function renderCoinflip(cf) {

    const creator =
        cf.creatorPet;

    const joiner =
        cf.joinerPet;

    return `

        <article class="coinflip-card">

            <div class="cf-users">

                <button
                    class="cf-user"
                    onclick="openUserProfile('${cf.creatorId}')"
                >
                    <img src="${escapeAttr(
                        cf.creatorAvatar || "roblox.png"
                    )}">
                    <span>
                        ${escapeHtml(
                            cf.creatorUsername
                        )}
                    </span>
                </button>

                <div class="cf-vs">
                    VS
                </div>

                <div class="cf-user">

                    ${
                        joiner
                        ? `
                            <img src="${escapeAttr(
                                cf.joinerAvatar || "roblox.png"
                            )}">
                            <span>
                                ${escapeHtml(
                                    cf.joinerUsername
                                )}
                            </span>
                          `
                        : `
                            <span class="waiting">
                                WAITING
                            </span>
                          `
                    }

                </div>

            </div>


            <div class="cf-pets">

                <div class="cf-pet">

                    <img
                        src="${escapeAttr(
                            petImage(creator.name)
                        )}"
                        class="pet-image"
                        onerror="this.style.display='none'"
                    >

                    <strong>
                        ${escapeHtml(creator.name)}
                    </strong>

                    <span>
                        ${formatValue(creator.value)}
                    </span>

                    <small>
                        ${creator.variant || ""}
                    </small>

                </div>


                <div class="coin">

                    <span>H</span>
                    <span>T</span>

                </div>


                <div class="cf-pet">

                    ${
                        joiner
                        ? `
                            <img
                                src="${escapeAttr(
                                    petImage(joiner.name)
                                )}"
                                class="pet-image"
                                onerror="this.style.display='none'"
                            >

                            <strong>
                                ${escapeHtml(
                                    joiner.name
                                )}
                            </strong>

                            <span>
                                ${formatValue(
                                    joiner.value
                                )}
                            </span>
                          `
                        : `
                            <div class="empty-pet">
                                ?
                            </div>
                          `
                    }

                </div>

            </div>


            <div class="cf-bottom">

                <span class="cf-side">
                    ${String(cf.creatorSide).toUpperCase()}
                </span>

                ${
                    currentUser &&
                    currentUser.id !== cf.creatorId
                    ?
                    `
                    <button
                        class="primary join-cf"
                        data-id="${cf._id}"
                    >
                        Join
                    </button>
                    `
                    :
                    `
                    <span class="active-label">
                        ACTIVE
                    </span>
                    `
                }

            </div>

        </article>

    `;
}


async function joinCoinflip(id) {

    if (!currentUser || !token) {

        $("loginModal").classList.add("show");

        return;
    }

    try {

        const data =
            await api(
                "/inventory"
            );

        if (!data.inventory.length) {

            alert(
                "You need a pet in your inventory to join."
            );

            return;
        }

        const names =
            data.inventory
                .map(p => p.name)
                .join(", ");

        const chosen =
            prompt(
                "Enter the exact pet name you want to use:\n\n" +
                names
            );

        if (!chosen) return;

        await api(
            "/coinflips/" +
            id +
            "/join",
            {
                method: "POST",
                body: JSON.stringify({
                    petName: chosen
                })
            }
        );

        await loadCoinflips();
        await loadInventory();

        alert(
            "Coinflip finished."
        );

    } catch (error) {

        alert(error.message);

    }
}


/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard() {

    try {

        const data =
            await api("/leaderboard");

        const users =
            data.users || [];

        $("leaderboardList").innerHTML =
            users.map((user, index) => `

                <div class="leader-row">

                    <div class="place">
                        ${index + 1}
                    </div>

                    <img
                        src="${escapeAttr(
                            user.avatar || "roblox.png"
                        )}"
                    >

                    <div class="leader-name">
                        <strong>
                            ${escapeHtml(user.username)}
                        </strong>

                        <span>
                            ${formatValue(
                                user.wagered
                            )} wagered
                        </span>
                    </div>

                    <div class="leader-profit">
                        ${formatValue(
                            user.profit
                        )}
                    </div>

                </div>

            `).join("");

        if (!users.length) {

            $("leaderboardList").innerHTML =
                `<div class="empty">
                    No wagers yet.
                 </div>`;
        }

    } catch {

        $("leaderboardList").innerHTML =
            `<div class="empty">
                Unable to load leaderboard.
             </div>`;
    }
}


/* =========================
   HELPERS
========================= */

function formatValue(value) {

    return Number(
        value || 0
    ).toLocaleString();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttr(value) {

    return escapeHtml(value);
}


/* =========================
   STARTUP
========================= */

async function start() {

    updateAccountUI();

    await restoreSession();

    loadPageFromHash();

    loadValues();

    loadChat();

    chatTimer =
        setInterval(
            loadChat,
            10000
        );

    window.addEventListener(
        "resize",
        () => {

            if (window.innerWidth > 800) {
                openChat();
            }

        }
    );

    if (window.innerWidth > 800) {
        openChat();
    }

}

start();
