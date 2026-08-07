console.log("ADMFLIP loaded");

const chatBtn = document.getElementById("chatBtn");
const chatPanel = document.getElementById("chatPanel");

if(chatBtn && chatPanel){

    chatBtn.addEventListener("click", () => {
        chatPanel.classList.toggle("active");
    });

}


const online = document.getElementById("online");

if(online){

    setInterval(() => {

        const users = Math.floor(Math.random() * 24) + 32;

        online.innerText = "Online: " + users;

    },30000);

}



const loginBtn = document.getElementById("loginBtn");
const modal = document.getElementById("modal");


if(loginBtn && modal){

    loginBtn.onclick = () => {

        modal.classList.add("active");

    };

}
