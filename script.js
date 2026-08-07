const BACKEND = "https://admflip-new.onrender.com";


const loginBtn =
document.getElementById("loginBtn");


const modal =
document.getElementById("modal");


const usernameInput =
document.getElementById("username");


const profile =
document.getElementById("profile");


const phraseText =
document.getElementById("phrase");


const doneBtn =
document.getElementById("done");


const verifyBtn =
document.getElementById("verify");



let currentUser = null;

let phrase = "";





// keep login after refresh

const saved =
localStorage.getItem("admflipUser");


if(saved){

currentUser =
JSON.parse(saved);

showUser();

}





function showUser(){


loginBtn.innerHTML = `

<img src="${currentUser.avatar}">

${currentUser.username}

`;

}





// open login

loginBtn.onclick = ()=>{


if(!currentUser){

modal.classList.add("show");

}


};







// check username automatically

usernameInput.onchange = async()=>{


const username =
usernameInput.value.trim();


if(!username)
return;



try{


const response =
await fetch(

BACKEND +
"/user/" +
username

);



const data =
await response.json();



if(!data.success){


alert("Roblox username not found");

return;


}



currentUser =
data.user;



profile.innerHTML = `

<img width="80" src="${currentUser.avatar}">

<br>

<b>${currentUser.username}</b>

`;




// generate phrase automatically


const phraseResponse =
await fetch(

BACKEND + "/create"

);



const phraseData =
await phraseResponse.json();



phrase =
phraseData.phrase;



phraseText.innerHTML =

"Put this phrase in your Roblox bio:<br><br><b>"
+
phrase
+
"</b>";



doneBtn.style.display="block";



}

catch(error){

console.log(error);

alert("Server error");

}


};








// done button

doneBtn.onclick=()=>{


phraseText.innerHTML +=

"<br><br>After adding it to your bio click Verify.";


verifyBtn.style.display="block";


};







// verify

verifyBtn.onclick=async()=>{


try{


const response =
await fetch(

BACKEND + "/check",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

username:
currentUser.username,

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


alert("Verified successfully");


}

else{


alert(data.message);

}



}

catch(error){


console.log(error);


alert("Verification failed");


}


};
