const BACKEND = "https://admflip-new.onrender.com";

let currentUser = null;
let authToken = null;
let phrase = "";
let selectedPet = null;
let selectedSide = null;

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(BACKEND + path, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}


/* =========================
   AUTH
========================= */

function saveSession() {

    localStorage.setItem(
        "admflipSession",
        JSON.stringify({
            token: authToken,
            user: currentUser
        })
    );
}

function loadSession() {

    try {

        const saved =
            localStorage.getItem("admflipSession");

        if (!saved) return;

        const session = JSON.parse(saved);

        authToken = session.token || null;
        currentUser = session.user || null;

        if (currentUser) {
            showLoggedIn();
        }

    } catch {
        localStorage.removeItem("admflipSession");
    }
}

function clearSession() {

    localStorage.removeItem("admflipSession");

    authToken = null;
    currentUser = null;

    $("logoutBtn").style.display = "none";

    $("loginBtn").style.display = "flex";

    $("chatLoginRequired").style.display = "block";
}


function showLoggedIn() {

    $("logoutBtn").style.display = "block";
    $("loginBtn").style.display = "none";

    $("chatLoginRequired").style.display = "none";

    loadChat();
}


$("loginBtn").onclick = () => {

    $("loginModal").classList.add("show");

};


$("closeLogin").onclick = () => {

    $("loginModal").classList.remove("show");

};


$("logoutBtn").onclick = () => {

    clearSession();

};


$("username").onchange = async () => {

    const username =
        $("username").value.trim();

    if (!username) return;

    $("loginMessage").textContent =
        "Looking up Roblox profile...";

    try {

        const data =
            await api(
                "/user/" +
                encodeURIComponent(username)
            );

        if (!data.success) {

            $("loginMessage").textContent =
                "Roblox username not found.";

            return;
        }

        currentUser = data.user;

        $("profile").classList.remove("hidden");

        $("profile").innerHTML = `
            <div class="login-profile">
                <img src="${escapeHTML(currentUser.avatar)}">
                <div>
                    <strong>
                        ${escapeHTML(currentUser.username)}
                    </strong>
                    <small>
                        Roblox ID: ${currentUser.id}
                    </small>
                </div>
            </div>
        `;

        const phraseData =
            await api("/create");

        phrase = phraseData.phrase;

        $("phrase").classList.remove("hidden");

        $("phrase").innerHTML = `
            <div class="phrase-card">
                <span>Put this phrase in your Roblox bio:</span>
                <strong>${escapeHTML(phrase)}</strong>
            </div>
        `;

        $("verify").style.display = "block";

        $("loginMessage").textContent = "";

    } catch (error) {

        $("loginMessage").textContent =
            error.message || "Server error.";

    }

};


$("verify").onclick = async () => {

    $("verify").disabled = true;

    $("verify").textContent = "Checking...";

    try {

        const data =
            await api("/check", {
                method: "POST",
                body: JSON.stringify({
                    username: currentUser.username,
                    phrase
                })
            });

        if (!data.success) {

            throw new Error(
                data.message ||
                "Verification phrase not found."
            );

        }

        currentUser = data.user;
        authToken = data.token;

        saveSession();

        $("loginModal").classList.remove("show");

        showLoggedIn();

        await loadChat();

    } catch (error) {

        $("loginMessage").textContent =
            error.message;

    } finally {

        $("verify").disabled = false;
        $("verify").textContent = "Verify";

    }

};


/* =========================
   PAGES
========================= */

function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(el => el.classList.add("hidden"));

    const target =
        $(page + "Page");

    if (target) {
        target.classList.remove("hidden");
    }

    localStorage.setItem(
        "admflipPage",
        page
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
}


document
    .querySelectorAll("[data-page]")
    .forEach(button => {

        button.onclick = () => {

            showPage(
                button.dataset.page
            );

        };

    });


/* =========================
   VALUES
========================= */

let allPets = [];

async function loadValues() {

    const grid = $("valuesGrid");

    grid.innerHTML =
        `<div class="loading">Loading values...</div>`;

    try {

        const data =
            await api("/pets");

        allPets = data.pets || [];

        renderValues(allPets);

    } catch {

        grid.innerHTML =
            `<div class="empty">
                Unable to load pet values.
             </div>`;

    }

}


function renderValues(pets) {

    const grid = $("valuesGrid");

    if (!pets.length) {

        grid.innerHTML =
            `<div class="empty">
                No pets found.
             </div>`;

        return;
    }

    grid.innerHTML =
        pets.map(pet => {

            const image =
                pet.image
                ? `
                    <img
                        src="${escapeHTML(pet.image)}"
                        alt="${escapeHTML(pet.name)}"
                        loading="lazy"
                        onerror="this.parentElement.classList.add('no-image');this.remove()"
                    >
                  `
                : "";

            return `
                <article class="pet-card">

                    <div class="pet-image ${image ? "" : "no-image"}">
                        ${image}
                        <span>
                            ${escapeHTML(pet.name)}
                        </span>
                    </div>

                    <div class="pet-info">

                        <strong>
                            ${escapeHTML(pet.name)}
                        </strong>

                        <span class="pet-value">
                            ${Number(pet.value || 0).toLocaleString()}
                        </span>

                        <div class="badges">

                            ${
                                pet.rarity
                                ? `<small>${escapeHTML(pet.rarity)}</small>`
                                : ""
                            }

                            ${
                                pet.neon
                                ? `<small>NEON</small>`
                                : ""
                            }

                            ${
                                pet.mega
                                ? `<small>MEGA</small>`
                                : ""
                            }

                            ${
                                pet.fly
                                ? `<small>FLY</small>`
                                : ""
                            }

                            ${
                                pet.ride
                                ? `<small>RIDE</small>`
                                : ""
                            }

                        </div>

                    </div>

                </article>
            `;

        }).join("");

}


