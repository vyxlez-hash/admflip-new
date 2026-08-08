const BACKEND = "https://admflip-new.onrender.com";

// ============================================================
// STATE
// ============================================================

let currentUser = null;
let phrase = "";

let pets = [];
let inventory = [];

let currentSection =
    localStorage.getItem("admflipSection") || "home";

let chatOpen =
    localStorage.getItem("admflipChatOpen") === "true";

let onlineCount =
    Number(localStorage.getItem("admflipOnline") || 42);

let selectedPet = null;

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

    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString();
}

function containsLink(text) {

    return /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|bit\.ly\/)/i
        .test(text);
}

// ============================================================
// START
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    loadSavedUser();

    setupExistingNavigation();

    setupLogin();

    setupChat();

    setupValues();

    setupCoinflip();

    restorePage();

    await loadPets();

    await loadStatus();

    if (currentUser) {
        await loadInventory();
    }

    updateOnline();

    startOnlineCounter();

});

// ============================================================
// LOGIN
// ============================================================

function loadSavedUser() {

    try {

        const saved =
            localStorage.getItem("admflipUser");

        if (!saved) {
            return;
        }

        const user =
            JSON.parse(saved);

        if (
            !user ||
            (!user.id && !user.robloxId) ||
            !user.username
        ) {

            localStorage.removeItem(
                "admflipUser"
            );

            return;
        }

        currentUser = user;

        updateAccount();

    } catch (error) {

        console.error(
            "Saved login error:",
            error
        );

        localStorage.removeItem(
            "admflipUser"
        );
    }
}

function updateAccount() {

    const loginBtn =
        $("loginBtn");

    const logoutBtn =
        $("logoutBtn");

    if (!loginBtn) {
        return;
    }

    if (currentUser) {

        loginBtn.innerHTML = `
            <img
                src="${escapeHTML(
                    currentUser.avatar || "roblox.png"
                )}"
                onerror="this.src='roblox.png'"
            >

            <span>
                ${escapeHTML(
                    currentUser.username
                )}
            </span>
        `;

        loginBtn.classList.add("logged");

        if (logoutBtn) {
            logoutBtn.style.display =
                "block";
        }

    } else {

        loginBtn.innerHTML = `
            <img src="roblox.png">

            <span>
                Sign In
            </span>
        `;

        loginBtn.classList.remove(
            "logged"
        );

        if (logoutBtn) {
            logoutBtn.style.display =
                "none";
        }
    }
}

function setupLogin() {

    const loginBtn =
        $("loginBtn");

    const logoutBtn =
        $("logoutBtn");

    const modal =
        $("modal");

    if (loginBtn) {

        loginBtn.onclick = () => {

            if (!currentUser && modal) {
                modal.classList.add(
                    "show"
                );
            }
        };
    }

    if (logoutBtn) {

        logoutBtn.onclick = () => {

            currentUser = null;

            inventory = [];

            localStorage.removeItem(
                "admflipUser"
            );

            updateAccount();
        };
    }

    setupRobloxVerification();
}

function setupRobloxVerification() {

    const usernameInput =
        $("username");

    const profile =
        $("profile");

    const phraseText =
        $("phrase");

    const verifyBtn =
        $("verify");

    if (
        !usernameInput ||
        !profile ||
        !phraseText ||
        !verifyBtn
    ) {
        return;
    }

    usernameInput.onchange =
        async () => {

            const username =
                usernameInput.value.trim();

            if (!username) {
                return;
            }

            try {

                const response =
                    await fetch(
                        `${BACKEND}/user/${encodeURIComponent(username)}`
                    );

                const data =
                    await response.json();

                if (!data.success) {

                    alert(
                        data.message ||
                        "Roblox username not found"
                    );

                    return;
                }

                currentUser =
                    data.user;

                profile.classList.remove(
                    "hidden"
                );

                profile.innerHTML = `
                    <img
                        width="80"
                        src="${escapeHTML(
                            currentUser.avatar
                        )}"
                        onerror="this.src='roblox.png'"
                    >

                    <br><br>

                    <b>
                        ${escapeHTML(
                            currentUser.username
                        )}
                    </b>
                `;

                const phraseResponse =
                    await fetch(
                        `${BACKEND}/create`
                    );

                const phraseData =
                    await phraseResponse.json();

                phrase =
                    phraseData.phrase;

                phraseText.classList.remove(
                    "hidden"
                );

                phraseText.innerHTML = `
                    Put this phrase in your
                    Roblox bio:

                    <br><br>

                    <b>
                        ${escapeHTML(phrase)}
                    </b>
                `;

                verifyBtn.style.display =
                    "block";

            } catch (error) {

                console.error(error);

                alert(
                    "Login server error."
                );
            }
        };

    verifyBtn.onclick =
        async () => {

            if (
                !currentUser ||
                !phrase
            ) {
                return;
            }

            verifyBtn.disabled =
                true;

            verifyBtn.innerText =
                "Checking...";

            try {

                const response =
                    await fetch(
                        `${BACKEND}/check`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    username:
                                        currentUser.username,

                                    phrase:
                                        phrase
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!data.success) {

                    alert(
                        data.message ||
                        "Verification phrase not found."
                    );

                    return;
                }

                currentUser = {
                    id:
                        data.id ||
                        currentUser.id,

                    robloxId:
                        data.id ||
                        currentUser.id,

                    username:
                        data.username ||
                        currentUser.username,

                    avatar:
                        currentUser.avatar
                };

                localStorage.setItem(
                    "admflipUser",
                    JSON.stringify(
                        currentUser
                    )
                );

                updateAccount();

                const modal =
                    $("modal");

                if (modal) {
                    modal.classList.remove(
                        "show"
                    );
                }

                await loadInventory();

                alert(
                    "Verified successfully."
                );

            } catch (error) {

                console.error(error);

                alert(
                    "Login server error."
                );

            } finally {

                verifyBtn.disabled =
                    false;

                verifyBtn.innerText =
                    "Verify";
            }
        };
}

