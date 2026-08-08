const BACKEND =
    "https://admflip-new.onrender.com";


/* =========================
   ELEMENTS
========================= */

const loginBtn =
    document.getElementById("loginBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const modal =
    document.getElementById("modal");

const modalClose =
    document.getElementById("modalClose");

const usernameInput =
    document.getElementById("username");

const profile =
    document.getElementById("profile");

const phraseText =
    document.getElementById("phrase");

const verifyBtn =
    document.getElementById("verify");


const chatDrawer =
    document.getElementById("chatDrawer");

const chatMenu =
    document.getElementById("chatMenu");

const chatClose =
    document.getElementById("chatClose");

const chatInput =
    document.getElementById("chatInput");

const sendChat =
    document.getElementById("sendChat");

const chatMessages =
    document.getElementById("chatMessages");

const rulesBtn =
    document.getElementById("rulesBtn");

const rulesBox =
    document.getElementById("rulesBox");


const onlineCount =
    document.getElementById("onlineCount");


const coinflipMenu =
    document.getElementById("coinflipMenu");

const valuesMenu =
    document.getElementById("valuesMenu");

const heroCoinflip =
    document.getElementById("heroCoinflip");

const heroValues =
    document.getElementById("heroValues");


const coinflipPage =
    document.getElementById("coinflipPage");

const valuesPage =
    document.getElementById("valuesPage");

const homePage =
    document.getElementById("homePage");


const createCoinflip =
    document.getElementById("createCoinflip");

const coinflipModal =
    document.getElementById("coinflipModal");

const coinflipModalClose =
    document.getElementById("coinflipModalClose");

const submitCoinflip =
    document.getElementById("submitCoinflip");

const coinflipPet =
    document.getElementById("coinflipPet");

const coinflipList =
    document.getElementById("coinflipList");


const valueSearch =
    document.getElementById("valueSearch");

const valuesList =
    document.getElementById("valuesList");


/* =========================
   USER STATE
========================= */

let currentUser = null;

let phrase = "";

let selectedSide = "heads";


/* =========================
   RESTORE LOGIN
========================= */

function restoreLogin(){

    try {

        const saved =
            localStorage.getItem(
                "admflipUser"
            );


        if(!saved){

            return;

        }


        const parsed =
            JSON.parse(saved);


        if(
            parsed &&
            parsed.id &&
            parsed.username
        ){

            currentUser = parsed;

            showUser();

        }

    }

    catch(error){

        console.error(
            "Login restore error:",
            error
        );

        localStorage.removeItem(
            "admflipUser"
        );

    }

}


restoreLogin();


/* =========================
   USER UI
========================= */

function showUser(){

    if(!currentUser){

        return;

    }


    loginBtn.innerHTML = `

        <img
            src="${escapeAttribute(
                currentUser.avatar || ""
            )}"
            alt=""
        >

        <span>
            ${escapeHtml(
                currentUser.username
            )}
        </span>

    `;


    logoutBtn.style.display =
        "block";

}


function clearLogin(){

    currentUser = null;

    phrase = "";

    localStorage.removeItem(
        "admflipUser"
    );


    loginBtn.innerHTML = `

        <img
            src="roblox.png"
            alt=""
        >

        <span>
            Sign In
        </span>

    `;


    logoutBtn.style.display =
        "none";

}


/* =========================
   LOGIN MODAL
========================= */

loginBtn.onclick = () => {

    if(currentUser){

        return;

    }

    modal.classList.add("show");

};


modalClose.onclick = () => {

    modal.classList.remove(
        "show"
    );

};


modal.onclick = (event) => {

    if(event.target === modal){

        modal.classList.remove(
            "show"
        );

    }

};


/* =========================
   ROBLOX LOOKUP
========================= */

usernameInput.onchange =
async () => {

    const username =
        usernameInput.value.trim();


    if(!username){

        return;

    }


    profile.innerHTML =
        "Loading Roblox profile...";

    profile.classList.remove(
        "hidden"
    );


    try {

        const response =
            await fetch(

                BACKEND +
                "/user/" +
                encodeURIComponent(
                    username
                ),

                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }

            );


        if(!response.ok){

            throw new Error(
                "Backend returned " +
                response.status
            );

        }


        const data =
            await response.json();


        if(!data.success){

            profile.innerHTML =
                "Roblox username not found.";

            return;

        }


        currentUser = data.user;


        profile.innerHTML = `

            <div style="
                display:flex;
                align-items:center;
                gap:12px;
                margin:15px 0;
            ">

                <img
                    width="55"
                    height="55"
                    style="
                        border-radius:12px;
                        object-fit:cover;
                    "
                    src="${escapeAttribute(
                        currentUser.avatar
                    )}"
                >

                <strong>
                    ${escapeHtml(
                        currentUser.username
                    )}
                </strong>

            </div>

        `;


        const phraseResponse =
            await fetch(
                BACKEND + "/create"
            );


        if(!phraseResponse.ok){

            throw new Error(
                "Phrase request failed"
            );

        }


        const phraseData =
            await phraseResponse.json();


        phrase =
            phraseData.phrase;


        phraseText.classList.remove(
            "hidden"
        );


        phraseText.innerHTML = `

            <div style="
                padding:13px;
                border-radius:12px;
                background:rgba(139,92,246,.1);
                margin-bottom:12px;
            ">

                Put this phrase in your
                Roblox bio:

                <br><br>

                <strong>
                    ${escapeHtml(
                        phrase
                    )}
                </strong>

            </div>

        `;


        verifyBtn.style.display =
            "block";


    }

    catch(error){

        console.error(error);

        profile.innerHTML =
            "Unable to contact the login server. Please try again.";

    }

};


