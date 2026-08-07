const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const modal = document.getElementById("modal");

const usernameInput = document.getElementById("username");
const phraseText = document.getElementById("phrase");

const verifyBtn = document.getElementById("verify");
const generateBtn = document.getElementById("generate");

let phrase = "";
let robloxUser = null;


// Load saved login

const savedUser = localStorage.getItem("admflipUser");

if (savedUser) {

    robloxUser = JSON.parse(savedUser);

    showUser();

}



// Show logged in user

function showUser(){

    loginBtn.innerHTML = `

    <img src="${robloxUser.avatar}">

    ${robloxUser.username}

    `;

}





// Open login

loginBtn.onclick = () => {

    if(!robloxUser){

        modal.classList.add("show");

    }

};





// Generate phrase button

generateBtn.onclick = async () => {


    const username =
    usernameInput.value.trim();


    if(!username){

        alert("Enter Roblox username");

        return;

    }



    try{


        const userCheck =
        await fetch(

        BACKEND + "/user/" + username

        );


        const data =
        await userCheck.json();



        if(!data.success){


            alert("Roblox username not found");

            return;


        }



        robloxUser = data.user;



        document.getElementById("profile").innerHTML = `

        <img width="80" src="${robloxUser.avatar}">

        <br>

        ${robloxUser.username}

        `;



        const phraseResponse =
        await fetch(
            BACKEND + "/create"
        );


        const phraseData =
        await phraseResponse.json();



        phrase =
        phraseData.phrase;



        phraseText.innerText =
        "Put this in your Roblox bio: " + phrase;



        verifyBtn.style.display="block";


    }

    catch(error){

        console.log(error);

        alert("Server error");

    }


};







// Verify

verifyBtn.onclick = async()=>{


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

                username:robloxUser.username,

                phrase:phrase

            })

            }

        );



        const data =
        await response.json();



        if(data.success){


            localStorage.setItem(

                "admflipUser",

                JSON.stringify(robloxUser)

            );



            modal.classList.remove("show");

            showUser();


            alert(
            "Verified successfully"
            );


        }

        else{


            alert(
            "Verification phrase not found"
            );


        }



    }

    catch(error){

        console.log(error);

        alert("Verification failed");

    }


};
