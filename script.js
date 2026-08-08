const BACKEND = "https://admflip-new.onrender.com";

const $ = id => document.getElementById(id);


/* =========================
   STATE
========================= */

let currentUser =
    JSON.parse(localStorage.getItem("admflipUser") || "null");

let authToken =
    localStorage.getItem("admflipToken") || "";

let currentPage =
    localStorage.getItem("admflipPage") || "coinflip";

let chatOpen =
    localStorage.getItem("admflipChatOpen") === "true";

let selectedPet = null;
let selectedSide = null;

let pets = [];


/* =========================
   UI MESSAGE
========================= */

let toastTimer;

function message(text){

    const toast = $("toast");

    toast.textContent = text;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


/* =========================
   API
========================= */

async function api(path, options = {}){

    const headers = {
        ...(options.headers || {})
    };

    if(authToken){
        headers.Authorization = `Bearer ${authToken}`;
    }

    if(options.body && !headers["Content-Type"]){
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
        BACKEND + path,
        {
            ...options,
            headers
        }
    );

    let data;

    try{
        data = await response.json();
    }
    catch{
        throw new Error("Invalid server response");
    }

    if(!response.ok){
        throw new Error(
            data.message || "Server error"
        );
    }

    return data;
}


/* =========================
   LOGIN
========================= */

function updateAccount(){

    if(currentUser){

        $("loginBtn").innerHTML = `
            <span>${escapeHtml(currentUser.username)}</span>
        `;

        $("logoutBtn").classList.remove("hidden");

    }else{

        $("loginBtn").innerHTML = `
            <span>Sign In</span>
        `;

        $("logoutBtn").classList.add("hidden");
    }
}


$("loginBtn").onclick = () => {

    if(currentUser){

        message("You are already signed in.");

        return;
    }

    $("loginModal").classList.remove("hidden");
};


$("closeLoginBtn").onclick = () => {

    $("loginModal").classList.add("hidden");
};


$("findUserBtn").onclick = async () => {

    const username =
        $("usernameInput").value.trim();

    if(!username){

        message("Enter your Roblox username.");

        return;
    }

    $("findUserBtn").disabled = true;
    $("findUserBtn").textContent = "Checking...";

    try{

        const data =
            await api(
                `/user/${encodeURIComponent(username)}`
            );

        if(!data.success){

            message(
                data.message ||
                "Roblox user was not found."
            );

            return;
        }

        $("loginProfile").innerHTML = `
            <div class="message" style="margin:15px 0">
                <img
                    class="messageAvatar"
                    src="${safeUrl(data.user.avatar)}"
                >
                <div class="messageBody">
                    <div class="messageName">
                        ${escapeHtml(data.user.username)}
                    </div>
                    <div class="messageText">
                        Put the verification phrase in your Roblox bio.
                    </div>
                </div>
            </div>
        `;

        const phraseData =
            await api("/create");

        $("phraseBox").classList.remove("hidden");

        $("phraseBox").innerHTML = `
            Put this phrase in your Roblox bio:
            <br><br>
            <strong>${escapeHtml(
                phraseData.phrase
            )}</strong>
        `;

        $("verifyBtn").classList.remove("hidden");

        $("verifyBtn").dataset.username =
            data.user.username;

        $("verifyBtn").dataset.phrase =
            phraseData.phrase;

    }
    catch(error){

        message(error.message);

    }
    finally{

        $("findUserBtn").disabled = false;
        $("findUserBtn").textContent = "Continue";

    }
};


$("verifyBtn").onclick = async () => {

    const username =
        $("verifyBtn").dataset.username;

    const phrase =
        $("verifyBtn").dataset.phrase;

    $("verifyBtn").disabled = true;
    $("verifyBtn").textContent = "Verifying...";

    try{

        const data =
            await api(
                "/check",
                {
                    method:"POST",
                    body:JSON.stringify({
                        username,
                        phrase
                    })
                }
            );

        if(!data.success){

            message(
                data.message ||
                "Verification phrase was not found."
            );

            return;
        }

        /*
         * Backend returns JWT.
         */

        if(data.token){

            authToken = data.token;

            localStorage.setItem(
                "admflipToken",
                authToken
            );
        }

        currentUser = data.user || {
            id:data.id,
            username:data.username
        };

        localStorage.setItem(
            "admflipUser",
            JSON.stringify(currentUser)
        );

        updateAccount();

        $("loginModal").classList.add("hidden");

        message("Signed in successfully.");

        loadCoinflips();

        loadChat();

    }
    catch(error){

        message(error.message);

    }
    finally{

        $("verifyBtn").disabled = false;
        $("verifyBtn").textContent = "Verify Roblox";

    }
};


$("logoutBtn").onclick = () => {

    currentUser = null;
    authToken = "";

    localStorage.removeItem("admflipUser");
    localStorage.removeItem("admflipToken");

    updateAccount();

    message("Signed out.");

    loadCoinflips();
};


/* =========================
   PAGE NAVIGATION
========================= */

function showPage(page){

    currentPage = page;

    localStorage.setItem(
        "admflipPage",
        page
    );

    document
        .querySelectorAll(".page")
        .forEach(x => x.classList.add("hidden"));

    const element =
        $(
            page === "coinflip"
                ? "coinflipPage"
                : page === "values"
                    ? "valuesPage"
                    : page === "leaderboard"
                        ? "leaderboardPage"
                        : "chatPage"
        );

    element.classList.remove("hidden");

    document
        .querySelectorAll(".nav button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });

    if(page === "coinflip"){
        loadCoinflips();
    }

    if(page === "values"){
        loadValues();
    }

    if(page === "leaderboard"){
        loadLeaderboard();
    }

    if(page === "chat"){
        openChat();
    }
}


document
    .querySelectorAll(".nav button")
    .forEach(button => {

        button.onclick = () => {

            const page =
                button.dataset.page;

            showPage(page);

            if(page !== "chat" && chatOpen){
                closeChat();
            }
        };
    });


/* =========================
   CHAT
========================= */

function openChat(){

    chatOpen = true;

    localStorage.setItem(
        "admflipChatOpen",
        "true"
    );

    $("chatPanel").classList.add("open");

    loadChat();
}


function closeChat(){

    chatOpen = false;

    localStorage.setItem(
        "admflipChatOpen",
        "false"
    );

    $("chatPanel").classList.remove("open");
}


$("closeChatBtn").onclick =
    closeChat;


$("mobileChatBtn").onclick = () => {

    if(chatOpen){
        closeChat();
    }else{
        openChat();
    }
};


$("openChatBtn").onclick =
    openChat;


$("rulesBtn").onclick = () => {

    $("rulesBox").classList.toggle(
        "hidden"
    );
};


$("chatForm").onsubmit = async event => {

    event.preventDefault();

    if(!currentUser || !authToken){

        message(
            "Sign in first to chat."
        );

        $("loginModal").classList.remove(
            "hidden"
        );

        return;
    }

    const input =
        $("chatInput");

    const text =
        input.value.trim();

    if(!text){
        return;
    }

    try{

        await api(
            "/chat",
            {
                method:"POST",
                body:JSON.stringify({
                    text
                })
            }
        );

        input.value = "";

        loadChat();

    }
    catch(error){

        message(error.message);

    }
};


async function loadChat(){

    try{

        const data =
            await api("/chat");

        renderChat(
            data.messages || []
        );

        if(
            data.announcement
        ){

            renderAnnouncement(
                data.announcement
            );
        }

        if(
            typeof data.online === "number"
        ){

            $("onlineCount").textContent =
                data.online;
        }

    }
    catch(error){

        console.log(error);
    }
}


function renderAnnouncement(text){

    const container =
        $("chatMessages");

    const existing =
        container.querySelector(
            ".announcement"
        );

    if(existing){
        existing.remove();
    }

    container.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="announcement">
            <div class="announcementTitle">
                ADMFLIP
            </div>
            <div>
                ${escapeHtml(text)}
            </div>
        </div>
        `
    );
}


function renderChat(messages){

    const container =
        $("chatMessages");

    const announcement =
        container.querySelector(
            ".announcement"
        );

    container.innerHTML = "";

    if(announcement){
        container.appendChild(
            announcement
        );
    }

    for(const msg of messages){

        const avatar =
            safeUrl(
                msg.avatar ||
                "logo.png"
            );

        container.insertAdjacentHTML(
            "beforeend",
            `
            <div class="message">

                <img
                    class="messageAvatar"
                    src="${avatar}"
                >

                <div class="messageBody">

                    <div class="messageTop">

                        <span class="messageName">
                            ${escapeHtml(
                                msg.username
                            )}
                        </span>

                        <span class="messageTime">
                            ${formatTime(
                                msg.createdAt
                            )}
                        </span>

                    </div>

                    <div class="messageText">
                        ${escapeHtml(
                            msg.text
                        )}
                    </div>

                </div>

            </div>
            `
        );
    }

    container.scrollTop =
        container.scrollHeight;
}


/* =========================
   VALUES
========================= */

async function loadValues(){

    if(pets.length){

        renderPets();

        return;
    }

    $("petList").innerHTML =
        `<div class="loading">
            Loading values...
        </div>`;

    try{

        const data =
            await api("/pets");

        pets =
            data.pets || [];

        renderPets();

    }
    catch(error){

        $("petList").innerHTML =
            `<div class="empty">
                Unable to load pet values.
            </div>`;

        console.log(error);
    }
}


function renderPets(){

    const search =
        $("petSearch").value
            .trim()
            .toLowerCase();

    const filtered =
        pets.filter(pet =>
            pet.name
                .toLowerCase()
                .includes(search)
        );

    if(!filtered.length){

        $("petList").innerHTML =
            `<div class="empty">
                No pets found.
            </div>`;

        return;
    }

    $("petList").innerHTML =
        filtered.map(pet => {

            const image =
                pet.image ||
                `${BACKEND}/pet-image/${encodeURIComponent(
                    pet.name
                )}`;

            return `
                <div class="petCard">

                    <img
                        class="petImage"
                        src="${safeUrl(image)}"
                        onerror="this.src='logo.png'"
                    >

                    <div>

                        <div class="petName">
                            ${escapeHtml(
                                pet.name
                            )}
                        </div>

                        <div class="petValue">
                            ${formatValue(
                                pet.value
                            )}
                        </div>

                    </div>

                </div>
            `;

        }).join("");
}


$("petSearch").oninput =
    renderPets;


/* =========================
   COINFLIP
========================= */

$("createCoinflipBtn").onclick = async () => {

    if(!currentUser || !authToken){

        message(
            "Sign in first to create a coinflip."
        );

        $("loginModal").classList.remove(
            "hidden"
        );

        return;
    }

    $("coinflipModal")
        .classList.remove("hidden");

    await loadInventory();
};


$("closeCoinflipBtn").onclick = () => {

    $("coinflipModal")
        .classList.add("hidden");
};


async function loadInventory(){

    $("createInventory").innerHTML =
        `<div class="loading">
            Loading inventory...
        </div>`;

    try{

        const data =
            await api("/inventory");

        const inventory =
            data.inventory || [];

        if(!inventory.length){

            $("createInventory").innerHTML =
                `<div class="empty">
                    You don't have any pets.
                </div>`;

            $("depositBtn")
                .classList.remove("hidden");

            return;
        }

        $("depositBtn")
            .classList.add("hidden");

        $("createInventory").innerHTML =
            inventory.map((pet,index) => {

                const image =
                    pet.image ||
                    `${BACKEND}/pet-image/${encodeURIComponent(
                        pet.name
                    )}`;

                return `
                    <button
                        class="inventoryPet"
                        data-index="${index}"
                    >

                        <img
                            src="${safeUrl(image)}"
                            onerror="this.src='logo.png'"
                        >

                        <div class="inventoryPetInfo">

                            <strong>
                                ${escapeHtml(
                                    pet.name
                                )}
                            </strong>

                            <div class="inventoryPetValue">
                                ${formatValue(
                                    pet.value
                                )}
                            </div>

                        </div>

                    </button>
                `;

            }).join("");

        document
            .querySelectorAll(".inventoryPet")
            .forEach((button,index) => {

                button.onclick = () => {

                    document
                        .querySelectorAll(
                            ".inventoryPet"
                        )
                        .forEach(x =>
                            x.classList.remove(
                                "selected"
                            )
                        );

                    button.classList.add(
                        "selected"
                    );

                    selectedPet =
                        inventory[index];
                };
            });

    }
    catch(error){

        message(error.message);

    }
}


document
    .querySelectorAll(".sideBtn")
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(".sideBtn")
                .forEach(x =>
                    x.classList.remove(
                        "selected"
                    )
                );

            button.classList.add(
                "selected"
            );

            selectedSide =
                button.dataset.side;
        };
    });


$("submitCoinflipBtn").onclick =
    async () => {

        if(!selectedPet){

            message(
                "Choose a pet first."
            );

            return;
        }

        if(!selectedSide){

            message(
                "Choose Heads or Tails."
            );

            return;
        }

        try{

            await api(
                "/coinflips",
                {
                    method:"POST",
                    body:JSON.stringify({
                        petId:selectedPet._id,
                        side:selectedSide
                    })
                }
            );

            selectedPet = null;
            selectedSide = null;

            $("coinflipModal")
                .classList.add("hidden");

            message(
                "Coinflip created."
            );

            loadCoinflips();

        }
        catch(error){

            message(error.message);

        }
    };


async function loadCoinflips(){

    $("coinflipList").innerHTML =
        `<div class="loading">
            Loading active coinflips...
        </div>`;

    try{

        const data =
            await api("/coinflips");

        const list =
            data.coinflips || [];

        if(!list.length){

            $("coinflipList").innerHTML =
                `<div class="empty">
                    No active coinflips yet.
                </div>`;

            return;
        }

        $("coinflipList").innerHTML =
            list.map(cf => {

                const image =
                    cf.pet?.image ||
                    `${BACKEND}/pet-image/${encodeURIComponent(
                        cf.pet?.name || ""
                    )}`;

                return `
                    <div class="coinflip">

                        <img
                            class="coinflipPet"
                            src="${safeUrl(image)}"
                            onerror="this.src='logo.png'"
                        >

                        <div class="coinflipInfo">

                            <div class="coinflipName">
                                ${escapeHtml(
                                    cf.username
                                )}
                            </div>

                            <div class="coinflipMeta">
                                ${escapeHtml(
                                    cf.pet?.name || "Pet"
                                )}
                                ·
                                ${formatValue(
                                    cf.pet?.value || 0
                                )}
                            </div>

                        </div>

                        <div class="sideBadge">
                            ${escapeHtml(
                                cf.side
                            )}
                        </div>

                    </div>
                `;

            }).join("");

    }
    catch(error){

        $("coinflipList").innerHTML =
            `<div class="empty">
                Unable to load coinflips.
            </div>`;

        console.log(error);
    }
}


/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard(){

    try{

        const data =
            await api("/leaderboard");

        const users =
            data.users || [];

        if(!users.length){

            $("leaderboardList").innerHTML =
                `<div class="empty">
                    No leaderboard data yet.
                </div>`;

            return;
        }

        $("leaderboardList").innerHTML =
            users.map((user,index) => {

                return `
                    <div class="leader">

                        <div class="rank">
                            #${index + 1}
                        </div>

                        <img
                            src="${safeUrl(
                                user.avatar ||
                                "logo.png"
                            )}"
                        >

                        <div class="leaderName">
                            ${escapeHtml(
                                user.username
                            )}
                        </div>

                        <div class="leaderValue">
                            ${formatValue(
                                user.wagered
                            )}
                        </div>

                    </div>
                `;

            }).join("");

    }
    catch(error){

        $("leaderboardList").innerHTML =
            `<div class="empty">
                Unable to load leaderboard.
            </div>`;
    }
}


/* =========================
   DEPOSIT
========================= */

$("depositBtn").onclick = () => {

    message(
        "Discord deposits are coming soon."
    );
};


/* =========================
   ONLINE COUNT
========================= */

async function loadOnline(){

    try{

        const data =
            await api("/status");

        if(
            typeof data.online === "number"
        ){

            $("onlineCount").textContent =
                data.online;
        }

    }
    catch{}
}


/* =========================
   SECURITY HELPERS
========================= */

function escapeHtml(value){

    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}


function safeUrl(url){

    const value =
        String(url || "");

    if(
        value.startsWith("https://") ||
        value.startsWith("http://") ||
        value.startsWith("/")
    ){

        return value;
    }

    return "logo.png";
}


function formatValue(value){

    const number =
        Number(value) || 0;

    return number.toLocaleString();
}


function formatTime(date){

    if(!date){
        return "";
    }

    const d =
        new Date(date);

    if(Number.isNaN(d.getTime())){
        return "";
    }

    return d.toLocaleTimeString(
        [],
        {
            hour:"2-digit",
            minute:"2-digit"
        }
    );
}


/* =========================
   START
========================= */

updateAccount();

showPage(currentPage);

if(chatOpen){
    openChat();
}

loadOnline();

setInterval(
    loadChat,
    8000
);

setInterval(
    loadOnline,
    30000
);