/* =========================
   VERIFY
========================= */

verifyBtn.onclick =
async () => {

    if(!currentUser){

        return;

    }


    verifyBtn.disabled =
        true;

    verifyBtn.innerText =
        "Checking...";


    try {

        const response =
            await fetch(

                BACKEND + "/check",

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


        if(!response.ok){

            throw new Error(
                "Verification HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        if(!data.success){

            throw new Error(
                data.message ||
                "Verification failed"
            );

        }


        /*
         * IMPORTANT:
         * Save AFTER verification.
         * This is what makes refresh persistent.
         */

        localStorage.setItem(

            "admflipUser",

            JSON.stringify(
                currentUser
            )

        );


        showUser();


        modal.classList.remove(
            "show"
        );


        usernameInput.value =
            "";


        profile.classList.add(
            "hidden"
        );


        phraseText.classList.add(
            "hidden"
        );


        verifyBtn.style.display =
            "none";


        verifyBtn.disabled =
            false;


        verifyBtn.innerText =
            "Verify";


    }

    catch(error){

        console.error(error);

        alert(
            error.message ||
            "Verification failed"
        );


        verifyBtn.disabled =
            false;

        verifyBtn.innerText =
            "Verify";

    }

};


/* =========================
   LOGOUT
========================= */

logoutBtn.onclick = () => {

    clearLogin();

};


/* =========================
   PAGE NAVIGATION
========================= */

function showPage(page){

    homePage.classList.remove(
        "active"
    );

    coinflipPage.classList.remove(
        "active"
    );

    valuesPage.classList.remove(
        "active"
    );


    page.classList.add(
        "active"
    );

}


coinflipMenu.onclick =
heroCoinflip.onclick =
() => {

    showPage(
        coinflipPage
    );

    loadCoinflips();

};


valuesMenu.onclick =
heroValues.onclick =
() => {

    showPage(
        valuesPage
    );

    loadValues();

};


/* =========================
   CHAT
========================= */

chatMenu.onclick = () => {

    chatDrawer.classList.toggle(
        "open"
    );

};


chatClose.onclick = () => {

    chatDrawer.classList.remove(
        "open"
    );

};


rulesBtn.onclick = () => {

    rulesBox.style.display =
        rulesBox.style.display ===
        "none"
            ? "block"
            : "none";

};


/* =========================
   CHAT SEND
========================= */

sendChat.onclick =
sendMessage;


chatInput.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter"
        ){

            event.preventDefault();

            sendMessage();

        }

    }
);


