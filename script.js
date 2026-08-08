const BACKEND =
    "https://admflip-new.onrender.com";


// ==========================================
// LOGIN
// ==========================================

const loginBtn =
    document.getElementById("loginBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const modal =
    document.getElementById("modal");

const closeLogin =
    document.getElementById("closeLogin");

const usernameInput =
    document.getElementById("username");

const profile =
    document.getElementById("profile");

const phraseText =
    document.getElementById("phrase");

const verifyBtn =
    document.getElementById("verify");

let currentUser = null;

let phrase = "";


// ==========================================
// LOAD SAVED LOGIN
// ==========================================

try {

    const savedUser =
        localStorage.getItem(
            "admflipUser"
        );

    if (savedUser) {

        currentUser =
            JSON.parse(savedUser);

        if (
            currentUser &&
            currentUser.id
        ) {

            showUser();

        } else {

            localStorage.removeItem(
                "admflipUser"
            );

        }

    }

} catch (error) {

    localStorage.removeItem(
        "admflipUser"
    );

}


// ==========================================
// SHOW USER
// ==========================================

function showUser() {

    if (!currentUser) {
        return;
    }

    loginBtn.innerHTML = `

        <img
            src="${escapeHtml(currentUser.avatar || "roblox.png")}"
            alt=""
        >

        <span>
            ${escapeHtml(currentUser.username)}
        </span>

    `;

    loginBtn.classList.add(
        "logged"
    );

    logoutBtn.style.display =
        "block";

    chatInput.placeholder =
        "Write a message...";

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ==========================================
// LOGIN MODAL
// ==========================================

loginBtn.onclick = () => {

    if (!currentUser) {

        modal.classList.add(
            "show"
        );

        usernameInput.focus();

    }

};


closeLogin.onclick = () => {

    modal.classList.remove(
        "show"
    );

};


// ==========================================
// FIND ROBLOX USER
// ==========================================

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
                    BACKEND +
                    "/user/" +
                    encodeURIComponent(
                        username
                    )
                );

            const data =
                await response.json();

            if (!data.success) {

                alert(
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
                    height="80"
                    src="${escapeHtml(currentUser.avatar)}"
                >

                <br><br>

                <b>
                    ${escapeHtml(currentUser.username)}
                </b>

            `;


            // CREATE PHRASE

            const phraseResponse =
                await fetch(
                    BACKEND +
                    "/create"
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

                <strong>
                    ${escapeHtml(phrase)}
                </strong>

            `;

            verifyBtn.style.display =
                "block";

        } catch (error) {

            console.log(error);

            alert(
                "Server error"
            );

        }

    };


// ==========================================
// VERIFY
// ==========================================

verifyBtn.onclick =
    async () => {

        if (!currentUser) {
            return;
        }

        verifyBtn.disabled =
            true;

        verifyBtn.innerText =
            "Checking...";

        try {

            const response =
                await fetch(
                    BACKEND +
                    "/check",
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

            if (data.success) {

                localStorage.setItem(
                    "admflipUser",
                    JSON.stringify(
                        currentUser
                    )
                );

                modal.classList.remove(
                    "show"
                );

                showUser();

                alert(
                    "Verified successfully!"
                );

            } else {

                alert(
                    "Verification phrase not found."
                );

                verifyBtn.disabled =
                    false;

                verifyBtn.innerText =
                    "Verify";

            }

        } catch (error) {

            console.log(error);

            alert(
                "Verification failed"
            );

            verifyBtn.disabled =
                false;

            verifyBtn.innerText =
                "Verify";

        }

    };


// ==========================================
// LOGOUT
// ==========================================

logoutBtn.onclick = () => {

    localStorage.removeItem(
        "admflipUser"
    );

    currentUser = null;

    phrase = "";

    loginBtn.innerHTML = `

        <img
            src="roblox.png"
            alt=""
        >

        <span>
            Sign In
        </span>

    `;

    loginBtn.classList.remove(
        "logged"
    );

    logoutBtn.style.display =
        "none";

    chatInput.placeholder =
        "Sign in to chat...";

};


// ==========================================
// COINFLIP DROPDOWN
// ==========================================

const coinflipBtn =
    document.getElementById(
        "coinflipBtn"
    );

const coinflipMenu =
    document.getElementById(
        "coinflipMenu"
    );

coinflipBtn.onclick =
    (event) => {

        event.stopPropagation();

        coinflipMenu.classList.toggle(
            "show"
        );

    };

document.addEventListener(
    "click",
    () => {

        coinflipMenu.classList.remove(
            "show"
        );

    }
);


document.getElementById(
    "createCoinflip"
).onclick = () => {

    alert(
        "Coinflip creation coming next."
    );

};


document.getElementById(
    "historyCoinflip"
).onclick = () => {

    alert(
        "Coinflip history coming next."
    );

};


// ==========================================
// CHAT
// ==========================================

const chatBtn =
    document.getElementById(
        "chatBtn"
    );

const heroChat =
    document.getElementById(
        "heroChat"
    );

const chatDrawer =
    document.getElementById(
        "chatDrawer"
    );

const chatClose =
    document.getElementById(
        "chatClose"
    );

const chatMessages =
    document.getElementById(
        "chatMessages"
    );

const chatForm =
    document.getElementById(
        "chatForm"
    );

const chatInput =
    document.getElementById(
        "chatInput"
    );


// ==========================================
// REMEMBER CHAT STATE
// ==========================================

const savedChatState =
    localStorage.getItem(
        "admflipChatOpen"
    );

if (savedChatState === "true") {

    chatDrawer.classList.add(
        "open"
    );

}


// ==========================================
// OPEN / CLOSE
// ==========================================

function openChat() {

    chatDrawer.classList.add(
        "open"
    );

    localStorage.setItem(
        "admflipChatOpen",
        "true"
    );

    loadChat();

}


function closeChat() {

    chatDrawer.classList.remove(
        "open"
    );

    localStorage.setItem(
        "admflipChatOpen",
        "false"
    );

}


chatBtn.onclick =
    openChat;

heroChat.onclick =
    openChat;

chatClose.onclick =
    closeChat;


// ==========================================
// LOAD CHAT
// ==========================================

async function loadChat() {

    try {

        const response =
            await fetch(
                BACKEND +
                "/chat/messages"
            );

        const data =
            await response.json();

        if (!data.success) {
            return;
        }

        renderMessages(
            data.messages
        );

    } catch (error) {

        console.log(
            "Chat error:",
            error
        );

    }

}


// ==========================================
// RENDER CHAT
// ==========================================

function renderMessages(
    messages
) {

    if (!messages.length) {

        chatMessages.innerHTML = `

            <div class="empty-chat">

                <div>
                    ✦
                </div>

                <strong>
                    Welcome to ADMFLIP
                </strong>

                <p>
                    Be respectful and enjoy the chat.
                </p>

            </div>

        `;

        return;

    }


    chatMessages.innerHTML =
        messages.map(
            msg => {

                const date =
                    new Date(
                        msg.createdAt
                    );

                const time =
                    date.toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

                return `

                    <div class="message">

                        <img
                            class="message-avatar"
                            src="${escapeHtml(
                                msg.avatar ||
                                "roblox.png"
                            )}"
                            alt=""
                        >

                        <div class="message-content">

                            <div class="message-top">

                                <strong>
                                    ${escapeHtml(
                                        msg.username
                                    )}
                                </strong>

                                <span>
                                    ${time}
                                </span>

                            </div>

                            <div class="message-text">
                                ${escapeHtml(
                                    msg.message
                                )}
                            </div>

                        </div>

                    </div>

                `;

            }
        ).join("");

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


// ==========================================
// SEND CHAT
// ==========================================

chatForm.onsubmit =
    async (event) => {

        event.preventDefault();

        if (!currentUser) {

            modal.classList.add(
                "show"
            );

            return;

        }

        const message =
            chatInput.value.trim();

        if (!message) {
            return;
        }


        // CLIENT SIDE LINK BLOCK

        if (
            containsLink(
                message
            )
        ) {

            alert(
                "Links are not allowed in chat."
            );

            return;

        }


        chatInput.disabled =
            true;

        try {

            const response =
                await fetch(
                    BACKEND +
                    "/chat/messages",
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

                                robloxId:
                                    currentUser.id,

                                avatar:
                                    currentUser.avatar,

                                message

                            })

                    }
                );

            const data =
                await response.json();

            if (!data.success) {

                alert(
                    data.message ||
                    "Message could not be sent."
                );

                return;

            }

            chatInput.value =
                "";

            await loadChat();

        } catch (error) {

            console.log(error);

            alert(
                "Chat connection failed."
            );

        } finally {

            chatInput.disabled =
                false;

            chatInput.focus();

        }

    };


