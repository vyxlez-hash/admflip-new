const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const modal = document.getElementById("modal");

const usernameInput = document.getElementById("username");
const phraseText = document.getElementById("phrase");
const verifyBtn = document.getElementById("verify");


let phrase = "";


// Open login popup + create phrase

if (loginBtn) {

    loginBtn.onclick = async () => {

        modal.classList.add("show");


        try {

            const response = await fetch(
                BACKEND + "/create"
            );


            const data = await response.json();


            phrase = data.phrase;


            phraseText.innerText =
            "Put this phrase in your Roblox bio: " 
            + phrase;


        } 
        
        catch(error) {

            console.error(error);

            alert("Backend connection failed");

        }


    };

}



// Verify Roblox account

if (verifyBtn) {

    verifyBtn.onclick = async () => {


        const username =
        usernameInput.value.trim();



        if (!username) {

            alert("Enter your Roblox username");

            return;

        }



        if (!phrase) {

            alert("Generate a phrase first");

            return;

        }



        try {


            const response = await fetch(
                BACKEND + "/check",
                {

                    method:"POST",

                    headers:{

                        "Content-Type":"application/json"

                    },


                    body:JSON.stringify({

                        username:username,

                        phrase:phrase

                    })

                }
            );



            const data =
            await response.json();



            if(data.success){


                alert(
                "Verified as " + data.username
                );


                loginBtn.innerHTML = `

                <img src="roblox.png">

                ${data.username}

                `;


                modal.classList.remove("show");


            }

            else {


                alert(
                data.message
                );


            }


        }


        catch(error){


            console.error(error);

            alert("Verification failed");


        }


    };

}