// ============================================================
// NAVIGATION
// ============================================================

function setupExistingNavigation() {

    const menu =
        document.querySelector(
            ".menu"
        );

    if (!menu) {
        return;
    }

    const links =
        menu.querySelectorAll("a");

    links.forEach(link => {

        const text =
            link.textContent
                .trim()
                .toLowerCase();

        link.onclick =
            event => {

                event.preventDefault();

                if (
                    text.includes(
                        "coinflip"
                    )
                ) {

                    showPage(
                        "coinflip"
                    );

                } else if (
                    text.includes(
                        "chat"
                    )
                ) {

                    toggleChat();

                } else if (
                    text.includes(
                        "leaderboard"
                    ) ||
                    text.includes(
                        "value"
                    )
                ) {

                    showPage(
                        "values"
                    );
                }
            };
    });
}

function restorePage() {

    if (
        currentSection !== "home" &&
        currentSection !== "coinflip" &&
        currentSection !== "values"
    ) {

        currentSection =
            "home";
    }

    showPage(
        currentSection,
        false
    );
}

function showPage(
    section,
    save = true
) {

    if (save) {

        currentSection =
            section;

        localStorage.setItem(
            "admflipSection",
            section
        );
    }

    // Hide existing main content.
    document
        .querySelectorAll(
            ".page-section"
        )
        .forEach(element => {

            element.classList.add(
                "hidden-section"
            );
        });

    const target =
        $(`${section}Section`);

    if (target) {

        target.classList.remove(
            "hidden-section"
        );
    }

    // Don't create duplicate homepage content.
    // The existing HTML remains the homepage.

    if (
        section === "coinflip"
    ) {

        loadCoinflips();
    }

    if (
        section === "values"
    ) {

        renderPets();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ============================================================
// CHAT
// ============================================================

function setupChat() {

    createChat();

    const rules =
        $("chatRulesBtn");

    if (rules) {

        rules.onclick = () => {

            const box =
                $("chatRules");

            if (box) {
                box.classList.toggle(
                    "hidden"
                );
            }
        };
    }

    const form =
        $("chatForm");

    if (form) {

        form.addEventListener(
            "submit",
            sendChat
        );
    }

    setChatState();

    loadChat();

    setInterval(
        loadChat,
        5000
    );
}

function createChat() {

    if ($("admflipChat")) {
        return;
    }

    const chat =
        document.createElement(
            "aside"
        );

    chat.id =
        "admflipChat";

    chat.innerHTML = `

        <div class="chat-header">

            <div>

                <strong>
                    Community
                </strong>

                <div class="online-indicator">

                    <span></span>

                    <b id="onlineCount">
                        ${onlineCount}
                    </b>

                    online

                </div>

            </div>

            <button
                id="chatRulesBtn"
                class="chat-icon-btn"
            >
                ?
            </button>

        </div>

        <div
            id="chatRules"
            class="chat-rules hidden"
        >

            <strong>
                Community Rules
            </strong>

            <div>
                No advertising
            </div>

            <div>
                No harassment
            </div>

            <div>
                No sexual activities
            </div>

            <div>
                No scams
            </div>

            <div>
                No links
            </div>

        </div>

        <div
            id="chatMessages"
            class="chat-messages"
        >
            Loading community...
        </div>

        <div
            id="chatLoginNotice"
            class="chat-login-notice"
        >
            Sign in to participate.
        </div>

        <form
            id="chatForm"
            class="chat-form"
        >

            <input
                id="chatInput"
                maxlength="300"
                placeholder="Write a message..."
                autocomplete="off"
            >

            <button>
                Send
            </button>

        </form>
    `;

    document.body.appendChild(
        chat
    );

    if (!$("mobileChatButton")) {

        const button =
            document.createElement(
                "button"
            );

        button.id =
            "mobileChatButton";

        button.innerText =
            "Chat";

        button.onclick =
            toggleChat;

        document.body.appendChild(
            button
        );
    }
}

function toggleChat() {

    chatOpen =
        !chatOpen;

    localStorage.setItem(
        "admflipChatOpen",
        chatOpen
            ? "true"
            : "false"
    );

    setChatState();
}

function setChatState() {

    const chat =
        $("admflipChat");

    if (!chat) {
        return;
    }

    chat.classList.toggle(
        "open",
        chatOpen
    );

    document.body.classList.toggle(
        "chat-open",
        chatOpen
    );

    const notice =
        $("chatLoginNotice");

    const form =
        $("chatForm");

    if (currentUser) {

        if (notice) {
            notice.style.display =
                "none";
        }

        if (form) {
            form.style.display =
                "flex";
        }

    } else {

        if (notice) {
            notice.style.display =
                "block";
        }

        if (form) {
            form.style.display =
                "none";
        }
    }
}

async function loadChat() {

    try {

        const response =
            await fetch(
                `${BACKEND}/chat`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const messages =
            Array.isArray(
                data.messages
            )
                ? data.messages
                : [];

        renderChat(
            messages
        );

    } catch (error) {

        console.debug(
            "Chat endpoint unavailable"
        );
    }
}

function renderChat(
    messages
) {

    const container =
        $("chatMessages");

    if (!container) {
        return;
    }

    if (!messages.length) {

        container.innerHTML = `
            <div class="chat-empty">
                Welcome to the community.
            </div>
        `;

        return;
    }

    container.innerHTML =
        messages
            .slice(-100)
            .map(message => {

                const username =
                    message.username ||
                    "User";

                const avatar =
                    message.avatar ||
                    "roblox.png";

                const text =
                    message.text ||
                    message.message ||
                    "";

                return `

                    <div
                        class="chat-message"
                    >

                        <img
                            src="${escapeHTML(
                                avatar
                            )}"
                            onerror="
                                this.src='roblox.png'
                            "
                        >

                        <div>

                            <b>
                                ${escapeHTML(
                                    username
                                )}
                            </b>

                            <p>
                                ${escapeHTML(
                                    text
                                )}
                            </p>

                        </div>

                    </div>
                `;
            })
            .join("");

    container.scrollTop =
        container.scrollHeight;
}

async function sendChat(
    event
) {

    event.preventDefault();

    if (!currentUser) {

        alert(
            "Sign in to chat."
        );

        return;
    }

    const input =
        $("chatInput");

    if (!input) {
        return;
    }

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    if (containsLink(text)) {

        alert(
            "Links are not allowed."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${BACKEND}/chat`,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            robloxId:
                                currentUser.id ||
                                currentUser.robloxId,

                            username:
                                currentUser.username,

                            avatar:
                                currentUser.avatar,

                            text:
                                text
                        })
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            data.success === false
        ) {

            alert(
                data.message ||
                "Unable to send message."
            );

            return;
        }

        input.value = "";

        await loadChat();

    } catch (error) {

        alert(
            "Chat server unavailable."
        );
    }
}

// ============================================================
// ONLINE
// ============================================================

function updateOnline() {

    const element =
        $("onlineCount");

    if (element) {
        element.textContent =
            onlineCount;
    }
}

function startOnlineCounter() {

    updateOnline();

    setInterval(
        () => {

            const change =
                Math.floor(
                    Math.random() * 5
                ) - 2;

            onlineCount +=
                change;

            if (
                onlineCount < 30
            ) {
                onlineCount = 30;
            }

            if (
                onlineCount > 54
            ) {
                onlineCount = 54;
            }

            localStorage.setItem(
                "admflipOnline",
                String(
                    onlineCount
                )
            );

            updateOnline();

        },
        70000
    );
}

// ============================================================
// VALUES
// ============================================================

async function loadPets() {

    try {

        const response =
            await fetch(
                `${BACKEND}/pets`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Pets request failed"
            );
        }

        const data =
            await response.json();

        pets =
            Array.isArray(
                data.pets
            )
                ? data.pets
                : [];

        renderPets();

    } catch (error) {

        console.error(
            "Pet values error:",
            error
        );

        const grid =
            $("petsGrid");

        if (grid) {

            grid.innerHTML = `
                <div class="empty-state">
                    Unable to load pet values.
                </div>
            `;
        }
    }
}

function renderPets(
    search = ""
) {

    const grid =
        $("petsGrid");

    if (!grid) {
        return;
    }

    const query =
        search
            .trim()
            .toLowerCase();

    const filtered =
        pets.filter(
            pet =>
                String(
                    pet.name || ""
                )
                .toLowerCase()
                .includes(query)
        );

    if (!filtered.length) {

        grid.innerHTML = `
            <div class="empty-state">
                No pets found.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        filtered
            .map(pet => {

                const image =
                    pet.image ||
                    pet.imageUrl ||
                    "logo.png";

                return `

                    <div
                        class="pet-card"
                    >

                        <img
                            class="pet-image"
                            src="${escapeHTML(
                                image
                            )}"
                            onerror="
                                this.src='logo.png'
                            "
                        >

                        <div>

                            <b>
                                ${escapeHTML(
                                    pet.name
                                )}
                            </b>

                            <strong>
                                ${formatNumber(
                                    pet.value
                                )}
                            </strong>

                        </div>

                    </div>
                `;
            })
            .join("");
}

// ============================================================
// INVENTORY
// ============================================================

async function loadInventory() {

    if (!currentUser) {
        return;
    }

    const id =
        currentUser.id ||
        currentUser.robloxId;

    try {

        const response =
            await fetch(
                `${BACKEND}/inventory/${encodeURIComponent(id)}`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        inventory =
            Array.isArray(
                data.inventory
            )
                ? data.inventory
                : [];

    } catch (error) {

        console.debug(
            "Inventory endpoint unavailable."
        );
    }
}

// ============================================================
// COINFLIP
// ============================================================

function setupCoinflip() {

    const createButton =
        $("createCoinflipBtn");

    const historyButton =
        $("historyCoinflipBtn");

    if (createButton) {

        createButton.onclick =
            openCoinflip;
    }

    if (historyButton) {

        historyButton.onclick =
            loadCoinflipHistory;
    }
}

async function openCoinflip() {

    if (!currentUser) {

        alert(
            "Sign in first."
        );

        return;
    }

    await loadInventory();

    if (!inventory.length) {

        alert(
            "You don't have any deposited pets yet. " +
            "Use the Deposit option to deposit a pet."
        );

        return;
    }

    showInventoryPicker();
}

function showInventoryPicker() {

    const modal =
        document.createElement(
            "div"
        );

    modal.className =
        "modal show";

    modal.id =
        "coinflipPicker";

    modal.innerHTML = `

        <div class="box">

            <button
                class="modal-close"
                id="closeCoinflip"
            >
                ×
            </button>

            <h2>
                Create Coinflip
            </h2>

            <p>
                Choose the pet you want
                to wager.
            </p>

            <div
                id="coinflipInventory"
                class="inventory-grid"
            ></div>

            <div
                class="coinflip-sides"
            >

                <button
                    data-side="Heads"
                    class="secondary-btn"
                >
                    Heads
                </button>

                <button
                    data-side="Tails"
                    class="secondary-btn"
                >
                    Tails
                </button>

            </div>

            <button
                id="submitCoinflip"
                class="primary-btn"
            >
                Create
            </button>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    const inventoryBox =
        modal.querySelector(
            "#coinflipInventory"
        );

    inventoryBox.innerHTML =
        inventory
            .map(
                (pet, index) => `
                    <button
                        class="inventory-item"
                        data-index="${index}"
                    >

                        <img
                            src="${escapeHTML(
                                pet.image ||
                                "logo.png"
                            )}"
                            onerror="
                                this.src='logo.png'
                            "
                        >

                        <span>
                            ${escapeHTML(
                                pet.name
                            )}
                        </span>

                    </button>
                `
            )
            .join("");

    let side = null;

    inventoryBox
        .querySelectorAll(
            ".inventory-item"
        )
        .forEach(button => {

            button.onclick =
                () => {

                    inventoryBox
                        .querySelectorAll(
                            ".inventory-item"
                        )
                        .forEach(
                            x =>
                                x.classList
                                    .remove(
                                        "selected"
                                    )
                        );

                    button.classList.add(
                        "selected"
                    );

                    selectedPet =
                        inventory[
                            Number(
                                button.dataset.index
                            )
                        ];
                };
        });

    modal
        .querySelectorAll(
            "[data-side]"
        )
        .forEach(button => {

            button.onclick =
                () => {

                    side =
                        button.dataset.side;

                    modal
                        .querySelectorAll(
                            "[data-side]"
                        )
                        .forEach(
                            x =>
                                x.classList
                                    .remove(
                                        "selected"
                                    )
                        );

                    button.classList.add(
                        "selected"
                    );
                };
        });

    modal
        .querySelector(
            "#closeCoinflip"
        )
        .onclick =
            () => modal.remove();

    modal
        .querySelector(
            "#submitCoinflip"
        )
        .onclick =
            async () => {

                if (!selectedPet) {

                    alert(
                        "Choose a pet."
                    );

                    return;
                }

                if (!side) {

                    alert(
                        "Choose Heads or Tails."
                    );

                    return;
                }

                try {

                    const response =
                        await fetch(
                            `${BACKEND}/coinflips`,
                            {
                                method:
                                    "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        userId:
                                            currentUser.id ||
                                            currentUser.robloxId,

                                        petId:
                                            selectedPet._id ||
                                            selectedPet.id,

                                        side:
                                            side
                                    })
                            }
                        );

                    const data =
                        await response.json();

                    if (
                        !response.ok ||
                        data.success === false
                    ) {

                        alert(
                            data.message ||
                            "Unable to create coinflip."
                        );

                        return;
                    }

                    selectedPet =
                        null;

                    modal.remove();

                    await loadInventory();

                    await loadCoinflips();

                } catch (error) {

                    console.error(error);

                    alert(
                        "Coinflip server unavailable."
                    );
                }
            };
}

async function loadCoinflips() {

    const container =
        $("coinflipList");

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(
                `${BACKEND}/coinflips`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            throw new Error();
        }

        const data =
            await response.json();

        const flips =
            Array.isArray(
                data.coinflips
            )
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

        container.innerHTML =
            flips
                .map(
                    flip => `

                        <div
                            class="coinflip-card"
                        >

                            <b>
                                ${escapeHTML(
                                    flip.username ||
                                    "Trader"
                                )}
                            </b>

                            <span>
                                ${escapeHTML(
                                    flip.side ||
                                    "Heads"
                                )}
                            </span>

                            <strong>
                                ${formatNumber(
                                    flip.value
                                )}
                            </strong>

                        </div>
                    `
                )
                .join("");

    } catch (error) {

        container.innerHTML = `
            <div class="empty-state">
                No active coinflips yet.
            </div>
        `;
    }
}

async function loadCoinflipHistory() {

    if (!currentUser) {

        alert(
            "Sign in first."
        );

        return;
    }

    const id =
        currentUser.id ||
        currentUser.robloxId;

    try {

        const response =
            await fetch(
                `${BACKEND}/coinflips/history/${encodeURIComponent(id)}`
            );

        const data =
            await response.json();

        const flips =
            Array.isArray(
                data.coinflips
            )
                ? data.coinflips
                : [];

        const container =
            $("coinflipList");

        if (!container) {
            return;
        }

        if (!flips.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No coinflip history.
                </div>
            `;

            return;
        }

        container.innerHTML =
            flips
                .map(
                    flip => `

                        <div
                            class="coinflip-card"
                        >

                            <b>
                                ${escapeHTML(
                                    flip.username ||
                                    currentUser.username
                                )}
                            </b>

                            <strong>
                                ${formatNumber(
                                    flip.value
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    flip.status ||
                                    "Finished"
                                )}
                            </span>

                        </div>
                    `
                )
                .join("");

    } catch (error) {

        alert(
            "Unable to load history."
        );
    }
}

// ============================================================
// STATUS
// ============================================================

async function loadStatus() {

    try {

        const response =
            await fetch(
                `${BACKEND}/status`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        if (
            data.online === false
        ) {

            showMaintenance();

        } else {

            hideMaintenance();
        }

    } catch (error) {

        console.debug(
            "Status unavailable"
        );
    }

    setTimeout(
        loadStatus,
        30000
    );
}

function showMaintenance() {

    if ($("maintenanceOverlay")) {
        return;
    }

    const overlay =
        document.createElement(
            "div"
        );

    overlay.id =
        "maintenanceOverlay";

    overlay.innerHTML = `
        <div class="maintenance-box">

            <h2>
                ADMFLIP is offline
            </h2>

            <p>
                We're performing maintenance.
                Please try again shortly.
            </p>

        </div>
    `;

    document.body.appendChild(
        overlay
    );
}

function hideMaintenance() {

    const overlay =
        $("maintenanceOverlay");

    if (overlay) {
        overlay.remove();
    }
}
