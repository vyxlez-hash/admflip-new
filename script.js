const BACKEND = "https://admflip-new.onrender.com";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const inventoryBtn = document.getElementById("inventoryBtn");

const modal = document.getElementById("modal");
const usernameInput = document.getElementById("username");
const profile = document.getElementById("profile");
const phraseText = document.getElementById("phrase");
const verifyBtn = document.getElementById("verify");

const chatPanel = document.getElementById("chatPanel");
const chatNav = document.getElementById("chatNav");
const chatClose = document.getElementById("chatClose");
const mobileChatBtn = document.getElementById("mobileChatBtn");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

const rulesBtn = document.getElementById("rulesBtn");
const rulesModal = document.getElementById("rulesModal");
const rulesClose = document.getElementById("rulesClose");

const createCoinflipBtn =
    document.getElementById("createCoinflipBtn");

const coinflipsList =
    document.getElementById("coinflipsList");

const petsGrid =
    document.getElementById("petsGrid");

const petSearch =
    document.getElementById("petSearch");

const leaderboardList =
    document.getElementById("leaderboardList");


let currentUser = null;
let phrase = "";

let allPets = [];

let selectedCoinflipPet = null;
let selectedCoinflipSide = null;

let chatOpen = false;

let lastChatTime = 0;

let onlineCount = 32;


/* =========================
   HELPERS
========================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function petImage(name) {

    return `https://amvgg.com/items/${encodeURIComponent(name)}.webp`;
}


function showSiteMessage(message) {

    const box =
        document.getElementById("siteMessage");

    if (!box) return;

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
        box.classList.remove("show");
    }, 3500);
}


/* =========================
   LOGIN
========================= */

function showUser() {

    if (!currentUser) return;

    loginBtn.innerHTML = `
        <img
            src="${escapeHtml(currentUser.avatar || "roblox.png")}"
            alt=""
        >
        <span>
            ${escapeHtml(currentUser.username)}
        </span>
    `;

    loginBtn.classList.add("logged");

    logoutBtn.style.display = "block";

    inventoryBtn.style.display = "block";
}


function restoreLogin() {

    const saved =
        localStorage.getItem("admflipUser");

    if (!saved) return;

    try {

        currentUser = JSON.parse(saved);

        if (
            currentUser &&
            currentUser.username &&
            currentUser.id
        ) {
            showUser();
        }

    } catch {

        localStorage.removeItem("admflipUser");

    }
}


restoreLogin();


loginBtn.onclick = () => {

    if (currentUser) {

        showPage("inventory");

        return;
    }

    modal.classList.add("show");
};


usernameInput.addEventListener("change", async () => {

    const username =
        usernameInput.value.trim();

    if (!username) return;

    try {

        const response = await fetch(
            `${BACKEND}/user/${encodeURIComponent(username)}`
        );

        const data = await response.json();

        if (!data.success) {

            showSiteMessage(
                "Roblox username not found."
            );

            return;
        }

        currentUser = data.user;

        profile.classList.remove("hidden");

        profile.innerHTML = `
            <img
                width="80"
                height="80"
                src="${escapeHtml(currentUser.avatar)}"
                alt=""
            >

            <br><br>

            <b>${escapeHtml(currentUser.username)}</b>
        `;


        const phraseResponse =
            await fetch(`${BACKEND}/create`);

        const phraseData =
            await phraseResponse.json();

        phrase =
            phraseData.phrase;

        phraseText.classList.remove("hidden");

        phraseText.innerHTML = `
            Put this phrase in your Roblox bio:

            <br><br>

            <b>${escapeHtml(phrase)}</b>
        `;

        verifyBtn.style.display = "block";

    } catch (error) {

        console.error(error);

        showSiteMessage(
            "Server error. Try again."
        );
    }
});


verifyBtn.onclick = async () => {

    if (!currentUser) return;

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
                    username:
                        currentUser.username,

                    phrase
                })
            }
        );

        const data =
            await response.json();

        if (!data.success) {

            showSiteMessage(
                "Verification phrase not found."
            );

            verifyBtn.disabled = false;
            verifyBtn.innerText = "Verify";

            return;
        }


        localStorage.setItem(
            "admflipUser",
            JSON.stringify(currentUser)
        );

        modal.classList.remove("show");

        showUser();

        showSiteMessage(
            `Welcome, ${currentUser.username}!`
        );

        loadInventory();
        loadCoinflips();

    } catch (error) {

        console.error(error);

        showSiteMessage(
            "Verification failed."
        );

        verifyBtn.disabled = false;
        verifyBtn.innerText = "Verify";
    }
};