// ==========================================
// LINK FILTER
// ==========================================

function containsLink(text) {

    const patterns = [

        /https?:\/\//i,

        /www\./i,

        /\bdiscord\.gg\b/i,

        /\bdiscord\.com\b/i,

        /\bt\.me\b/i,

        /\bbit\.ly\b/i,

        /\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|tv|site|dev|app)\b/i

    ];

    return patterns.some(
        regex => regex.test(text)
    );

}


// ==========================================
// CHAT AUTO REFRESH
// ==========================================

setInterval(
    () => {

        if (
            chatDrawer.classList.contains(
                "open"
            )
        ) {

            loadChat();

        }

    },
    5000
);


// ==========================================
// ONLINE COUNTER
// ==========================================

const onlineCount =
    document.getElementById(
        "onlineCount"
    );


function updateOnlineCount() {

    const number =
        Math.floor(
            30 +
            Math.random() * 25
        );

    onlineCount.innerText =
        number;

}


updateOnlineCount();


function scheduleOnlineUpdate() {

    const delay =
        55000 +
        Math.floor(
            Math.random() * 45000
        );

    setTimeout(
        () => {

            updateOnlineCount();

            scheduleOnlineUpdate();

        },
        delay
    );

}

scheduleOnlineUpdate();


// ==========================================
// RULES
// ==========================================

