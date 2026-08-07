const login =
document.getElementById("loginBtn");

const modal =
document.getElementById("modal");


let phrase="";


login.onclick=()=>{

modal.classList.add("show");


fetch("https://YOUR-BACKEND.com/create")
.then(r=>r.json())
.then(data=>{

phrase=data.phrase;

document.getElementById("phrase").innerText=
"Put this in your Roblox bio: "+phrase;

});

};



document.getElementById("verify").onclick=()=>{


let username =
document.getElementById("username").value;


fetch(
"https://YOUR-BACKEND.com/check",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
username,
phrase
})

}

)

.then(r=>r.json())

.then(data=>{


if(data.success){

alert("Verified!");

}

else{

alert("Verification failed");

}


});


};