logoutBtn.onclick = () => {

    localStorage.removeItem("admflipUser");

    currentUser = null;
    phrase = "";

    loginBtn.innerHTML = `
        <img src="roblox.png" alt="">
        <span>Sign In</span>
    `;

    loginBtn.classList.remove("logged");

    logoutBtn.style.display = "none";
    inventoryBtn.style.display = "none";

    showSiteMessage("Signed out.");
};


/* =========================
   NAVIGATION
========================= */

function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(section => {
            section.classList.remove("active");
        });


    const target =
        document.getElementById(`${page}Page`);

    if (!target) return;

    target.classList.add("active");

    localStorage.setItem(
        "admflipPage",
        page
    );


    if (page === "values") {
        loadPets();
    }

    if (page === "leaderboard") {
        loadLeaderboard();
    }

    if (page === "inventory") {

        if (!currentUser) {

            showSiteMessage(
                "Sign in first."
            );

            return;
        }

        loadInventory();
    }

    if (page === "coinflip") {
        loadCoinflips();
    }
}


document
    .querySelectorAll("[data-page]")
    .forEach(link => {

        link.addEventListener("click", event => {

            event.preventDefault();

            showPage(
                link.dataset.page
            );
        });
    });


inventoryBtn.onclick = () => {

    if (!currentUser) {

        modal.classList.add("show");

        return;
    }

    showPage("inventory");
};


/* =========================
   RESTORE PAGE AFTER REFRESH
========================= */

const savedPage =
    localStorage.getItem("admflipPage") ||
    "coinflip";

showPage(savedPage);


/* =========================
   CHAT
========================= */

function openChat() {

    chatOpen = true;

    chatPanel.classList.add("open");

    localStorage.setItem(
        "admflipChatOpen",
        "1"
    );

    loadChat();
}


function closeChat() {

    chatOpen = false;

    chatPanel.classList.remove("open");

    localStorage.setItem(
        "admflipChatOpen",
        "0"
    );
}


chatNav.onclick = event => {

    event.preventDefault();

    if (chatOpen) {
        closeChat();
    } else {
        openChat();
    }
};


chatClose.onclick = closeChat;

mobileChatBtn.onclick = () => {

    if (chatOpen) {
        closeChat();
    } else {
        openChat();
    }
};


if (
    localStorage.getItem("admflipChatOpen") === "1"
) {
    openChat();
}


async function loadChat() {

    try {

        const response =
            await fetch(`${BACKEND}/chat`);

        if (!response.ok) {
            throw new Error("Chat unavailable");
        }

        const data =
            await response.json();

        renderChat(
            data.messages || []
        );

    } catch {

        chatMessages.innerHTML = `
            <div class="chat-empty">
                Sign in to join ADMFLIP chat.
            </div>
        `;
    }
}


function renderChat(messages) {

    if (!messages.length) {

        chatMessages.innerHTML = `
            <div class="chat-empty">
                Welcome to ADMFLIP chat.
            </div>
        `;

        return;
    }


    chatMessages.innerHTML =
        messages.map(message => {

            return `
                <div class="chat-message">

                    <img
                        src="${escapeHtml(
                            message.avatar ||
                            "roblox.png"
                        )}"
                        alt=""
                    >

                    <div>

                        <div class="chat-user">
                            ${escapeHtml(
                                message.username ||
                                "User"
                            )}
                        </div>

                        <div class="chat-text">
                            ${escapeHtml(
                                message.message
                            )}
                        </div>

                    </div>

                </div>
            `;

        }).join("");


    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


chatSend.onclick =
    sendChatMessage;


chatInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            sendChatMessage();
        }

    }
);


async function sendChatMessage() {

    if (!currentUser) {

        showSiteMessage(
            "Sign in to chat."
        );

        return;
    }


    const message =
        chatInput.value.trim();

    if (!message) return;


    /*
      Block ALL links, not only http.
      This catches:
      https://...
      http://...
      www....
      discord.gg/...
      domain.com
    */

    const linkPattern =
        /(?:https?:\/\/|www\.|discord\.gg\/|t\.me\/|[a-z0-9-]+\.(?:com|net|org|gg|io|xyz|me|co|dev|app)(?:\/|$))/i;

    if (linkPattern.test(message)) {

        showSiteMessage(
            "Links are not allowed in chat."
        );

        return;
    }


    if (
        Date.now() - lastChatTime <
        2500
    ) {

        showSiteMessage(
            "Slow down."
        );

        return;
    }


    lastChatTime = Date.now();

    chatSend.disabled = true;


    try {

        const response =
            await fetch(`${BACKEND}/chat`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    robloxId:
                        currentUser.id,

                    username:
                        currentUser.username,

                    avatar:
                        currentUser.avatar,

                    message
                })
            });


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            showSiteMessage(
                data.message ||
                "Message failed."
            );

            return;
        }


        chatInput.value = "";

        renderChat(
            data.messages || []
        );

    } catch (error) {

        console.error(error);

        showSiteMessage(
            "Chat server error."
        );

    } finally {

        chatSend.disabled = false;
    }
}