const rulesBtn =
    document.getElementById(
        "rulesBtn"
    );

const rulesOverlay =
    document.getElementById(
        "rulesOverlay"
    );

const rulesClose =
    document.getElementById(
        "rulesClose"
    );


rulesBtn.onclick = () => {

    rulesOverlay.classList.add(
        "show"
    );

};


rulesClose.onclick = () => {

    rulesOverlay.classList.remove(
        "show"
    );

};


rulesOverlay.onclick =
    (event) => {

        if (
            event.target ===
            rulesOverlay
        ) {

            rulesOverlay.classList.remove(
                "show"
            );

        }

    };


// ==========================================
// VALUES
// ==========================================

const valuesPanel =
    document.getElementById(
        "valuesPanel"
    );

const valuesBtn =
    document.getElementById(
        "valuesBtn"
    );

const heroValues =
    document.getElementById(
        "heroValues"
    );

const valuesClose =
    document.getElementById(
        "valuesClose"
    );

const valuesList =
    document.getElementById(
        "valuesList"
    );

const petSearch =
    document.getElementById(
        "petSearch"
    );

let allPets = [];


// ==========================================
// OPEN VALUES
// ==========================================

function openValues() {

    valuesPanel.classList.add(
        "show"
    );

    loadValues();

}


function closeValues() {

    valuesPanel.classList.remove(
        "show"
    );

}


valuesBtn.onclick =
    openValues;

heroValues.onclick =
    openValues;

valuesClose.onclick =
    closeValues;


// ==========================================
// LOAD PET VALUES
// ==========================================

