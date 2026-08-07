const BACKEND =
"https://admflip-new.onrender.com";


const loginBtn =
document.getElementById("loginBtn");

const modal =
document.getElementById("modal");


let phrase = "";

let verifyId = "";



loginBtn.onclick = async () => {


    modal.classList.add("show");


    const response =
    await fetch(
        BACKEND + "/create"
    );


    const data =
    await response.json();


    phrase = data.phrase;

    verifyId = data.id;


    document.getElementById("phrase").innerText =
    "Put this phrase in your Roblox bio: "
    + phrase;


};





document.getElementById("verify").onclick =
async () => {


    const username =
    document.getElementById("username").value;



    const response =
    await fetch(
        BACKEND + "/check",
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
    );



    const data =
    await response.json();



    if(data.success){


        alert(
        "Verified as " 
        + data.username
        );


    }

    else{


        alert(data.message);


    }



};
