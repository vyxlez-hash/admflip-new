const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const modal = document.getElementById("modal");

let phrase = "";
let verifyId = "";


loginBtn.onclick = async () => {

    modal.classList.add("show");

    const response = await fetch(
        BACKEND + "/create"
    );

    const data = await response.json();

    phrase = data.phrase;
    verifyId = data.id;

    document.getElementById("phrase").innerText =
    "Put this phrase in your Roblox bio: " + phrase;

};