async function loadValues() {

    if (allPets.length) {

        renderValues(
            allPets
        );

        return;

    }

    valuesList.innerHTML = `

        <div class="values-loading">
            Loading pets...
        </div>

    `;

    try {

        const response =
            await fetch(
                BACKEND +
                "/pets"
            );

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                "Pet loading failed"
            );

        }

        allPets =
            data.pets || [];

        renderValues(
            allPets
        );

    } catch (error) {

        console.log(error);

        valuesList.innerHTML = `

            <div class="values-error">

                Could not load values.

            </div>

        `;

    }

}


// ==========================================
// RENDER VALUES
// ==========================================

function renderValues(
    pets
) {

    if (!pets.length) {

        valuesList.innerHTML = `

            <div class="values-error">
                No pets found.
            </div>

        `;

        return;

    }


    valuesList.innerHTML =
        pets.map(
            pet => `

                <button
                    class="pet-row"
                    data-pet="${escapeHtml(
                        pet.name
                    )}"
                >

                    <div
                        class="pet-image-wrap"
                        data-image-for="${escapeHtml(
                            pet.name
                        )}"
                    >

                        <div class="pet-placeholder">
                            ?
                        </div>

                    </div>

                    <div class="pet-info">

                        <strong>
                            ${escapeHtml(
                                pet.name
                            )}
                        </strong>

                        <span>
                            AMVGG Value
                        </span>

                    </div>

                    <div class="pet-value">

                        ${formatValue(
                            pet.value
                        )}

                    </div>

                </button>

            `
        ).join("");


    // Get AMVGG images AFTER rendering

    document
        .querySelectorAll(
            ".pet-row"
        )
        .forEach(
            row => {

                row.onclick =
                    () => {

                        lookupAMVGGPet(
                            row.dataset.pet
                        );

                    };

            }
        );


    // Load visible images

    const imageTargets =
        document.querySelectorAll(
            "[data-image-for]"
        );


    imageTargets.forEach(
        element => {

            lookupImage(
                element.dataset.imageFor,
                element
            );

        }
    );

}


function formatValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }

    return Number(value)
        .toLocaleString(
            undefined,
            {
                maximumFractionDigits: 6
            }
        );

}


// ==========================================
// AMVGG IMAGE
// ==========================================

async function lookupImage(
    petName,
    element
) {

    try {

        const response =
            await fetch(
                BACKEND +
                "/amvgg-pet/" +
                encodeURIComponent(
                    petName
                )
            );

        const data =
            await response.json();

        if (
            data.success &&
            data.pet &&
            data.pet.image
        ) {

            element.innerHTML = `

                <img
                    src="${escapeHtml(
                        data.pet.image
                    )}"
                    alt="${escapeHtml(
                        petName
                    )}"
                    loading="lazy"
                >

            `;

        }

    } catch (error) {

        console.log(
            "Image lookup failed:",
            petName
        );

    }

}


// ==========================================
// AMVGG PET DETAIL
// ==========================================

async function lookupAMVGGPet(
    petName
) {

    try {

        const response =
            await fetch(
                BACKEND +
                "/amvgg-pet/" +
                encodeURIComponent(
                    petName
                )
            );

        const data =
            await response.json();

        if (!data.success) {

            return;

        }

        const pet =
            data.pet;

        alert(

            `${pet.name}\n\n` +
            `AMVGG Value: ${
                pet.value ?? "—"
            }`

        );

    } catch (error) {

        console.log(error);

    }

}


// ==========================================
// SEARCH VALUES
// ==========================================

petSearch.oninput =
    () => {

        const query =
            petSearch.value
                .trim()
                .toLowerCase();

        const filtered =
            allPets.filter(
                pet =>
                    pet.name
                        .toLowerCase()
                        .includes(query)
            );

        renderValues(
            filtered
        );

    };


// ==========================================
// MOBILE: CLOSE VALUES WHEN CLICKING CHAT
// ==========================================

chatBtn.addEventListener(
    "click",
    () => {

        closeValues();

    }
);

valuesBtn.addEventListener(
    "click",
    () => {

        closeChat();

    }
);
