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




// Load saved account

const savedUser = localStorage.getItem("admflipUser");


if(savedUser){

    currentUser = JSON.parse(savedUser);

    showUser();

}





// Show account

function showUser(){


    loginBtn.innerHTML = `

        <img src="${currentUser.avatar}">

        ${currentUser.username}

    `;


    logoutBtn.style.display = "block";


}






// Open sign in

loginBtn.onclick = ()=>{


    if(!currentUser){

        modal.classList.add("show");

    }


};







// Username entered

usernameInput.onchange = async()=>{


    const username =
    usernameInput.value.trim();



    if(!username) return;



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





        phraseText.innerHTML = `

        Put this phrase in your Roblox bio:

        <br><br>

        <b>${phrase}</b>

        `;



        doneBtn.style.display="block";



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



    verifyBtn.style.display="block";


};









// Verify account

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


            alert(data.message);


        }



    }


    catch(error){


        console.log(error);


        alert("Verification failed");


    }


};









// Logout

logoutBtn.onclick = ()=>{


    localStorage.removeItem("admflipUser");


    currentUser = null;


    loginBtn.innerHTML = `

        <img src="roblox.png">

        <span>
        Sign In
        </span>

    `;



    logoutBtn.style.display="none";


};
