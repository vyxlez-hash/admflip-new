const express = require("express");
const cors = require("cors");

const app = express();


app.use(cors());

app.use(express.json());



let verificationPhrases = {};




// Home test

app.get("/", (req,res)=>{

    res.send("ADMFLIP backend is online");

});





// Generate Roblox-friendly phrase

function generatePhrase(){


    const words = [

        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GreenFox",
        "BrightStar",
        "GoldenLeaf"

    ];


    const word =
    words[Math.floor(Math.random()*words.length)];



    const number =
    Math.floor(1000 + Math.random()*9000);



    return word + number;

}







// Get Roblox user + avatar

app.get("/user/:username", async(req,res)=>{


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



        if(!data.data || data.data.length === 0){


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








// Create phrase

app.get("/create",(req,res)=>{


    const id =
    Date.now().toString();



    const phrase =
    generatePhrase();



    verificationPhrases[id]={

        phrase:phrase,

        time:Date.now()

    };



    res.json({

        id:id,

        phrase:phrase

    });


});









// Verify bio

app.post("/check", async(req,res)=>{


    try{


        const {

            username,

            phrase

        } = req.body;




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

                message:"Roblox username not found"

            });


        }





        const userId =
        userData.data[0].id;





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

                id:profile.id

            });


        }




        res.json({

            success:false,

            message:"Phrase not found in Roblox bio"

        });



    }


    catch(error){


        console.log(error);


        res.status(500).json({

            success:false,

            message:"Verification failed"

        });


    }


});








app.listen(3000,()=>{


    console.log(
        "ADMFLIP backend running on port 3000"
    );


});
