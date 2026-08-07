const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

const app = express();


app.use(cors());

app.use(express.json());



// RATE LIMIT

const limiter = rateLimit({

    windowMs: 60 * 1000,

    max: 50,

    message: {
        success:false,
        message:"Too many requests"
    }

});


app.use(limiter);






// ======================
// PET VALUE LOADER
// ======================


function loadPets(){

    try{


        const text =
        fs.readFileSync(
            "./values.txt",
            "utf8"
        );



        const lines =
        text
        .split(/\r?\n/)
        .map(line=>line.trim())
        .filter(line=>line.length);



        let pets=[];



        for(let i=0;i<lines.length;i+=2){


            const name = lines[i];


            let value = lines[i+1];



            if(!name || !value)
                continue;



            value =
            value
            .replace(/\./g,"")
            .replace(/,/g,"");



            pets.push({

                name:name,

                value:Number(value)

            });


        }



        console.log(
            "Loaded pets:",
            pets.length
        );



        return pets;



    }

    catch(error){


        console.log(
            "Values file error:",
            error
        );


        return [];


    }


}




const pets = loadPets();








// HOME


app.get("/",(req,res)=>{


    res.send(
        "ADMFLIP backend is online"
    );


});








// TEST


app.get("/test",(req,res)=>{


    res.send(
        "Server working"
    );


});








// PETS


app.get("/pets",(req,res)=>{


    res.json({

        success:true,

        count:pets.length,

        pets:pets

    });


});









// ROBLOX USER SEARCH


app.get("/user/:username",async(req,res)=>{


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




if(!data.data.length){


return res.json({

success:false,

message:"Roblox username not found"

});


}




const user =
data.data[0];






const avatar =
await fetch(

`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`

);



const avatarData =
await avatar.json();






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









// PHRASE SYSTEM


function generatePhrase(){


const words=[

"BlueTiger",

"FastCloud",

"LuckyWave",

"SilverMoon",

"GoldenLeaf"

];



return (

words[
Math.floor(
Math.random()*words.length
)

]

+

Math.floor(
1000+Math.random()*9000
)

);


}



app.get("/create",(req,res)=>{


res.json({

phrase:generatePhrase()

});


});









// VERIFY BIO


app.post("/check",async(req,res)=>{


try{


const {

username,

phrase

}=req.body;




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





if(!data.data.length){


return res.json({

success:false,

message:"Roblox username not found"

});


}





const id =
data.data[0].id;





const profileResponse =
await fetch(

`https://users.roblox.com/v1/users/${id}`

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

message:"Verification phrase not found"

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
