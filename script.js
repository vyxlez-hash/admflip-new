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

const chatMessages =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatLoginMessage =
    document.getElementById("chatLoginMessage");

const petList =
    document.getElementById("petList");

const valueSearch =
    document.getElementById("valueSearch");

const announcement =
    document.getElementById("announcement");

const maintenance =
    document.getElementById("maintenance");

const mobileMenuButton =
    document.getElementById(
        "mobileMenuButton"
    );

const mobileMenu =
    document.getElementById(
        "mobileMenu"
    );


// ======================
// STATE
// ======================

let currentUser = null;

let phrase = "";

let pets = [];

let lastChatSignature = "";


// ======================
// PAGES
// ======================

const pages = {

    coinflip:
        document.getElementById(
            "coinflipPage"
        ),

    leaderboard:
        document.getElementById(
            "leaderboardPage"
        ),

    chat:
        document.getElementById(
            "chatPage"
        ),

    values:
        document.getElementById(
            "valuesPage"
        )

};


const homePage =
    document.getElementById(
        "homePage"
    );


// ======================
// NAVIGATION
// ======================

function openPage(page){

    homePage.classList.remove(
        "active-page"
    );


    Object.values(pages).forEach(
        element => {

            element.classList.remove(
                "active-page"
            );

        }
    );


    if(page === "coinflip"){

        pages.coinflip.classList.add(
            "active-page"
        );

    }
    else if(page === "leaderboard"){

        pages.leaderboard.classList.add(
            "active-page"
        );

    }
    else if(page === "chat"){

        pages.chat.classList.add(
            "active-page"
        );

        loadChat();

    }
    else if(page === "values"){

        pages.values.classList.add(
            "active-page"
        );

        loadPets();

    }
    else{

        homePage.classList.add(
            "active-page"
        );

    }


    mobileMenu.classList.remove(
        "show"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


document.querySelectorAll(
    "[data-page]"
).forEach(
    link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                openPage(
                    link.dataset.page
                );

            }
        );

    }
);


// ======================
// CLOSE BUTTONS
// ======================

document.getElementById(
    "closeChat"
).onclick = () => {

    openPage("coinflip");

};


document.getElementById(
    "closeValues"
).onclick = () => {

    openPage("coinflip");

};


document.getElementById(
    "viewValuesButton"
).onclick = () => {

    openPage("values");

};


// ======================
// MOBILE MENU
// ======================

mobileMenuButton.onclick =
() => {

    mobileMenu.classList.toggle(
        "show"
    );

};


// ======================
// LOGIN
// ======================

function loadSavedUser(){

    const saved =
        localStorage.getItem(
            "admflipUser"
        );


    if(saved){

        try{

            currentUser =
                JSON.parse(saved);

        }
        catch{

            localStorage.removeItem(
                "admflipUser"
            );

        }

    }


    updateLoginUI();

    updateChatUI();

}


