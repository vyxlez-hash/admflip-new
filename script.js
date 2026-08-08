const BACKEND =
    "https://admflip-new.onrender.com";


// ======================
// ELEMENTS
// ======================

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

const chatPanel =
    document.getElementById("chatPanel");

const mobileChatButton =
    document.getElementById("mobileChatButton");

const mobileChatClose =
    document.getElementById("mobileChatClose");

const chatMessages =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatLoginMessage =
    document.getElementById(
        "chatLoginMessage"
    );

const announcement =
    document.getElementById(
        "announcement"
    );

const maintenance =
    document.getElementById(
        "maintenance"
    );

const site =
    document.getElementById(
        "site"
    );


// ======================
// USER
// ======================

let currentUser = null;

let phrase = "";

let lastChatSignature = "";


// ======================
// LOAD SAVED USER
// ======================

function loadSavedUser(){

    const saved =
        localStorage.getItem(
            "admflipUser"
        );


    if(!saved){

        updateLoginUI();

        updateChatUI();

        return;

    }


    try{

        const parsed =
            JSON.parse(saved);


        if(
            parsed &&
            parsed.id &&
            parsed.username
        ){

            currentUser =
                parsed;

        }

    }
    catch(error){

        console.log(
            "Saved login error:",
            error
        );

        localStorage.removeItem(
            "admflipUser"
        );

    }


    updateLoginUI();

    updateChatUI();

}


// ======================
// LOGIN UI
// ======================

function updateLoginUI(){

    if(currentUser){

        loginBtn.innerHTML = `

            <img
                src="${escapeAttribute(
                    currentUser.avatar || "roblox.png"
                )}"
                alt=""
            >

            <span>
                ${escapeHtml(
                    currentUser.username
                )}
            </span>

        `;

        loginBtn.classList.add(
            "logged"
        );


        logoutBtn.style.display =
            "block";

    }
    else{

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

    }

}


// ======================
// OPEN LOGIN
// ======================

loginBtn.onclick = () => {

    if(currentUser){

        return;

    }


    modal.classList.add(
        "show"
    );

};


// ======================
// CLOSE LOGIN
// ======================

modalClose.onclick = () => {

    modal.classList.remove(
        "show"
    );

};


modal.addEventListener(
    "click",
    (event) => {

        if(
            event.target ===
            modal
        ){

            modal.classList.remove(
                "show"
            );

        }

    }
);


// ======================
// ROBLOX USER LOOKUP
// ======================

usernameInput.onchange =
async () => {

    const username =
        usernameInput.value.trim();


    if(!username){

        return;

    }


    try{

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


        if(!data.success){

            alert(
                "Roblox username not found."
            );

            return;

        }


        currentUser =
            data.user;


        profile.classList.remove(
            "hidden"
        );


        profile.innerHTML = `

            <div class="profile-card">

                <img
                    src="${escapeAttribute(
                        currentUser.avatar
                    )}"
                    alt=""
                >

                <div>

                    <strong>
                        ${escapeHtml(
                            currentUser.username
                        )}
                    </strong>

                    <span>
                        Roblox account found
                    </span>

                </div>

            </div>

        `;


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

            <div class="phrase-box">

                <span>
                    Put this phrase in your Roblox bio:
                </span>

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

        console.log(error);

        alert(
            "Server error."
        );

    }

};


// ======================
// VERIFY
// ======================

verifyBtn.onclick =
async () => {

    if(!currentUser){

        return;

    }


    verifyBtn.disabled =
        true;

    verifyBtn.innerText =
        "Checking...";


    try{

        const response =
            await fetch(
                BACKEND + "/check",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        username:
                            currentUser.username,

                        phrase:
                            phrase

                    })

                }
            );


        const data =
            await response.json();


        if(data.success){

            currentUser.id =
                data.id;


            currentUser.username =
                data.username;


            localStorage.setItem(
                "admflipUser",
                JSON.stringify(
                    currentUser
                )
            );


            modal.classList.remove(
                "show"
            );


            updateLoginUI();

            updateChatUI();

            await loadChat();


            alert(
                "Verified successfully."
            );

        }
        else{

            alert(
                data.message ||
                "Verification phrase not found."
            );


            verifyBtn.disabled =
                false;

            verifyBtn.innerText =
                "Verify";

        }

    }
    catch(error){

        console.log(error);

        alert(
            "Verification failed."
        );


        verifyBtn.disabled =
            false;

        verifyBtn.innerText =
            "Verify";

    }

};


// ======================
// LOGOUT
// ======================

logoutBtn.onclick = () => {

    localStorage.removeItem(
        "admflipUser"
    );


    currentUser =
        null;


    phrase =
        "";


    updateLoginUI();

    updateChatUI();

};


// ======================
// CHAT UI
// ======================

function updateChatUI(){

    if(currentUser){

        chatForm.style.display =
            "flex";

        chatLoginMessage.style.display =
            "none";

    }
    else{

        chatForm.style.display =
            "none";

        chatLoginMessage.style.display =
            "flex";

    }

}


// ======================
// MOBILE CHAT
// ======================