/* =========================
   ONLINE COUNT
========================= */

function randomOnline() {

    onlineCount =
        Math.floor(
            Math.random() * 26
        ) + 20;

    const element =
        document.getElementById(
            "onlineCount"
        );

    if (element) {
        element.textContent =
            onlineCount;
    }
}


randomOnline();

setInterval(
    randomOnline,
    100000
);


/* =========================
   RULES
========================= */

rulesBtn.onclick = () => {

    rulesModal.classList.add("show");
};


rulesClose.onclick = () => {

    rulesModal.classList.remove("show");
};


rulesModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            rulesModal
        ) {
            rulesModal.classList.remove(
                "show"
            );
        }

    }
);


/* =========================
   PET VALUES
========================= */

async function loadPets() {

    petsGrid.innerHTML = `
        <div class="loading">
            Loading pet values...
        </div>
    `;

    try {

        const response =
            await fetch(`${BACKEND}/pets`);

        const data =
            await response.json();

        if (
            !data.success ||
            !Array.isArray(data.pets)
        ) {
            throw new Error("Invalid pets");
        }

        allPets = data.pets;

        renderPets(allPets);

    } catch (error) {

        console.error(error);

        petsGrid.innerHTML = `
            <div class="loading">
                Unable to load pet values.
            </div>
        `;
    }
}


function renderPets(pets) {

    if (!pets.length) {

        petsGrid.innerHTML = `
            <div class="loading">
                No pets found.
            </div>
        `;

        return;
    }


    petsGrid.innerHTML =
        pets.map(pet => {

            const name =
                pet.name || "Unknown";

            const value =
                Number(pet.value || 0);


            return `
                <div class="pet-value-card">

                    <div class="pet-value-image">

                        <img
                            src="${petImage(name)}"
                            alt="${escapeHtml(name)}"
                            loading="lazy"
                            onerror="
                                this.style.display='none';
                                this.parentElement.classList.add('no-image');
                            "
                        >

                        <span>
                            ${escapeHtml(
                                name
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                        </span>

                    </div>

                    <div class="pet-value-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <b>
                            ${value.toLocaleString()}
                        </b>

                    </div>

                </div>
            `;

        }).join("");
}


petSearch.addEventListener(
    "input",
    () => {

        const search =
            petSearch.value
                .trim()
                .toLowerCase();

        const filtered =
            allPets.filter(pet =>
                String(pet.name || "")
                    .toLowerCase()
                    .includes(search)
            );

        renderPets(filtered);
    }
);


/* =========================
   INVENTORY
========================= */

async function loadInventory() {

    if (!currentUser) return;


    const grid =
        document.getElementById(
            "inventoryGrid"
        );

    grid.innerHTML = `
        <div class="loading">
            Loading inventory...
        </div>
    `;


    try {

        const response =
            await fetch(
                `${BACKEND}/inventory/${encodeURIComponent(
                    currentUser.id
                )}`
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "Inventory error"
            );
        }


        currentUser.inventory =
            data.inventory || [];


        localStorage.setItem(
            "admflipUser",
            JSON.stringify(currentUser)
        );


        renderInventory(
            currentUser.inventory
        );


    } catch (error) {

        console.error(error);

        /*
          If the backend inventory endpoint
          isn't available yet, use the locally
          saved inventory rather than destroying it.
        */

        renderInventory(
            currentUser.inventory || []
        );
    }
}


