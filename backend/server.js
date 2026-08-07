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
// SETTINGS DATABASE
// ======================

const Settings = mongoose.model(

"Settings",

new mongoose.Schema({

    siteOnline:{

        type:Boolean,

        default:true

    },


    announcement:{

        type:String,

        default:""

    }

})

);




// ======================
// CHAT DATABASE
// ======================

const Chat = mongoose.model(

"Chat",

new mongoose.Schema({

    username:String,

    avatar:String,

    message:String,


    type:{

        type:String,

        default:"message"

    },


    createdAt:{

        type:Date,

        default:Date.now

    }

})

// ======================
// PET VALUES
// ======================

function loadPets(){

try{


const text = fs.readFileSync(
    "./values.txt",
    "utf8"
);



const lines = text
.split(/\r?\n/)
.map(x=>x.trim())
.filter(Boolean);



let pets = [];



for(
let i = 0;
i < lines.length;
i += 2
){


let name = lines[i];

let value = lines[i+1];



if(!name || !value)
continue;



value = value
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



const pets = loadPets();






// ======================
// HOME
// ======================

app.get("/",(req,res)=>{

res.send(
"ADMFLIP backend is online"
);

});






// ======================
// SITE STATUS
// ======================

app.get("/status",async(req,res)=>{

try{


let settings =
await Settings.findOne();



if(!settings){


settings =
await Settings.create({});


}



res.json({

    online:settings.siteOnline,

    announcement:settings.announcement

});


}


catch(error){


res.status(500).json({

    online:true,

    announcement:""

});


}


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
// CHAT GET
// ======================

app.get("/chat",async(req,res)=>{


try{


const messages =
await Chat.find()

.sort({

createdAt:1

})

.limit(100);



res.json(messages);


}

catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});







// ======================
// CHAT SEND
// ======================

app.post("/chat",async(req,res)=>{


try{


const {

username,

avatar,

message

}=req.body;



if(!username || !message){


return res.json({

success:false,

message:"Missing data"

});


}



const chat =
await Chat.create({

username,

avatar,

message,

type:"message"

});



res.json({

success:true,

chat

});


}


catch(error){


console.log(error);


res.status(500).json({

success:false

});


}
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

avatar:avatarData.data[0].imageUrl

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
Math.floor(Math.random()*words.length)
]

+

Math.floor(
1000 + Math.random()*9000
)

);


}



app.get("/create",(req,res)=>{


res.json({

phrase:generatePhrase()

});


});








// ======================
// VERIFY ROBLOX BIO
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







// ======================
// TELEGRAM BOT
// ======================

require("./telegram");







// ======================
// START SERVER
// ======================

app.listen(3000,()=>{


console.log(
"ADMFLIP backend running on port 3000"
);


});
}););
