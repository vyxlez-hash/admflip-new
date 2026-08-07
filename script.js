const chatBtn = document.getElementById("chatBtn");
const chatPanel = document.getElementById("chatPanel");

chatBtn.onclick = () =>{
    chatPanel.classList.toggle("active");
};


setInterval(()=>{

let number = Math.floor(Math.random()*24)+32;

document.getElementById("online").innerText =
"Online: " + number;

},30000);



const modal=document.getElementById("modal");

document.getElementById("loginBtn").onclick=()=>{

modal.classList.add("active");

};



let phrase="";


document.getElementById("generate").onclick=()=>{

phrase =
"ADMFLIP-" +
Math.random().toString(36)
.substring(2,8)
.toUpperCase();


document.getElementById("phrase").innerText =
"Put this in your Roblox bio: "+phrase;

};



document.getElementById("verifyBtn").onclick=()=>{

let username=
document.getElementById("username").value;


let entered=
document.getElementById("verify").value;



if(entered===phrase){

document.getElementById("loginBtn").innerHTML=
username+"  |  $0";


modal.classList.remove("active");

}

};