function renderInventory(inventory) {

    const grid =
        document.getElementById(
            "inventoryGrid"
        );


    if (!inventory.length) {

        grid.innerHTML = `
            <div class="loading">
                Your inventory is empty.
            </div>
        `;

        return;
    }


    grid.innerHTML =
        inventory.map((pet, index) => {

            const name =
                pet.name || "Unknown";

            const value =
                Number(pet.value || 0);


            return `
                <div
                    class="pet-value-card"
                    data-inventory-index="${index}"
                >

                    <div class="pet-value-image">

                        <img
                            src="${petImage(name)}"
                            alt="${escapeHtml(name)}"
                            loading="lazy"
                            onerror="
                                this.style.display='none';
                                this.parentElement.classList.add('no-image');
                            "
                        >

                        <span>
                            ${escapeHtml(
                                name
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                        </span>

                    </div>

                    <div class="pet-value-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <b>
                            ${value.toLocaleString()}
                        </b>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================
   COINFLIP CREATOR
========================= */

createCoinflipBtn.onclick = () => {

    if (!currentUser) {

        showSiteMessage(
            "Sign in first to create a coinflip."
        );

        modal.classList.add("show");

        return;
    }


    const container =
        document.getElementById(
            "coinflipCreate"
        );


    if (
        container.style.display !==
        "none"
    ) {

        container.style.display =
            "none";

        container.innerHTML = "";

        return;
    }


    loadInventoryForCoinflip();
};


async function loadInventoryForCoinflip() {

    let inventory =
        currentUser.inventory || [];


    try {

        const response =
            await fetch(
                `${BACKEND}/inventory/${encodeURIComponent(
                    currentUser.id
                )}`
            );


        if (response.ok) {

            const data =
                await response.json();

            if (data.success) {

                inventory =
                    data.inventory || [];

                currentUser.inventory =
                    inventory;

                localStorage.setItem(
                    "admflipUser",
                    JSON.stringify(currentUser)
                );
            }
        }

    } catch {}


    renderCoinflipCreator(
        inventory
    );
}


function renderCoinflipCreator(
    inventory
) {

    const container =
        document.getElementById(
            "coinflipCreate"
        );


    container.style.display =
        "block";


    selectedCoinflipPet = null;
    selectedCoinflipSide = null;


    container.innerHTML = `

        <div class="cf-create-box">

            <div class="cf-create-header">

                <div>
                    <h2>Create Coinflip</h2>
                    <p>
                        Choose a pet from your inventory.
                    </p>
                </div>

                <button
                    class="cf-close"
                    id="closeCf"
                >
                    ×
                </button>

            </div>


            <div
                class="cf-inventory"
                id="cfInventory"
            ></div>


            <div
                class="cf-side-section"
                id="cfSideSection"
                style="display:none"
            >

                <h3>
                    Choose your side
                </h3>

                <div class="cf-sides">

                    <button
                        class="cf-side"
                        data-side="heads"
                    >
                        <span>H</span>
                        Heads
                    </button>

                    <button
                        class="cf-side"
                        data-side="tails"
                    >
                        <span>T</span>
                        Tails
                    </button>

                </div>


                <button
                    id="postCoinflipBtn"
                    class="cf-post"
                    disabled
                >
                    Choose a side
                </button>

            </div>

        </div>
    `;


    document
        .getElementById("closeCf")
        .onclick = () => {

            container.innerHTML = "";
            container.style.display =
                "none";
        };


    const inventoryBox =
        document.getElementById(
            "cfInventory"
        );


    if (!inventory.length) {

        inventoryBox.innerHTML = `
            <div class="loading">
                You have no pets to coinflip.
            </div>
        `;

        return;
    }


    inventory.forEach(
        (pet, index) => {

            const card =
                document.createElement(
                    "button"
                );


            card.type = "button";

            card.className =
                "cf-pet-card";


            card.dataset.index =
                index;


            const name =
                pet.name ||
                "Unknown Pet";


            const value =
                Number(
                    pet.value || 0
                );


            card.innerHTML = `

                <div class="cf-pet-image-wrap">

                    <img
                        class="cf-pet-image"
                        src="${petImage(name)}"
                        alt="${escapeHtml(name)}"
                        loading="lazy"
                    >

                    <div class="cf-no-image">
                        ${escapeHtml(
                            name
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </div>

                </div>


                <div class="cf-pet-info">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <span>
                        ${value.toLocaleString()}
                    </span>

                </div>


                <div class="cf-selected-check">
                    ✓
                </div>
            `;


            const image =
                card.querySelector(
                    ".cf-pet-image"
                );


            image.onerror = () => {

                image.style.display =
                    "none";

                image
                    .parentElement
                    .classList
                    .add("no-image");
            };


            card.onclick = () => {

                selectCoinflipPet(
                    pet,
                    index
                );
            };


            inventoryBox.appendChild(
                card
            );
        }
    );


    document
        .querySelectorAll(".cf-side")
        .forEach(button => {

            button.onclick = () => {

                selectCoinflipSide(
                    button.dataset.side
                );
            };
        });


    document
        .getElementById(
            "postCoinflipBtn"
        )
        .onclick =
        postCoinflip;
}


function selectCoinflipPet(
    pet,
    index
) {

    selectedCoinflipPet = {
        name: pet.name,
        value: Number(
            pet.value || 0
        ),
        index
    };


    document
        .querySelectorAll(
            ".cf-pet-card"
        )
        .forEach(card => {

            card.classList.remove(
                "selected"
            );
        });


    const selected =
        document.querySelector(
            `.cf-pet-card[data-index="${index}"]`
        );


    if (selected) {

        selected.classList.add(
            "selected"
        );
    }


    document
        .getElementById(
            "cfSideSection"
        )
        .style.display =
        "block";


    selectedCoinflipSide =
        null;


    document
        .querySelectorAll(
            ".cf-side"
        )
        .forEach(button => {

            button.classList.remove(
                "selected"
            );
        });


    updatePostButton();
}


function selectCoinflipSide(
    side
) {

    if (!selectedCoinflipPet) {

        showSiteMessage(
            "Choose a pet first."
        );

        return;
    }


    selectedCoinflipSide =
        side;


    document
        .querySelectorAll(
            ".cf-side"
        )
        .forEach(button => {

            button.classList.remove(
                "selected"
            );
        });


    const selected =
        document.querySelector(
            `.cf-side[data-side="${side}"]`
        );


    if (selected) {

        selected.classList.add(
            "selected"
        );
    }


    updatePostButton();
}


function updatePostButton() {

    const button =
        document.getElementById(
            "postCoinflipBtn"
        );


    if (!button) return;


    if (!selectedCoinflipPet) {

        button.disabled = true;
        button.textContent =
            "Choose a pet";

        return;
    }


    if (!selectedCoinflipSide) {

        button.disabled = true;
        button.textContent =
            "Choose a side";

        return;
    }


    button.disabled = false;
    button.textContent =
        "Create Coinflip";
}


async function postCoinflip() {

    if (!currentUser) {

        showSiteMessage(
            "Sign in first."
        );

        return;
    }


    if (!selectedCoinflipPet) {

        showSiteMessage(
            "Choose a pet."
        );

        return;
    }


    if (!selectedCoinflipSide) {

        showSiteMessage(
            "Choose Heads or Tails."
        );

        return;
    }


    const button =
        document.getElementById(
            "postCoinflipBtn"
        );


    button.disabled = true;
    button.textContent =
        "Creating...";


    try {

        const response =
            await fetch(
                `${BACKEND}/coinflips`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            robloxId:
                                currentUser.id,

                            username:
                                currentUser.username,

                            avatar:
                                currentUser.avatar,

                            petName:
                                selectedCoinflipPet.name,

                            petValue:
                                selectedCoinflipPet.value,

                            side:
                                selectedCoinflipSide
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to create coinflip."
            );
        }


        showSiteMessage(
            "Coinflip created!"
        );


        const container =
            document.getElementById(
                "coinflipCreate"
            );


        container.innerHTML = "";
        container.style.display =
            "none";


        loadCoinflips();


    } catch (error) {

        console.error(error);

        showSiteMessage(
            error.message ||
            "Could not create coinflip."
        );


        button.disabled = false;
        button.textContent =
            "Create Coinflip";
    }
}


/* =========================
   COINFLIPS
========================= */

async function loadCoinflips() {

    coinflipsList.innerHTML = `
        <div class="loading">
            Loading active coinflips...
        </div>
    `;


    try {

        const response =
            await fetch(
                `${BACKEND}/coinflips`
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                "Coinflip error"
            );
        }


        renderCoinflips(
            data.coinflips || []
        );


    } catch (error) {

        console.error(error);

        coinflipsList.innerHTML = `
            <div class="loading">
                No active coinflips yet.
            </div>
        `;
    }
}


function renderCoinflips(
    coinflips
) {

    if (!coinflips.length) {

        coinflipsList.innerHTML = `
            <div class="loading">
                No active coinflips yet.
            </div>
        `;

        return;
    }


    coinflipsList.innerHTML =
        coinflips.map(cf => {

            const pet =
                cf.petName ||
                "Unknown Pet";


            const value =
                Number(
                    cf.petValue || 0
                );


            const owner =
                cf.username ||
                "Unknown";


            const side =
                String(
                    cf.side ||
                    "heads"
                ).toUpperCase();


            return `

                <article class="coinflip-card">

                    <div class="coinflip-user">

                        <img
                            src="${escapeHtml(
                                cf.avatar ||
                                "roblox.png"
                            )}"
                            alt=""
                        >

                        <strong>
                            ${escapeHtml(owner)}
                        </strong>

                    </div>


                    <div class="coinflip-pet">

                        <div class="coinflip-pet-image">

                            <img
                                src="${petImage(pet)}"
                                alt="${escapeHtml(pet)}"
                                onerror="
                                    this.style.display='none';
                                    this.parentElement.classList.add('no-image');
                                "
                            >

                            <span>
                                ${escapeHtml(
                                    pet
                                        .slice(0, 2)
                                        .toUpperCase()
                                )}
                            </span>

                        </div>


                        <div>

                            <strong>
                                ${escapeHtml(pet)}
                            </strong>

                            <small>
                                ${value.toLocaleString()}
                            </small>

                        </div>

                    </div>


                    <div class="coinflip-side">

                        <span>
                            ${side === "HEADS"
                                ? "H"
                                : "T"}
                        </span>

                        ${side}

                    </div>


                    <div class="coinflip-action">

                        ${
                            String(
                                cf.robloxId
                            ) === String(
                                currentUser?.id
                            )
                            ?
                            `<button
                                class="join-btn disabled"
                                disabled
                            >
                                Your Flip
                            </button>`
                            :
                            `<button
                                class="join-btn"
                                onclick="joinCoinflip('${escapeHtml(
                                    cf._id ||
                                    cf.id
                                )}')"
                            >
                                Join
                            </button>`
                        }

                    </div>

                </article>
            `;

        }).join("");
}


async function joinCoinflip(
    id
) {

    if (!currentUser) {

        showSiteMessage(
            "Sign in first."
        );

        modal.classList.add("show");

        return;
    }


    try {

        const response =
            await fetch(
                `${BACKEND}/coinflips/${encodeURIComponent(id)}/join`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            robloxId:
                                currentUser.id,

                            username:
                                currentUser.username,

                            avatar:
                                currentUser.avatar
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to join."
            );
        }


        if (data.result) {

            showCoinflipResult(
                data.result
            );

        } else {

            showSiteMessage(
                "Joined coinflip."
            );
        }


        loadCoinflips();


    } catch (error) {

        console.error(error);

        showSiteMessage(
            error.message ||
            "Unable to join coinflip."
        );
    }
}


function showCoinflipResult(
    result
) {

    const winner =
        result.winnerUsername ||
        "Winner";


    const side =
        result.winningSide ||
        "";


    showSiteMessage(
        `${winner} won on ${side}!`
    );
}


/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard() {

    leaderboardList.innerHTML = `
        <div class="loading">
            Loading TOP FLIPPERS...
        </div>
    `;


    try {

        const response =
            await fetch(
                `${BACKEND}/leaderboard`
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                "Leaderboard error"
            );
        }


        const users =
            (data.users || [])
                .slice(0, 10);


        renderLeaderboard(users);


    } catch (error) {

        console.error(error);

        leaderboardList.innerHTML = `
            <div class="loading">
                Unable to load leaderboard.
            </div>
        `;
    }
}


function renderLeaderboard(
    users
) {

    if (!users.length) {

        leaderboardList.innerHTML = `
            <div class="loading">
                No wager data yet.
            </div>
        `;

        return;
    }


    leaderboardList.innerHTML =
        users.map((user, index) => {

            const place =
                index + 1;


            const wager =
                Number(
                    user.wagered || 0
                );


            return `

                <div class="leaderboard-row">

                    <div class="leaderboard-place">
                        ${place}
                    </div>


                    <img
                        src="${escapeHtml(
                            user.avatar ||
                            "roblox.png"
                        )}"
                        alt=""
                    >


                    <div class="leaderboard-user">

                        <strong>
                            ${escapeHtml(
                                user.username ||
                                "Unknown"
                            )}
                        </strong>

                        <span>
                            ${wager.toLocaleString()}
                            wagered
                        </span>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================
   MODAL CLOSE
========================= */

modal.addEventListener(
    "click",
    event => {

        if (
            event.target === modal
        ) {
            modal.classList.remove(
                "show"
            );
        }
    }
);


/* =========================
   STARTUP
========================= */

loadCoinflips();