mobileChatButton.onclick =
() => {

    chatPanel.classList.add(
        "mobile-open"
    );

};


mobileChatClose.onclick =
() => {

    chatPanel.classList.remove(
        "mobile-open"
    );

};


// Close mobile chat when clicking outside

document.addEventListener(
    "click",
    (event) => {

        if(
            window.innerWidth > 700
        ){

            return;

        }


        if(
            !chatPanel.contains(
                event.target
            ) &&
            !mobileChatButton.contains(
                event.target
            )
        ){

            chatPanel.classList.remove(
                "mobile-open"
            );

        }

    }
);


// ======================
// LOAD CHAT
// ======================

async function loadChat(){

    try{

        const response =
            await fetch(
                BACKEND + "/chat"
            );


        if(!response.ok){

            return;

        }


        const data =
            await response.json();


        if(
            !data.success
        ){

            return;

        }


        const messages =
            data.messages || [];


        const signature =
            messages
                .map(
                    message =>
                        message._id
                )
                .join(",");


        if(
            signature ===
            lastChatSignature
        ){

            return;

        }


        lastChatSignature =
            signature;


        renderChat(
            messages
        );

    }
    catch(error){

        console.log(
            "Chat error:",
            error
        );

    }

}


// ======================
// RENDER CHAT
// ======================

function renderChat(messages){

    chatMessages.innerHTML =
        "";


    messages.forEach(
        (message) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "chat-message";


            if(
                message.type ===
                "announcement"
            ){

                row.classList.add(
                    "announcement-message"
                );

            }


            const avatar =
                document.createElement(
                    "img"
                );


            avatar.className =
                "chat-avatar";


            avatar.src =
                message.avatar ||
                "roblox.png";


            avatar.onerror =
                () => {

                    avatar.src =
                        "roblox.png";

                };


            const content =
                document.createElement(
                    "div"
                );


            content.className =
                "chat-content";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "chat-name";


            name.textContent =
                message.username ||
                "User";


            const text =
                document.createElement(
                    "div"
                );


            text.className =
                "chat-text";


            // textContent prevents HTML injection

            text.textContent =
                message.message;


            content.appendChild(
                name
            );


            content.appendChild(
                text
            );


            row.appendChild(
                avatar
            );


            row.appendChild(
                content
            );


            chatMessages.appendChild(
                row
            );

        }
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


// ======================
// LINK FILTER
// ======================

function containsLink(text){

    const pattern =
        /(?:https?:\/\/|http:\/\/|www\.|ftp:\/\/|discord\.gg\/|discord\.com\/invite\/|t\.me\/|telegram\.me\/|bit\.ly\/|tinyurl\.com\/|t\.co\/|youtu\.be\/|youtube\.com\/)/i;


    return pattern.test(
        text
    );

}


// ======================
// SEND MESSAGE
// ======================

chatForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        if(!currentUser){

            alert(
                "You must be logged in to chat."
            );

            return;

        }


        const message =
            chatInput.value.trim();


        if(!message){

            return;

        }


        if(
            message.length > 500
        ){

            alert(
                "Message cannot be longer than 500 characters."
            );

            return;

        }


        if(
            containsLink(
                message
            )
        ){

            alert(
                "Links are not allowed in chat."
            );

            return;

        }


        chatInput.disabled =
            true;


        try{

            const response =
                await fetch(
                    BACKEND + "/chat",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body: JSON.stringify({

                            username:
                                currentUser.username,

                            avatar:
                                currentUser.avatar,

                            message:
                                message

                        })

                    }
                );


            const data =
                await response.json();


            if(!data.success){

                alert(
                    data.message ||
                    "Could not send message."
                );

                return;

            }


            chatInput.value =
                "";


            lastChatSignature =
                "";


            await loadChat();

        }
        catch(error){

            console.log(error);

            alert(
                "Could not send message."
            );

        }
        finally{

            chatInput.disabled =
                false;

            chatInput.focus();

        }

    }
);


// ======================
// SITE STATUS
// ======================

async function checkSiteStatus(){

    try{

        const response =
            await fetch(
                BACKEND + "/status"
            );


        const data =
            await response.json();


        if(
            data.online === false
        ){

            maintenance.classList.remove(
                "hidden"
            );

            site.style.display =
                "none";

        }
        else{

            maintenance.classList.add(
                "hidden"
            );

            site.style.display =
                "block";

        }


        if(
            data.announcement
        ){

            announcement.classList.remove(
                "hidden"
            );

            announcement.textContent =
                "📢 " +
                data.announcement;

        }
        else{

            announcement.classList.add(
                "hidden"
            );

        }

    }
    catch(error){

        console.log(
            "Status error:",
            error
        );

    }

}


// ======================
// SECURITY HELPERS
// ======================

function escapeHtml(value){

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value){

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

}


// ======================
// START
// ======================

loadSavedUser();

loadChat();

checkSiteStatus();


// Refresh chat every 3 seconds

setInterval(
    loadChat,
    3000
);


// Check site status every 15 sec

setInterval(
    checkSiteStatus,
    15000
);
