const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");


const app = express();


app.use(cors());

app.use(express.json());



// ======================
// RATE LIMIT
// ======================

app.use(rateLimit({

    windowMs: 60 * 1000,

    max: 50

}));




// ======================
// MONGODB CONNECTION
// ======================

console.log(
    "Mongo URL exists:",
    !!process.env.MONGO_URL
);


mongoose.connect(process.env.MONGO_URL)

.then(()=>{

    console.log("MongoDB connected");

})

.catch((err)=>{

    console.log(
        "MongoDB error:",
        err.message
    );

});







// ======================
// USER DATABASE
// ======================


const User = mongoose.model(

"User",

new mongoose.Schema({

    robloxId:Number,

    username:String,

    avatar:String,


    inventory:[{

        name:String,

        value:Number

    }],


    deposited:[{

        name:String,

        value:Number

    }]

})


);









// ======================
// PET VALUES
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
.map(x=>x.trim())
.filter(Boolean);



let pets=[];



for(
let i=0;
i<lines.length;
i+=2
){


let name =
lines[i];


let value =
lines[i+1];



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
"Pet loading error:",
error.message
);


return [];


}



}



const pets =
loadPets();









// ======================
// HOME
// ======================


app.get("/",(req,res)=>{


res.send(
"ADMFLIP backend is online"
);


});








// ======================
// PETS
// ======================


app.get("/pets",(req,res)=>{


res.json({

success:true,

pets:pets

});


});









// ======================
// ROBLOX USER
// ======================


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





const avatarResponse =
await fetch(

`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`

);



const avatarData =
await avatarResponse.json();






res.json({

success:true,


user:{

id:user.id,

username:user.name,

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









// ======================
// CREATE PHRASE
// ======================


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
1000+
Math.random()*9000
)

);


}







app.get("/create",(req,res)=>{


res.json({

phrase:
generatePhrase()

});


});









// ======================
// VERIFY BIO
// ======================


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
