const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


// Temporary storage
// Use a database later for a real production site
const verificationRequests = {};



// Test route

app.get("/", (req, res) => {

    res.send("ADMFLIP backend is online");

});





// Generate random phrase

function createPhrase(){

    const words = [
        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GreenFox",
        "CoolRiver",
        "BrightStar",
        "GoldenLeaf"
    ];


    const word =
    words[Math.floor(Math.random() * words.length)];


    const number =
    Math.floor(1000 + Math.random() * 9000);


    return word + number;

}





// Check if Roblox username exists
// Also returns avatar

app.get("/user/:username", async (req,res)=>{


    try{


        const username =
        req.params.username;



        const response =
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

        }

        );



        const data =
        await response.json();



        if(
            !data.data ||
            data.data.length === 0
        ){

            return res.json({

                success:false,

                message:"Roblox username not found"

            });

        }





        const user =
        data.data[0];





        const avatarResponse =
        await fetch(

        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`

        );



        const avatarData =
        await avatarResponse.json();





        res.json({

            success:true,


            user:{

                username:user.name,

                id:user.id,


                avatar:
                avatarData.data[0].imageUrl

            }

        });



    }


    catch(error){


        console.log(error);


        res.status(500).json({

            success:false,

            message:"Server error"

        });


    }



});







// Create verification phrase

app.get("/create",(req,res)=>{


    const id =
    Date.now().toString();



    const phrase =
    createPhrase();




    verificationRequests[id]={

        phrase:phrase,

        created:Date.now()

    };



    res.json({

        id:id,

        phrase:phrase

    });



});







// Verify Roblox bio

app.post("/check", async(req,res)=>{


    const {

        username,

        phrase

    } = req.body;





    try{


        // Get Roblox user ID


        const response =
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



        const data =
        await response.json();





        if(
            !data.data ||
            data.data.length === 0
        ){


            return res.json({

                success:false,

                message:"Roblox username not found"

            });


        }




        const userId =
        data.data[0].id;





        // Get Roblox profile bio


        const profileResponse =
        await fetch(

        `https://users.roblox.com/v1/users/${userId}`

        );



        const profile =
        await profileResponse.json();






        if(

            profile.description &&

            profile.description.includes(phrase)

        ){


            return res.json({

                success:true,

                username:profile.name,

                userId:profile.id

            });


        }






        res.json({

            success:false,

            message:"Verification phrase not found in Roblox bio"

        });





    }


    catch(error){


        console.log(error);



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