function updateLoginUI(){

    if(currentUser){

        loginBtn.innerHTML = `

            <img
                src="${escapeAttribute(
                    currentUser.avatar ||
                    "roblox.png"
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


        logoutBtn.style.display =
            "none";

    }

}


loginBtn.onclick = () => {

    if(!currentUser){

        modal.classList.add(
            "show"
        );

    }

};


modalClose.onclick = () => {

    modal.classList.remove(
        "show"
    );

};


modal.onclick = event => {

    if(
        event.target === modal
    ){

        modal.classList.remove(
            "show"
        );

    }

};


// ======================
// ROBLOX LOOKUP
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


            updateLoginUI();

            updateChatUI();


            modal.classList.remove(
                "show"
            );


            alert(
                "Verified successfully!"
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


    currentUser = null;

    phrase = "";


    updateLoginUI();

    updateChatUI();

};


// ======================
// CHAT LOGIN
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


        if(!data.success){

            return;

        }


        const messages =
            data.messages || [];


        const signature =
            messages.map(
                message =>
                    message._id
            ).join(",");


        if(
            signature ===
            lastChatSignature
        ){

            return;

        }


        lastChatSignature =
            signature;


        chatMessages.innerHTML =
            "";


        messages.forEach(
            message => {

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


                const body =
                    document.createElement(
                        "div"
                    );


                body.className =
                    "chat-body";


                const name =
                    document.createElement(
                        "strong"
                    );


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


                body.appendChild(
                    name
                );

                body.appendChild(
                    text
                );


                row.appendChild(
                    avatar
                );

                row.appendChild(
                    body
                );


                chatMessages.appendChild(
                    row
                );

            }
        );


        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    }
    catch(error){

        console.log(
            "Chat error:",
            error
        );

    }

}


// ======================
// LINK FILTER
// ======================

function containsLink(text){

    return /(?:https?:\/\/|http:\/\/|www\.|ftp:\/\/|discord\.gg\/|discord\.com\/invite\/|t\.me\/|telegram\.me\/|bit\.ly\/|tinyurl\.com\/|youtu\.be\/|youtube\.com\/)/i
        .test(text);

}


// ======================
// SEND CHAT
// ======================

chatForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if(!currentUser){

            return;

        }


        const message =
            chatInput.value.trim();


        if(!message){

            return;

        }


        if(containsLink(message)){

            alert(
                "Links are not allowed in chat."
            );

            return;

        }


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

                        body:
                            JSON.stringify({

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

    }
);


// ======================
// PET VALUES
// ======================

async function loadPets(){

    petList.innerHTML = `

        <div class="loading">
            Loading pet values...
        </div>

    `;


    try{

        const response =
            await fetch(
                BACKEND + "/pets"
            );


        const data =
            await response.json();


        if(
            !data.success
        ){

            throw new Error(
                "Could not load pets"
            );

        }


        pets =
            data.pets || [];


        renderPets(
            pets
        );

    }
    catch(error){

        console.log(error);

        petList.innerHTML = `

            <div class="loading">
                Could not load pet values.
            </div>

        `;

    }

}


// ======================
// RENDER PETS
// ======================

function renderPets(list){

    petList.innerHTML =
        "";


    if(!list.length){

        petList.innerHTML = `

            <div class="loading">
                No pets found.
            </div>

        `;

        return;

    }


    list.forEach(
        pet => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "pet-item";


            const image =
                document.createElement(
                    "img"
                );


            image.className =
                "pet-image";


            image.src =
                pet.image ||
                pet.imageUrl ||
                "pet-placeholder.png";


            image.onerror =
                () => {

                    image.src =
                        "pet-placeholder.png";

                };


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "pet-info";


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                pet.name;


            const value =
                document.createElement(
                    "span"
                );


            value.textContent =
                formatValue(
                    pet.value
                );


            info.appendChild(
                name
            );

            info.appendChild(
                value
            );


            item.appendChild(
                image
            );

            item.appendChild(
                info
            );


            petList.appendChild(
                item
            );

        }
    );

}


// ======================
// SEARCH VALUES
// ======================

valueSearch.addEventListener(
    "input",
    () => {

        const search =
            valueSearch.value
                .trim()
                .toLowerCase();


        const filtered =
            pets.filter(
                pet =>
                    pet.name
                        .toLowerCase()
                        .includes(search)
            );


        renderPets(
            filtered
        );

    }
);


// ======================
// VALUE FORMAT
// ======================

function formatValue(value){

    const number =
        Number(value);


    if(
        Number.isNaN(number)
    ){

        return String(value);

    }


    return number.toLocaleString();

}


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

        }
        else{

            maintenance.classList.add(
                "hidden"
            );

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

        console.log(error);

    }

}


// ======================
// SECURITY
// ======================

function escapeHtml(value){

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(value){

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );

}


// ======================
// START
// ======================

loadSavedUser();

checkSiteStatus();


// Chat refresh

setInterval(
    () => {

        if(
            pages.chat.classList.contains(
                "active-page"
            )
        ){

            loadChat();

        }

    },
    3000
);


// Status refresh

setInterval(
    checkSiteStatus,
    15000
);
