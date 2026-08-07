const BACKEND = "https://admflip-new.onrender.com";


const loginBtn = document.getElementById("loginBtn");
const modal = document.getElementById("modal");

const usernameInput = document.getElementById("username");
const phraseText = document.getElementById("phrase");
const verifyBtn = document.getElementById("verify");


let phrase = "";


// Open sign in and generate phrase

if (loginBtn) {

    loginBtn.addEventListener("click", async () => {

        if (modal) {
            modal.classList.add("show");
        }


        try {

            const response = await fetch(
                BACKEND + "/create"
            );


            const data = await response.json();


            phrase = data.phrase;


            if (phraseText) {

                phraseText.innerText =
                "Put this phrase in your Roblox bio: " + phrase;

            }


        } catch (error) {

            console.error(error);

            alert("Could not connect to ADMFLIP server");

        }


    });

}




// Verify Roblox account

if (verifyBtn) {

    verifyBtn.addEventListener("click", async () => {


        const username =
        usernameInput.value.trim();



        if (!username) {

            alert("Enter your Roblox username");

            return;

        }



        if (!phrase) {

            alert("Click Sign In first to generate a phrase");

            return;

        }



        try {


            const response = await fetch(
                BACKEND + "/check",
                {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },


                    body: JSON.stringify({

                        username: username,

                        phrase: phrase

                    })

                }
            );



            const data =
            await response.json();



            if (data.success) {


                alert(
                    "Verified as " + data.username
                );


                if (loginBtn) {

                    loginBtn.innerHTML = `

                    <img src="roblox.png">

                    ${data.username}

                    `;

                }


                if (modal) {

                    modal.classList.remove("show");

                }


            } else {


                alert(
                    data.message || "Verification failed"
                );


            }



        } catch (error) {


            console.error(error);

            alert("Server connection failed");


        }


    });

}