function sendMessage(){

    if(!currentUser){

        alert(
            "You must sign in before chatting."
        );

        return;

    }


    const message =
        chatInput.value.trim();


    if(!message){

        return;

    }


    /*
     * Reject ANY URL-like text.
     */

    if(
        containsLink(message)
    ){

        alert(
            "Links are not allowed in chat."
        );

        return;

    }


    /*
     * This demo displays locally.
     *
     * The real version should POST
     * to the backend and store the
     * message in MongoDB.
     */

    addChatMessage({

        username:
            currentUser.username,

        avatar:
            currentUser.avatar,

        message:
            message

    });


    chatInput.value = "";

}


function addChatMessage(data){

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "chat-message";


    /*
     * textContent prevents HTML injection.
     */

    wrapper.innerHTML = `

        <div class="chat-user">

            <img
                src="${escapeAttribute(
                    data.avatar || ""
                )}"
                alt=""
            >

            <strong></strong>

        </div>

        <div class="chat-text"></div>

    `;


    wrapper
        .querySelector(
            ".chat-user strong"
        )
        .textContent =
            data.username;


    wrapper
        .querySelector(
            ".chat-text"
        )
        .textContent =
            data.message;


    chatMessages.appendChild(
        wrapper
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


function containsLink(text){

    const urlPattern =
        /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|[\w.-]+\.(com|net|org|gg|io|xyz|me|co)(\/|$))/i;


    return urlPattern.test(
        text
    );

}


/* =========================
   ONLINE COUNT
========================= */

let onlineNumber =
    Number(
        localStorage.getItem(
            "admflipOnlineNumber"
        )
    );


let onlineTimestamp =
    Number(
        localStorage.getItem(
            "admflipOnlineTimestamp"
        )
    );


const now =
    Date.now();


/*
 * Only change the fake display
 * every 60+ seconds.
 */

if(
    !onlineNumber ||
    !onlineTimestamp ||
    now - onlineTimestamp >
        70000
){

    onlineNumber =
        Math.floor(
            30 +
            Math.random() * 25
        );


    onlineTimestamp =
        now;


    localStorage.setItem(
        "admflipOnlineNumber",
        onlineNumber
    );


    localStorage.setItem(
        "admflipOnlineTimestamp",
        onlineTimestamp
    );

}


onlineCount.textContent =
    onlineNumber +
    " online";


/*
 * Slowly update it rather than
 * changing on every refresh.
 */

setInterval(
    () => {

        onlineNumber +=
            Math.floor(
                Math.random() * 5
            ) - 2;


        onlineNumber =
            Math.max(
                30,
                Math.min(
                    54,
                    onlineNumber
                )
            );


        localStorage.setItem(
            "admflipOnlineNumber",
            onlineNumber
        );


        localStorage.setItem(
            "admflipOnlineTimestamp",
            Date.now()
        );


        onlineCount.textContent =
            onlineNumber +
            " online";

    },
    90000
);


/* =========================
   VALUES
========================= */

let allPets = [];


async function loadValues(){

    if(allPets.length){

        renderValues(
            allPets
        );

        return;

    }


    valuesList.innerHTML =
        "<p>Loading values...</p>";


    try {

        const response =
            await fetch(
                BACKEND + "/pets"
            );


        if(!response.ok){

            throw new Error(
                "Values HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        allPets =
            Array.isArray(
                data.pets
            )
                ? data.pets
                : [];


        renderValues(
            allPets
        );

    }

    catch(error){

        console.error(error);

        valuesList.innerHTML =
            "<p>Unable to load values.</p>";

    }

}


function renderValues(pets){

    const search =
        valueSearch.value
            .trim()
            .toLowerCase();


    const filtered =
        pets
            .filter(
                pet =>
                    !search ||
                    String(
                        pet.name
                    )
                    .toLowerCase()
                    .includes(
                        search
                    )
            )
            .slice(0, 100);


    valuesList.innerHTML = "";


    if(!filtered.length){

        valuesList.innerHTML =
            `<div class="empty-state">
                No pets found.
            </div>`;

        return;

    }


    filtered.forEach(
        pet => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "value-item";


            const image =
                getPetImage(
                    pet
                );


            item.innerHTML = `

                <img
                    src="${escapeAttribute(
                        image
                    )}"
                    alt=""
                    loading="lazy"
                >

                <div class="value-info">

                    <div class="value-name">
                        ${escapeHtml(
                            pet.name
                        )}
                    </div>

                    <div class="value-number">
                        ${formatValue(
                            pet.value
                        )}
                    </div>

                </div>

            `;


            valuesList.appendChild(
                item
            );

        }
    );

}


valueSearch.addEventListener(
    "input",
    () => {

        renderValues(
            allPets
        );

    }
);


/*
 * Don't use the ADMFLIP logo as
 * a fake pet image.
 *
 * For now this returns a neutral
 * placeholder. The backend should
 * provide the actual AMVGG image URL
 * when it has one.
 */

function getPetImage(pet){

    if(
        pet.image &&
        typeof pet.image ===
            "string"
    ){

        return pet.image;

    }


    return "pet-placeholder.png";

}


function formatValue(value){

    const number =
        Number(value);


    if(!Number.isFinite(
        number
    )){

        return "Unknown";

    }


    return number
        .toLocaleString(
            undefined,
            {
                maximumFractionDigits:
                    6
            }
        );

}


/* =========================
   COINFLIPS
========================= */

createCoinflip.onclick =
() => {

    if(!currentUser){

        alert(
            "Sign in first."
        );

        return;

    }


    coinflipModal.classList.add(
        "show"
    );

};


coinflipModalClose.onclick =
() => {

    coinflipModal.classList.remove(
        "show"
    );

};


document
    .querySelectorAll(".side")
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(
                    ".side"
                )
                .forEach(
                    x =>
                        x.classList.remove(
                            "active"
                        )
                );


            button.classList.add(
                "active"
            );


            selectedSide =
                button.dataset.side;

        };

    });