$("valueSearch").oninput = () => {

    const query =
        $("valueSearch")
            .value
            .trim()
            .toLowerCase();

    renderValues(
        allPets.filter(pet =>
            pet.name
                .toLowerCase()
                .includes(query)
        )
    );

};


/* =========================
   INVENTORY
========================= */

async function openCreateFlip() {

    if (!currentUser || !authToken) {

        $("loginModal").classList.add("show");

        $("loginMessage").textContent =
            "Please sign in first.";

        return;
    }

    $("flipModal").classList.add("show");

    $("createInventory").innerHTML =
        `<div class="loading">
            Loading inventory...
         </div>`;

    $("sideChooser")
        .classList.add("hidden");

    selectedPet = null;
    selectedSide = null;

    try {

        const data =
            await api("/inventory");

        const inventory =
            data.inventory || [];

        if (!inventory.length) {

            $("createInventory").innerHTML =
                `<div class="deposit-prompt">
                    <p>Your inventory is empty.</p>
                    <button class="primary">
                        Deposit
                    </button>
                    <small>
                        Deposit via Discord — automatic bot coming soon.
                    </small>
                 </div>`;

            return;
        }

        $("createInventory").innerHTML =
            inventory.map((pet, index) => {

                const image =
                    pet.image
                    ? `
                        <img
                            src="${escapeHTML(pet.image)}"
                            onerror="this.remove()"
                        >
                      `
                    : "";

                return `
                    <button
                        class="inventory-pet"
                        data-index="${index}"
                    >

                        <div class="inventory-image">
                            ${image}
                        </div>

                        <div>
                            <strong>
                                ${escapeHTML(pet.name)}
                            </strong>

                            <span>
                                ${Number(pet.value || 0).toLocaleString()}
                            </span>
                        </div>

                    </button>
                `;

            }).join("");

        document
            .querySelectorAll(".inventory-pet")
            .forEach(button => {

                button.onclick = () => {

                    document
                        .querySelectorAll(".inventory-pet")
                        .forEach(x =>
                            x.classList.remove("selected")
                        );

                    button.classList.add("selected");

                    selectedPet =
                        inventory[
                            Number(button.dataset.index)
                        ];

                    $("sideChooser")
                        .classList.remove("hidden");

                };

            });

    } catch (error) {

        $("createInventory").innerHTML =
            `<div class="empty">
                ${escapeHTML(error.message)}
             </div>`;

    }

}


$("createFlipBtn").onclick =
    openCreateFlip;


$("closeFlip").onclick = () => {

    $("flipModal").classList.remove("show");

};


document
    .querySelectorAll(".side-buttons button")
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(".side-buttons button")
                .forEach(x =>
                    x.classList.remove("selected")
                );

            button.classList.add("selected");

            selectedSide =
                button.dataset.side;

        };

    });


$("postFlip").onclick = async () => {

    if (!selectedPet || !selectedSide) {

        return;

    }

    $("postFlip").disabled = true;

    try {

        await api("/coinflips", {
            method: "POST",
            body: JSON.stringify({
                pet: selectedPet,
                side: selectedSide
            })
        });

        $("flipModal")
            .classList.remove("show");

        await loadCoinflips();

    } catch (error) {

        alert(error.message);

    } finally {

        $("postFlip").disabled = false;

    }

};


/* =========================
   COINFLIPS
========================= */

