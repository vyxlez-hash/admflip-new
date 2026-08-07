const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const modal = document.getElementById("modal");

const usernameInput = document.getElementById("username");

const profile = document.getElementById("profile");
const phraseText = document.getElementById("phrase");

const verifyBtn = document.getElementById("verify");


let currentUser = null;
let phrase = "";





// Load saved login

const savedUser = localStorage.getItem("admflipUser");


if(savedUser){

    currentUser = JSON.parse(savedUser);

    showUser();

}





// Show logged in account

function showUser(){


    loginBtn.innerHTML = `

        <img src="${currentUser.avatar}">

        <span>
        ${currentUser.username}
        </span>

    `;


    loginBtn.classList.add("logged");


    logoutBtn.style.display = "block";


}






// Open login modal

loginBtn.onclick = ()=>{


    if(!currentUser){

        modal.classList.add("show");

    }


};








// Check Roblox username automatically

usernameInput.onchange = async()=>{


    const username =
    usernameInput.value.trim();



    if(!username){

        return;

    }




    try{


        const response =
        await fetch(

            BACKEND + "/user/" + username

        );



        const data =
        await response.json();





        if(!data.success){


            alert("Roblox username not found");


            return;


        }






        currentUser = data.user;






        profile.classList.remove("hidden");



        profile.innerHTML = `


        <img width="80" src="${currentUser.avatar}">


        <br><br>


        <b>${currentUser.username}</b>


        `;









        // Create phrase automatically


        const phraseResponse =
        await fetch(

            BACKEND + "/create"

        );



        const phraseData =
        await phraseResponse.json();




        phrase =
        phraseData.phrase;





        phraseText.classList.remove("hidden");



        phraseText.innerHTML = `


        Put this phrase in your Roblox bio:


        <br><br>


        <b>${phrase}</b>


        `;






        verifyBtn.style.display = "block";




    }


    catch(error){


        console.log(error);


        alert("Server error");


    }



};








// Verify Roblox bio

verifyBtn.onclick = async()=>{


    verifyBtn.disabled = true;

    verifyBtn.innerText = "Checking...";




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


            alert(

            "Verification phrase not found. Put it in your Roblox bio first."

            );



            verifyBtn.disabled = false;


            verifyBtn.innerText = "Verify";


        }



    }


    catch(error){


        console.log(error);


        alert("Verification failed");


        verifyBtn.disabled = false;


        verifyBtn.innerText = "Verify";


    }



};








// Logout

logoutBtn.onclick = ()=>{


    localStorage.removeItem("admflipUser");


    currentUser = null;

    phrase = "";



    loginBtn.innerHTML = `

        <img src="roblox.png">

        <span>
        Sign In
        </span>

    `;



    loginBtn.classList.remove("logged");



    logoutBtn.style.display = "none";


};
