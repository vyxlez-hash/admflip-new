const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const modal = document.getElementById("modal");

const usernameInput = document.getElementById("username");

const profile = document.getElementById("profile");

const phraseText = document.getElementById("phrase");

const doneBtn = document.getElementById("done");

const verifyBtn = document.getElementById("verify");


let currentUser = null;
let phrase = "";





// Load saved account after refresh

const savedUser = localStorage.getItem("admflipUser");


if(savedUser){

    currentUser = JSON.parse(savedUser);

    showUser();

}







// Show logged in user

function showUser(){


    loginBtn.innerHTML = `

        <img src="${currentUser.avatar}">

        <span>${currentUser.username}</span>

    `;


    loginBtn.classList.add("logged");


    logoutBtn.style.display = "block";


}







// Open login

loginBtn.onclick = ()=>{


    if(!currentUser){

        modal.classList.add("show");

    }


};








// Check Roblox username

usernameInput.onchange = async()=>{


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
            username

        );



        const data =
        await response.json();





        if(!data.success){


            alert("Roblox username not found");

            return;


        }





        currentUser = data.user;




        profile.innerHTML = `


        <img width="80" src="${currentUser.avatar}">

        <br><br>

        <b>${currentUser.username}</b>


        `;







        // Generate phrase automatically


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





        doneBtn.style.display = "block";



    }


    catch(error){


        console.log(error);


        alert("Server error");


    }


};








// Done button

doneBtn.onclick = ()=>{


    phraseText.innerHTML += `


    <br><br>


    After adding it to your Roblox bio,
    click Verify Account.


    `;



    verifyBtn.style.display = "block";


};








// Verify Roblox bio

verifyBtn.onclick = async()=>{


    if(!currentUser || !phrase){

        alert("Generate a phrase first");

        return;

    }



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



            alert("Account verified");



        }


        else{


            alert(

            "Verification phrase not found. Put the phrase in your Roblox bio and try again."

            );



            verifyBtn.disabled = false;


            verifyBtn.innerText = "Verify Account";


        }




    }


    catch(error){



        console.log(error);



        alert("Verification failed");



        verifyBtn.disabled = false;


        verifyBtn.innerText = "Verify Account";



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
