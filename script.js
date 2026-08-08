const BACKEND =
    "https://admflip-new.onrender.com";


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


        const maintenance =
            document.getElementById(
                "maintenance"
            );

        const site =
            document.getElementById(
                "site"
            );

        const announcement =
            document.getElementById(
                "announcement"
            );


        if(!data.online){

            maintenance.classList.remove(
                "hidden"
            );

            site.style.display =
                "none";

        } else {

            maintenance.classList.add(
                "hidden"
            );

            site.style.display =
                "block";

        }


        if(data.announcement){

            announcement.classList.remove(
                "hidden"
            );

            announcement.textContent =
                "📢 " +
                data.announcement;

        } else {

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


checkSiteStatus();


setInterval(
    checkSiteStatus,
    15000
);





// ======================
// LOGIN
// ======================

const loginBtn =
    document.getElementById(
        "loginBtn"
    );

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );

const modal =
    document.getElementById(
        "modal"
    );

const usernameInput =
    document.getElementById(
        "username"
    );

const profile =
    document.getElementById(
        "profile"
    );

const phraseText =
    document.getElementById(
        "phrase"
    );

const verifyBtn =
    document.getElementById(
        "verify"
    );


let currentUser = null;

let phrase = "";


// ======================
// LOAD SAVED USER
// ======================

const savedUser =
    localStorage.getItem(
        "admflipUser"
    );


if(savedUser){

    try{

        currentUser =
            JSON.parse(
                savedUser
            );

        showUser();

    }
    catch(error){

        localStorage.removeItem(
            "admflipUser"
        );

    }

}





// ======================
// SHOW USER
// ======================

function showUser(){

    if(!currentUser)
        return;


    loginBtn.innerHTML = `

        <img src="${escapeAttribute(
            currentUser.avatar
        )}">

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


    updateChatLoginState();

    loadChat();

}





// ======================
// OPEN LOGIN
// ======================

loginBtn.onclick = ()=>{

    if(!currentUser){

        modal.classList.add(
            "show"
        );

    }

};





// ======================
// ROBLOX USER LOOKUP
// ======================

usernameInput.onchange =
async()=>{


    const username =
        usernameInput.value.trim();


    if(!username)
        return;


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
                src="${escapeAttribute(
                    currentUser.avatar
                )}"
            >

            <br><br>

            <b>
                ${escapeHtml(
                    currentUser.username
                )}
            </b>

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

            Put this phrase in your
            Roblox bio:

            <br><br>

            <b>
                ${escapeHtml(
                    phrase
                )}
            </b>

        `;


        verifyBtn.style.display =
            "block";


    }
    catch(error){

        console.log(error);

        alert(
            "Server error"
        );

    }

};





// ======================
// VERIFY
// ======================

verifyBtn.onclick =
async()=>{


    verifyBtn.disabled =
        true;

    verifyBtn.innerText =
        "Checking...";


    try{

        const response =
            await fetch(
                BACKEND + "/check",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({

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
                "Verified successfully"
            );


        }
        else{

            alert(
                "Verification phrase not found. Put it in your Roblox bio first."
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
            "Verification failed"
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

logoutBtn.onclick = ()=>{


    localStorage.removeItem(
        "admflipUser"
    );


    currentUser =
        null;


    phrase =
        "";


    loginBtn.innerHTML = `

        <img src="roblox.png">

        <span>
            Sign In
        </span>

    `;


    loginBtn.classList.remove(
        "logged"
    );


    logoutBtn.style.display =
        "none";


    updateChatLoginState();

};





// ======================
// CHAT
// ======================

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

const chatLoginMessage =
    document.getElementById(
        "chatLoginMessage"
    );


let lastChatSignature = "";


// ======================
// CHAT LOGIN STATE
// ======================

function updateChatLoginState(){

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
            "block";

    }

}





// ======================
// LOAD CHAT
// ======================

async function loadChat(){

    try{

        const response =
            await fetch(
                BACKEND + "/chat"
            );


        const data =
            await response.json();


        if(!data.success)
            return;


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
            "Chat load error:",
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


    for(
        const message of messages
    ){

        const row =
            document.createElement(
                "div"
            );


        row.className =
            message.type ===
            "announcement"
                ? "chat-message announcement-message"
                : "chat-message";


        const avatar =
            document.createElement(
                "img"
            );


        avatar.className =
            "chat-avatar";


        avatar.src =
            message.avatar ||
            "roblox.png";


        avatar.alt =
            "";


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


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}





// ======================
// BLOCK LINKS
// ======================

function containsLink(text){

    const linkPattern =
        /(?:https?:\/\/|http:\/\/|www\.|ftp:\/\/|discord\.gg\/|discord\.com\/invite\/|t\.me\/|bit\.ly\/|tinyurl\.com\/)/i;


    return linkPattern.test(
        text
    );

}





// ======================
// SEND CHAT
// ======================

chatForm.addEventListener(
    "submit",
    async(event)=>{

        event.preventDefault();


        if(!currentUser){

            alert(
                "You must be logged in to chat."
            );

            return;

        }


        const message =
            chatInput.value.trim();


        if(!message)
            return;


        if(message.length > 500){

            alert(
                "Message is too long."
            );

            return;

        }


        if(containsLink(message)){

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

                        method:"POST",

                        headers:{
                            "Content-Type":
                                "application/json"
                        },

                        body:JSON.stringify({

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

            console.log(
                "Chat send error:",
                error
            );

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
// CHAT REFRESH
// ======================

updateChatLoginState();

loadChat();


setInterval(
    loadChat,
    3000
);





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