async function loadCoinflips() {

    const list =
        $("coinflipList");

    try {

        const data =
            await api("/coinflips");

        const flips =
            data.coinflips || [];

        if (!flips.length) {

            list.innerHTML =
                `<div class="empty">
                    No active coinflips yet.
                 </div>`;

            return;
        }

        list.innerHTML =
            flips.map(flip => {

                const pet =
                    flip.pet;

                const image =
                    pet.image
                    ? `
                        <img
                            src="${escapeHTML(pet.image)}"
                            onerror="this.remove()"
                        >
                      `
                    : "";

                const mine =
                    currentUser &&
                    String(flip.ownerId) ===
                    String(currentUser.id);

                return `
                    <article class="flip-card">

                        <div class="flip-pet">
                            <div class="flip-image">
                                ${image}
                            </div>

                            <div>
                                <strong>
                                    ${escapeHTML(pet.name)}
                                </strong>

                                <span>
                                    ${Number(pet.value || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div class="flip-side">
                            <span>Side</span>
                            <strong>
                                ${flip.side.toUpperCase()}
                            </strong>
                        </div>

                        <div class="flip-owner">
                            <img
                                src="${escapeHTML(flip.ownerAvatar)}"
                                alt=""
                            >
                            <span>
                                ${escapeHTML(flip.ownerUsername)}
                            </span>
                        </div>

                        ${
                            mine
                            ? `
                                <button
                                    class="eye"
                                    data-id="${flip._id}"
                                >
                                    ◉
                                </button>
                              `
                            : `
                                <button
                                    class="primary join-flip"
                                    data-id="${flip._id}"
                                >
                                    Join
                                </button>
                              `
                        }

                    </article>
                `;

            }).join("");

        document
            .querySelectorAll(".join-flip")
            .forEach(button => {

                button.onclick = async () => {

                    if (!currentUser) {

                        $("loginModal")
                            .classList.add("show");

                        return;
                    }

                    try {

                        await api(
                            "/coinflips/" +
                            button.dataset.id +
                            "/join",
                            {
                                method: "POST"
                            }
                        );

                        await loadCoinflips();

                    } catch (error) {

                        alert(error.message);

                    }

                };

            });

    } catch {

        list.innerHTML =
            `<div class="empty">
                Unable to load coinflips.
             </div>`;

    }

}


/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard() {

    const box =
        $("leaderboard");

    box.innerHTML =
        `<div class="loading">
            Loading...
         </div>`;

    try {

        const data =
            await api("/leaderboard");

        const users =
            data.users || [];

        box.innerHTML =
            users.map((user, index) => {

                return `
                    <div class="leader-row">

                        <div class="rank">
                            ${index + 1}
                        </div>

                        <img
                            src="${escapeHTML(user.avatar)}"
                            alt=""
                        >

                        <div class="leader-name">
                            <strong>
                                ${escapeHTML(user.username)}
                            </strong>

                            <span>
                                ${Number(user.wagered || 0).toLocaleString()}
                                wagered
                            </span>
                        </div>

                    </div>
                `;

            }).join("");

    } catch {

        box.innerHTML =
            `<div class="empty">
                Unable to load leaderboard.
             </div>`;

    }

}


/* =========================
   CHAT
========================= */

async function loadChat() {

    if (!authToken) return;

    try {

        const data =
            await api("/chat/messages");

        renderChat(data.messages || []);

    } catch {

        $("chatMessages").innerHTML =
            `<div class="chat-empty">
                Unable to load chat.
             </div>`;

    }

}


function renderChat(messages) {

    $("chatMessages").innerHTML =
        messages.map(message => {

            return `
                <div class="chat-message">

                    <img
                        src="${escapeHTML(message.avatar)}"
                        alt=""
                    >

                    <div>

                        <div class="chat-user">
                            ${escapeHTML(message.username)}
                        </div>

                        <p>
                            ${escapeHTML(message.message)}
                        </p>

                    </div>

                </div>
            `;

        }).join("");

    const box =
        $("chatMessages");

    box.scrollTop =
        box.scrollHeight;

}


$("sendChat").onclick =
    sendChat;


$("chatInput").onkeydown = event => {

    if (event.key === "Enter") {
        sendChat();
    }

};


async function sendChat() {

    if (!currentUser || !authToken) {

        $("loginModal").classList.add("show");

        return;
    }

    const input =
        $("chatInput");

    const message =
        input.value.trim();

    if (!message) return;

    input.value = "";

    try {

        await api("/chat/messages", {
            method: "POST",
            body: JSON.stringify({
                message
            })
        });

        await loadChat();

    } catch (error) {

        input.value = message;

        alert(error.message);

    }

}


/* =========================
   CHAT OPEN / CLOSE
========================= */

$("chatTop").onclick = () => {

    $("chatPanel").classList.toggle("open");

};


$("chatClose").onclick = () => {

    $("chatPanel").classList.remove("open");

};


$("mobileChatButton").onclick = () => {

    $("chatPanel").classList.toggle("open");

};


/* =========================
   RULES
========================= */

$("rulesBtn").onclick = () => {

    $("rulesModal").classList.add("show");

};


$("closeRules").onclick = () => {

    $("rulesModal").classList.remove("show");

};


/* =========================
   ONLINE NUMBER
========================= */

function updateOnline() {

    const number =
        Math.floor(
            20 + Math.random() * 26
        );

    $("onlineCount").textContent =
        number;

}

updateOnline();

setInterval(
    updateOnline,
    100000
);


/* =========================
   MODAL OUTSIDE CLICK
========================= */

document
    .querySelectorAll(".modal")
    .forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (event.target === modal) {
                    modal.classList.remove("show");
                }

            }
        );

    });


/* =========================
   RESTORE PAGE
========================= */

loadSession();

const savedPage =
    localStorage.getItem("admflipPage") ||
    "coinflip";

showPage(savedPage);

if (window.innerWidth >= 900) {
    $("chatPanel").classList.add("open");
}
