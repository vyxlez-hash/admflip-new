const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


// Temporary storage
// For a real website use a database
const verificationRequests = {};


// Home test route
app.get("/", (req, res) => {
    res.send("ADMFLIP backend is online");
});


// Create verification phrase
app.get("/create", (req, res) => {

    const id = Date.now().toString();

    const phrase =
        "ADMFLIP-" +
        Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();


    verificationRequests[id] = {
        phrase,
        created: Date.now()
    };


    res.json({
        id,
        phrase
    });

});



// Check Roblox bio
app.post("/check", async (req, res) => {

    const {
        username,
        phrase
    } = req.body;


    try {

        // Find Roblox user
        const userResponse = await fetch(
            "https://users.roblox.com/v1/usernames/users",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    usernames: [username],
                    excludeBannedUsers: true
                })
            }
        );


        const userData = await userResponse.json();


        if (!userData.data || userData.data.length === 0) {

            return res.json({
                success:false,
                message:"Roblox user not found"
            });

        }


        const userId = userData.data[0].id;



        // Get Roblox profile
        const profileResponse = await fetch(
            `https://users.roblox.com/v1/users/${userId}`
        );


        const profile = await profileResponse.json();



        if (
            profile.description &&
            profile.description.includes(phrase)
        ) {

            return res.json({

                success:true,

                username:profile.name,

                userId:profile.id

            });

        }



        return res.json({

            success:false,

            message:"Verification phrase not found in bio"

        });



    } catch(error) {


        console.error(error);


        res.status(500).json({

            success:false,

            message:"Server error"

        });


    }


});




// Start server

app.listen(3000, () => {

    console.log(
        "ADMFLIP backend running on port 3000"
    );

});
