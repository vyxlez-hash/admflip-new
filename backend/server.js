const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


// Temporary storage
// For production use a database (Redis, MongoDB, etc.)
const verificationRequests = {};



// Generate random phrase

function createPhrase(){

    return (
        "ADMFLIP-" +
        Math.random()
        .toString(36)
        .substring(2,8)
        .toUpperCase()
    );

}




// Create verification request

app.get("/create", (req,res)=>{


    const id =
    Date.now().toString();


    const phrase =
    createPhrase();


    verificationRequests[id] = {

        phrase,
        created:Date.now()

    };


    res.json({

        id,
        phrase

    });


});






// Check Roblox bio

app.post("/check", async(req,res)=>{


    const {
        username,
        id,
        phrase
    } = req.body;



    try{


        // Find Roblox user ID

        const userResponse =
        await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                usernames:[username],

                excludeBannedUsers:true

            })

        });



        const userData =
        await userResponse.json();



        if(!userData.data.length){

            return res.json({

                success:false,

                message:"User not found"

            });

        }



        const userId =
        userData.data[0].id;





        // Get profile description

        const profileResponse =
        await fetch(

        `https://users.roblox.com/v1/users/${userId}`

        );



        const profile =
        await profileResponse.json();




        if(profile.description &&
           profile.description.includes(phrase)){



            return res.json({

                success:true,

                username:
                profile.name,

                userId

            });


        }




        res.json({

            success:false,

            message:"Phrase not found"

        });



    }


    catch(error){


        console.error(error);


        res.status(500).json({

            success:false,

            message:"Server error"

        });


    }


});





app.listen(3000,()=>{

console.log(
"ADMFLIP backend running on port 3000"
);

});
