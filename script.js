const API = window.ADMFLIP_API || "https://admflip-new.onrender.com";

const $ = id => document.getElementById(id);

let currentUser = null;
let pets = [];
let selectedPet = null;
let selectedSide = null;
let tipUser = null;
let lastChatId = 0;

const savedSession = localStorage.getItem("admflipSession");

if(savedSession){
    try{
        currentUser = JSON.parse(savedSession);
    }catch{
        localStorage.removeItem("admflipSession");
    }
}

function escapeHtml(value){
    const d = document.createElement("div");
    d.textContent = String(value ?? "");
    return d.innerHTML;
}

function showToast(message){
    const el = $("toast");
    el.textContent = message;
    el.classList.remove("hidden");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(()=>{
        el.classList.add("hidden");
    },3000);
}

async function api(path, options = {}){
    const headers = {
        "Content-Type":"application/json",
        ...(options.headers || {})
    };

    if(currentUser?.token){
        headers.Authorization = `Bearer ${currentUser.token}`;
    }

    const response = await fetch(API + path,{
        ...options,
        headers
    });

    let data;

    try{
        data = await response.json();
    }catch{
        throw new Error("Server returned an invalid response.");
    }

    if(!response.ok){
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function saveSession(){
    if(currentUser){
        localStorage.setItem(
            "admflipSession",
            JSON.stringify(currentUser)
        );
    }
}

function updateAccount(){
    const login = $("loginBtn");
    const logout = $("logoutBtn");

    if(currentUser){
        login.innerHTML = `
            <img src="${escapeHtml(currentUser.avatar || "/roblox.png")}" alt="">
            <span>${escapeHtml(currentUser.username)}</span>
        `;

        logout.classList.remove("hidden");
    }else{
        login.innerHTML = `
            <img src="/roblox.png" alt="">
            <span>Sign In</span>
        `;

        logout.classList.add("hidden");
    }

    updateChatAuth();
}

function updateChatAuth(){
    const input = $("chatMessage");
    const send = $("sendChat");

    if(currentUser){
        input.disabled = false;
        send.disabled = false;
        input.placeholder = "Message...";
    }else{
        input.disabled = true;
        send.disabled = true;
        input.placeholder = "Sign in to chat...";
    }
}

function openLogin(){
    $("loginModal").classList.remove("hidden");
    $("username").focus();
}

function closeLogin(){
    $("loginModal").classList.add("hidden");
}

$("loginBtn").onclick = ()=>{
    if(currentUser){
        showPage("profile");
    }else{
        openLogin();
    }
};

$("logoutBtn").onclick = ()=>{
    currentUser = null;
    localStorage.removeItem("admflipSession");
    updateAccount();
    showToast("Signed out");
};

$("loginClose").onclick = closeLogin;

$("loginModal").addEventListener("click",e=>{
    if(e.target === $("loginModal")){
        closeLogin();
    }
});

let lookupTimer;

$("username").addEventListener("input",()=>{
    clearTimeout(lookupTimer);

    const username = $("username").value.trim();

    if(!username){
        $("profilePreview").innerHTML = "";
        $("phraseBox").innerHTML = "";
        return;
    }

    lookupTimer = setTimeout(async()=>{
        try{
            const data = await api(
                "/user/" + encodeURIComponent(username)
            );

            if(!data.success){
                $("profilePreview").innerHTML =
                    `<p class="loginHint">Roblox user not found.</p>`;
                return;
            }

            $("profilePreview").innerHTML = `
                <div class="profilePreview">
                    <img src="${escapeHtml(data.user.avatar)}">
                    <div>
                        <b>${escapeHtml(data.user.username)}</b>
                        <div class="loginHint">Roblox profile found</div>
                    </div>
                </div>
            `;

            const phrase = await api("/create");

            $("phraseBox").innerHTML = `
                <div class="rulesBox">
                    Put <b>${escapeHtml(phrase.phrase)}</b>
                    in your Roblox bio, then press Continue.
                </div>
            `;

            $("verifyBtn").dataset.username = data.user.username;
            $("verifyBtn").dataset.phrase = phrase.phrase;
            $("verifyBtn").dataset.avatar = data.user.avatar;
            $("verifyBtn").dataset.id = data.user.id;

        }catch(error){
            showToast(error.message);
        }
    },500);
});

$("verifyBtn").onclick = async()=>{
    const username = $("verifyBtn").dataset.username;
    const phrase = $("verifyBtn").dataset.phrase;

    if(!username || !phrase){
        showToast("Enter your Roblox username first.");
        return;
    }

    $("verifyBtn").disabled = true;
    $("verifyBtn").textContent = "Checking...";

    try{
        const data = await api("/check",{
            method:"POST",
            body:JSON.stringify({
                username,
                phrase
            })
        });

        if(!data.success){
            throw new Error(
                data.message || "Verification phrase not found."
            );
        }

        currentUser = {
            token:data.token,
            id:data.user.id,
            username:data.user.username,
            avatar:data.user.avatar
        };

        saveSession();
        updateAccount();
        closeLogin();

        await loadInventory();

        showToast("Roblox account verified.");
        showPage("home");

    }catch(error){
        showToast(error.message);
    }finally{
        $("verifyBtn").disabled = false;
        $("verifyBtn").textContent = "Continue";
    }
};

function showPage(page){
    document.querySelectorAll(".page").forEach(x=>{
        x.classList.add("hidden");
    });

    const target = $(page + "Page");

    if(target){
        target.classList.remove("hidden");
    }

    localStorage.setItem("admflipPage",page);

    if(page === "values") loadValues();
    if(page === "coinflip") loadCoinflips();
    if(page === "leaderboard") loadLeaderboard();
    if(page === "profile") loadProfile();

    if(page === "home"){
        history.replaceState(null,"","#/");
    }else{
        history.replaceState(null,"","#/"+page);
    }
}

document.querySelectorAll("[data-page]").forEach(button=>{
    button.onclick = ()=>{
        showPage(button.dataset.page);
    };
});

$("chatTop").onclick = ()=>{
    $("chatPanel").classList.toggle("mobileOpen");
};

$("mobileChatButton").onclick = ()=>{
    $("chatPanel").classList.toggle("mobileOpen");
};

$("chatClose").onclick = ()=>{
    $("chatPanel").classList.remove("mobileOpen");
};

$("rulesBtn").onclick = ()=>{
    $("rulesBox").classList.toggle("hidden");
};

async function loadValues(){
    try{
        const data = await api("/pets");
        pets = data.pets || [];
        renderValues(pets);
    }catch(error){
        $("petGrid").innerHTML = `
            <div class="rulesBox">
                Values are temporarily unavailable.
            </div>
        `;
    }
}

function renderValues(list){
    if(!list.length){
        $("petGrid").innerHTML =
            `<div class="rulesBox">No pets found.</div>`;
        return;
    }

    $("petGrid").innerHTML = list.map(petCard).join("");
}

function petImage(pet){
    return pet.image || "";
}

function petCard(pet){
    const image = petImage(pet);

    return `
        <div class="petCard">
            ${
                image
                ? `<img class="petImage"
                    src="${escapeHtml(image)}"
                    onerror="this.remove()">`
                : ""
            }

            <div class="petName">${escapeHtml(pet.name)}</div>

            <div class="petValue">
                ${Number(pet.value || 0).toLocaleString()}
            </div>

            <div class="petMeta">
                ${escapeHtml(pet.rarity || "Unknown")}
            </div>

            ${
                pet.neon
                ? `<span class="variant">NEON</span>`
                : ""
            }

            ${
                pet.mega
                ? `<span class="variant">MEGA</span>`
                : ""
            }

            ${
                pet.fly
                ? `<span class="variant">FLY</span>`
                : ""
            }

            ${
                pet.ride
                ? `<span class="variant">RIDE</span>`
                : ""
            }
        </div>
    `;
}

$("valueSearch").addEventListener("input",e=>{
    const query = e.target.value.toLowerCase();

    renderValues(
        pets.filter(p =>
            p.name.toLowerCase().includes(query)
        )
    );
});

async function loadCoinflips(){
    try{
        const data = await api("/coinflips");

        if(!data.coinflips.length){
            $("coinflipList").innerHTML = `
                <div class="rulesBox">
                    No active coinflips yet.
                </div>
            `;
            return;
        }

        $("coinflipList").innerHTML =
            data.coinflips.map(cf=>`
                <div class="coinflip">
                    ${
                        cf.pet.image
                        ? `<img class="coinflipPet"
                            src="${escapeHtml(cf.pet.image)}"
                            onerror="this.remove()">`
                        : ""
                    }

                    <div class="coinflipInfo">
                        <b>${escapeHtml(cf.pet.name)}</b>

                        <div class="coinflipUser">
                            ${escapeHtml(cf.owner.username)}
                            • ${escapeHtml(cf.side.toUpperCase())}
                        </div>

                        <div class="coinflipValue">
                            ${Number(cf.pet.value).toLocaleString()} value
                        </div>
                    </div>

                    ${
                        currentUser &&
                        currentUser.id === cf.owner.id
                        ? `<button class="secondary"
                            onclick="watchCoinflip('${cf.id}')">
                            ◉
                           </button>`
                        : `<button class="primary"
                            onclick="joinCoinflip('${cf.id}')">
                            Join
                           </button>`
                    }
                </div>
            `).join("");

    }catch(error){
        $("coinflipList").innerHTML =
            `<div class="rulesBox">${escapeHtml(error.message)}</div>`;
    }
}

window.watchCoinflip = async(id)=>{
    try{
        const data = await api("/coinflips/" + id);
        showToast(
            data.coinflip.joined
            ? "Someone joined your coinflip."
            : "Waiting for another trader."
        );
    }catch(error){
        showToast(error.message);
    }
};

window.joinCoinflip = async(id)=>{
    if(!currentUser){
        openLogin();
        return;
    }

    try{
        const data = await api(
            "/coinflips/" + id + "/join",
            {
                method:"POST"
            }
        );

        await runFlip(data.result);
    }catch(error){
        showToast(error.message);
    }
};

$("createBtn").onclick = async()=>{
    if(!currentUser){
        openLogin();
        return;
    }

    $("createModal").classList.remove("hidden");
    selectedPet = null;
    selectedSide = null;

    $("sideChooser").classList.add("hidden");
    $("postCoinflip").disabled = true;

    await loadCreateInventory();
};

$("createClose").onclick = ()=>{
    $("createModal").classList.add("hidden");
};

async function loadCreateInventory(){
    try{
        const data = await api("/inventory");

        if(!data.inventory.length){
            $("createInventory").innerHTML = `
                <div class="rulesBox">
                    You have no pets.
                    <br><br>
                    <button class="primary"
                        onclick="depositPets()">
                        Deposit
                    </button>
                    <p>Discord deposit is currently the safe temporary option.</p>
                </div>
            `;
            return;
        }

        $("createInventory").innerHTML =
            data.inventory.map(p=>`
                <div class="miniPet"
                    data-pet-id="${escapeHtml(p.instanceId)}"
                    onclick="selectCreatePet('${escapeHtml(p.instanceId)}')">

                    ${
                        p.image
                        ? `<img src="${escapeHtml(p.image)}"
                            onerror="this.remove()">`
                        : ""
                    }

                    <div class="miniPetName">
                        ${escapeHtml(p.name)}
                    </div>

                    <div class="miniPetValue">
                        ${Number(p.value).toLocaleString()}
                    </div>
                </div>
            `).join("");

    }catch(error){
        showToast(error.message);
    }
}

window.selectCreatePet = async(instanceId)=>{
    document.querySelectorAll("#createInventory .miniPet")
        .forEach(x=>x.classList.remove("selected"));

    const el =
        document.querySelector(
            `[data-pet-id="${CSS.escape(instanceId)}"]`
        );

    if(el) el.classList.add("selected");

    try{
        const data = await api("/inventory");

        selectedPet =
            data.inventory.find(x=>x.instanceId === instanceId);

        if(!selectedPet) return;

        $("selectedPetBox").innerHTML = `
            <div class="rulesBox">
                Selected:
                <b>${escapeHtml(selectedPet.name)}</b>
                —
                ${Number(selectedPet.value).toLocaleString()} value
            </div>
        `;

        $("sideChooser").classList.remove("hidden");

    }catch(error){
        showToast(error.message);
    }
};

document.querySelectorAll("#sideChooser button").forEach(button=>{
    button.onclick = ()=>{
        selectedSide = button.dataset.side;

        document.querySelectorAll("#sideChooser button")
            .forEach(x=>x.classList.remove("selected"));

        button.classList.add("selected");

        $("postCoinflip").disabled =
            !selectedPet || !selectedSide;
    };
});

$("postCoinflip").onclick = async()=>{
    if(!selectedPet || !selectedSide){
        return;
    }

    $("postCoinflip").disabled = true;

    try{
        await api("/coinflips",{
            method:"POST",
            body:JSON.stringify({
                instanceId:selectedPet.instanceId,
                side:selectedSide
            })
        });

        $("createModal").classList.add("hidden");

        showToast("Coinflip posted.");
        showPage("coinflip");

    }catch(error){
        showToast(error.message);
        $("postCoinflip").disabled = false;
    }
};

async function runFlip(result){
    $("flipModal").classList.remove("hidden");

    const coin = $("flipCoin");
    const status = $("flipStatus");

    coin.classList.add("flipping");
    coin.textContent = "?";
    status.textContent = "Flipping...";

    await new Promise(resolve=>setTimeout(resolve,2500));

    coin.classList.remove("flipping");
    coin.textContent = result.winningSide.toUpperCase();

    if(result.winnerId === currentUser.id){
        status.textContent =
            `You won ${result.pet.name}!`;
    }else{
        status.textContent =
            `${result.winnerUsername} won ${result.pet.name}.`;
    }

    await new Promise(resolve=>setTimeout(resolve,2200));

    $("flipModal").classList.add("hidden");

    await loadInventory();
    await loadCoinflips();
};

$("historyBtn").onclick = async()=>{
    if(!currentUser){
        openLogin();
        return;
    }

    try{
        const data = await api("/coinflips/history");

        $("coinflipList").innerHTML =
            data.history.map(x=>`
                <div class="coinflip">
                    <div class="coinflipInfo">
                        <b>${escapeHtml(x.pet.name)}</b>
                        <div class="coinflipUser">
                            ${escapeHtml(x.result)}
                        </div>
                    </div>
                </div>
            `).join("") ||
            `<div class="rulesBox">No history.</div>`;

    }catch(error){
        showToast(error.message);
    }
};

async function loadLeaderboard(){
    try{
        const data = await api("/leaderboard");

        $("leaderboard").innerHTML =
            data.players.map((p,i)=>`
                <div class="leader">
                    <div class="place">${i+1}</div>

                    <img src="${escapeHtml(p.avatar || "/roblox.png")}"
                         alt="">

                    <div class="leaderInfo">
                        <b>${escapeHtml(p.username)}</b>
                    </div>

                    <div class="leaderValue">
                        ${Number(p.wagered).toLocaleString()}
                    </div>
                </div>
            `).join("");
    }catch(error){
        $("leaderboard").innerHTML =
            `<div class="rulesBox">${escapeHtml(error.message)}</div>`;
    }
}

async function loadInventory(){
    if(!currentUser) return;

    try{
        const data = await api("/inventory");

        currentUser.inventory = data.inventory;
        saveSession();
    }catch(error){
        console.error(error);
    }
}

async function loadProfile(){
    if(!currentUser){
        openLogin();
        return;
    }

    await loadInventory();

    const inventory = currentUser.inventory || [];

    $("profileContent").innerHTML = `
        <div class="pageTitle">
            <div>
                <small>PROFILE</small>
                <h2>${escapeHtml(currentUser.username)}</h2>
            </div>
        </div>

        <div class="rulesBox">
            <div class="profilePreview">
                <img src="${escapeHtml(currentUser.avatar)}">
                <div>
                    <b>${escapeHtml(currentUser.username)}</b>
                    <div>${inventory.length} pets</div>
                </div>
            </div>

            <br>

            <button class="primary" onclick="depositPets()">
                Deposit
            </button>

            <button class="secondary" onclick="withdrawPets()">
                Withdraw
            </button>
        </div>

        <div class="petGrid">
            ${inventory.map(petCard).join("")}
        </div>
    `;
}

window.depositPets = ()=>{
    showToast("Temporary deposit: use Discord support until the automatic bot is enabled.");
};

window.withdrawPets = ()=>{
    showToast("Withdrawals are currently handled through the temporary safe flow.");
};

async function sendChat(){
    if(!currentUser){
        openLogin();
        return;
    }

    const input = $("chatMessage");
    const message = input.value.trim();

    if(!message) return;

    try{
        await api("/chat",{
            method:"POST",
            body:JSON.stringify({message})
        });

        input.value = "";
        await loadChat();

    }catch(error){
        showToast(error.message);
    }
}

$("sendChat").onclick = sendChat;

$("chatMessage").addEventListener("keydown",e=>{
    if(e.key === "Enter"){
        sendChat();
    }
});

async function loadChat(){
    try{
        const data = await api("/chat");

        $("onlineCount").textContent =
            `${data.online} online`;

        const list = data.messages || [];

        $("messages").innerHTML = list.map(m=>`
            <div class="message">
                <div class="messageTop">
                    <img src="${escapeHtml(m.avatar || "/roblox.png")}"
                         alt="">

                    <button onclick="openUserProfile('${escapeHtml(m.userId)}')">
                        ${escapeHtml(m.username)}
                    </button>
                </div>

                <div class="messageText">
                    ${escapeHtml(m.message)}
                </div>
            </div>
        `).join("");

        const box = $("messages");

        if(!lastChatId){
            box.scrollTop = box.scrollHeight;
        }

        lastChatId =
            list.length ? list[list.length-1].id : 0;

    }catch(error){
        console.error(error);
    }
}

window.openUserProfile = async(userId)=>{
    try{
        const data = await api(
            "/users/" + encodeURIComponent(userId)
        );

        $("profileContent").innerHTML = `
            <div class="pageTitle">
                <div>
                    <small>TRADER</small>
                    <h2>${escapeHtml(data.user.username)}</h2>
                </div>
            </div>

            <div class="rulesBox">
                <div class="profilePreview">
                    <img src="${escapeHtml(data.user.avatar)}">
                    <div>
                        <b>${escapeHtml(data.user.username)}</b>
                    </div>
                </div>

                <br>

                <div>
                    Wagered:
                    <b>${Number(data.user.wagered).toLocaleString()}</b>
                </div>

                <div>
                    Profit:
                    <b>${Number(data.user.profit).toLocaleString()}</b>
                </div>

                <button class="primary"
                    onclick="openTip('${escapeHtml(data.user.id)}','${escapeHtml(data.user.username)}')">
                    Tip
                </button>
            </div>
        `;

        showPage("profile");

    }catch(error){
        showToast(error.message);
    }
};

window.openTip = async(userId,username)=>{
    if(!currentUser){
        openLogin();
        return;
    }

    tipUser = {
        id:userId,
        username
    };

    $("tipTo").textContent =
        `Choose a pet to tip ${username}.`;

    $("tipModal").classList.remove("hidden");

    try{
        const data = await api("/inventory");

        $("tipInventory").innerHTML =
            data.inventory.map(p=>`
                <div class="miniPet"
                    onclick="confirmTip('${escapeHtml(p.instanceId)}')">

                    ${
                        p.image
                        ? `<img src="${escapeHtml(p.image)}"
                            onerror="this.remove()">`
                        : ""
                    }

                    <div class="miniPetName">
                        ${escapeHtml(p.name)}
                    </div>

                    <div class="miniPetValue">
                        ${Number(p.value).toLocaleString()}
                    </div>
                </div>
            `).join("");

    }catch(error){
        showToast(error.message);
    }
};

window.confirmTip = async(instanceId)=>{
    if(!tipUser) return;

    if(!confirm(`Tip this pet to ${tipUser.username}?`)){
        return;
    }

    try{
        await api("/tip",{
            method:"POST",
            body:JSON.stringify({
                receiverId:tipUser.id,
                instanceId
            })
        });

        $("tipModal").classList.add("hidden");

        await loadInventory();

        showToast("Pet tipped successfully.");

    }catch(error){
        showToast(error.message);
    }
};

$("tipClose").onclick = ()=>{
    $("tipModal").classList.add("hidden");
};

async function boot(){
    updateAccount();

    const savedPage =
        localStorage.getItem("admflipPage") || "home";

    showPage(savedPage);

    await loadValues();
    await loadChat();

    setInterval(loadChat,5000);

    /*
      Online count changes only once every 100 seconds,
      and stays between 20 and 45.
    */
    setInterval(async()=>{
        try{
            await api("/presence",{
                method:"POST"
            });

            await loadChat();
        }catch{}
    },100000);

    /*
      Validate stored session after refresh.
    */
    if(currentUser){
        try{
            const data = await api("/session");

            currentUser = data.user;
            saveSession();
            updateAccount();

        }catch{
            currentUser = null;
            localStorage.removeItem("admflipSession");
            updateAccount();
        }
    }
}

boot();
