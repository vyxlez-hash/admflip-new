const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const modal = document.getElementById("modal");

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





const saved =
localStorage.getItem("admflipUser");


if(saved){

    currentUser = JSON.parse(saved);

    showUser();

}





function showUser(){

    loginBtn.innerHTML = `

    <img src="${currentUser.avatar}">

    <span>${currentUser.username}</span>

    `;


    loginBtn.classList.add("logged");

    logoutBtn.style.display="block";

}






loginBtn.onclick = ()=>{

    if(!currentUser){

        modal.classList.add("show");

    }

};








usernameInput.onchange = async()=>{


const username =
usernameInput.value.trim();


if(!username) return;



try{


const userResponse =
await fetch(

BACKEND + "/user/" + username

);



const userData =
await userResponse.json();




if(!userData.success){

alert("Roblox username not found");

return;

}





currentUser =
userData.user;




profile.innerHTML = `

<img width="90" src="${currentUser.avatar}">

<br><br>

<b>${currentUser.username}</b>

`;






// automatic phrase generation

const phraseResponse =
await fetch(

BACKEND + "/create"

);



const phraseData =
await phraseResponse.json();



phrase =
phraseData.phrase;



phraseText.innerHTML = `

Put this phrase in your Roblox bio:

<br><br>

<b>${phrase}</b>

`;




verifyBtn.style.display="block";



}

catch(error){

console.log(error);

alert("Server error");

}



};








verifyBtn.onclick = async()=>{


verifyBtn.innerText="Checking...";

verifyBtn.disabled=true;



try{


const response =
await fetch(

BACKEND+"/check",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

username:currentUser.username,

phrase:phrase

})

}

);





const data =
await response.json();





if(data.success){


localStorage.setItem(

"admflipUser",

JSON.stringify(currentUser)

);



modal.classList.remove("show");


showUser();


alert("Verified");


}

else{


alert(
"Verification phrase not found. Put it in your Roblox bio first."
);



verifyBtn.disabled=false;


verifyBtn.innerText="Verify";


}



}


catch(error){


console.log(error);


alert("Verification failed");


verifyBtn.disabled=false;


verifyBtn.innerText="Verify";


}



};







logoutBtn.onclick=()=>{


localStorage.removeItem("admflipUser");


currentUser=null;


loginBtn.innerHTML=`

<img src="roblox.png">

<span>Sign In</span>

`;



loginBtn.classList.remove("logged");


logoutBtn.style.display="none";


};