submitCoinflip.onclick =
async () => {

    if(!currentUser){

        alert(
            "Sign in first."
        );

        return;

    }


    const pet =
        coinflipPet.value.trim();


    if(!pet){

        alert(
            "Enter a pet name."
        );

        return;

    }


    /*
     * Server must validate that
     * this pet actually belongs to
     * the user's inventory.
     *
     * Never trust the browser for this.
     */

    try {

        const response =
            await fetch(

                BACKEND +
                "/coinflips",

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

                            pet: pet,

                            side:
                                selectedSide

                        })

                }

            );


        const data =
            await response.json();


        if(!response.ok){

            throw new Error(
                data.message ||
                "Could not create coinflip."
            );

        }


        coinflipModal.classList.remove(
            "show"
        );


        coinflipPet.value = "";


        loadCoinflips();

    }

    catch(error){

        alert(
            error.message
        );

    }

};


async function loadCoinflips(){

    coinflipList.innerHTML =
        "<p>Loading...</p>";


    try {

        const response =
            await fetch(
                BACKEND +
                "/coinflips"
            );


        const data =
            await response.json();


        if(
            !data.success ||
            !Array.isArray(
                data.coinflips
            )
        ){

            throw new Error(
                "Invalid response"
            );

        }


        coinflipList.innerHTML =
            "";


        if(
            !data.coinflips.length
        ){

            coinflipList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        +
                    </div>

                    <h3>
                        No coinflips yet
                    </h3>

                    <p>
                        Be the first person
                        to create one.
                    </p>

                </div>

            `;

            return;

        }


        data.coinflips.forEach(
            listing => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "coinflip-card";


                card.innerHTML = `

                    <img
                        class="coinflip-pet"
                        src="${escapeAttribute(
                            getPetImage(
                                listing
                            )
                        )}"
                        alt=""
                    >

                    <div class="coinflip-info">

                        <strong></strong>

                        <div
                            class="coinflip-value"
                        >
                            ${formatValue(
                                listing.value
                            )}
                        </div>

                    </div>

                    <div
                        class="side-badge"
                    >
                        ${escapeHtml(
                            String(
                                listing.side
                            ).toUpperCase()
                        )}
                    </div>

                `;


                card
                    .querySelector(
                        ".coinflip-info strong"
                    )
                    .textContent =
                        listing.username +
                        " • " +
                        listing.pet;


                coinflipList.appendChild(
                    card
                );

            }
        );

    }

    catch(error){

        console.error(error);

        coinflipList.innerHTML =
            "<p>Unable to load coinflips.</p>";

    }

}


/* =========================
   SECURITY HELPERS
========================= */

function escapeHtml(value){

    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


function escapeAttribute(value){

    return escapeHtml(
        value
    );

}
