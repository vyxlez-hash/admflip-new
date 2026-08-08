const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();

app.set("trust proxy", 1);

app.use(cors({
    origin:true,
    credentials:true
}));

app.use(express.json({limit:"100kb"}));

app.use(rateLimit({
    windowMs:60 * 1000,
    max:120,
    standardHeaders:true,
    legacyHeaders:false
}));

const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_SECRET_IN_RENDER";

if(!MONGO_URL){
    console.error("MONGO_URL is missing.");
}

if(JWT_SECRET === "CHANGE_THIS_SECRET_IN_RENDER"){
    console.warn("WARNING: Set JWT_SECRET in Render.");
}

mongoose.connect(MONGO_URL)
    .then(()=>console.log("MongoDB connected"))
    .catch(err=>console.error("MongoDB error:",err.message));

/*
====================================================
MODELS
====================================================
*/

const UserSchema = new mongoose.Schema({
    robloxId:{
        type:Number,
        unique:true,
        index:true
    },

    username:{
        type:String,
        required:true
    },

    avatar:String,

    balance:{
        type:Number,
        default:0
    },

    wagered:{
        type:Number,
        default:0
    },

    profit:{
        type:Number,
        default:0
    },

    inventory:[{
        instanceId:String,
        petId:String,
        name:String,
        value:Number,
        rarity:String,
        image:String,
        neon:Boolean,
        mega:Boolean,
        fly:Boolean,
        ride:Boolean
    }],

    createdAt:{
        type:Date,
        default:Date.now
    }
},{
    timestamps:true
});

const User =
    mongoose.models.User ||
    mongoose.model("User",UserSchema);


const ChatSchema = new mongoose.Schema({
    userId:String,
    username:String,
    avatar:String,
    message:String,
    createdAt:{
        type:Date,
        default:Date.now
    }
});

const Chat =
    mongoose.models.Chat ||
    mongoose.model("Chat",ChatSchema);


const CoinflipSchema = new mongoose.Schema({
    ownerId:String,
    ownerUsername:String,

    petInstanceId:String,

    pet:{
        petId:String,
        name:String,
        value:Number,
        rarity:String,
        image:String,
        neon:Boolean,
        mega:Boolean,
        fly:Boolean,
        ride:Boolean
    },

    side:{
        type:String,
        enum:["heads","tails"]
    },

    joinedBy:String,
    joinedUsername:String,

    status:{
        type:String,
        enum:["active","completed","cancelled"],
        default:"active",
        index:true
    },

    winnerId:String,
    winningSide:String,

    createdAt:{
        type:Date,
        default:Date.now
    },

    completedAt:Date
});

const Coinflip =
    mongoose.models.Coinflip ||
    mongoose.model("Coinflip",CoinflipSchema);


/*
====================================================
PET DATABASE
====================================================

Your existing values.txt remains the source of values.

Optional pets.json can add:
id,name,value,rarity,image,neon,mega,fly,ride

Image provider:
PET_IMAGE_BASE_URL

Example:
https://your-permitted-image-provider.example/pets/

The backend never exposes an API key.
*/

function loadPetDatabase(){

    const result = [];

    let text = "";

    try{
        text = fs.readFileSync(
            path.join(process.cwd(),"values.txt"),
            "utf8"
        );
    }catch{
        console.warn("values.txt not found.");
    }

    const lines = text
        .split(/\r?\n/)
        .map(x=>x.trim())
        .filter(Boolean);

    for(let i=0;i<lines.length;i+=2){

        const name = lines[i];
        const rawValue = lines[i+1];

        if(!name || !rawValue) continue;

        /*
        IMPORTANT:
        Do NOT use /./g here.
        That deletes every character.
        */

        const value =
            Number(
                rawValue.replace(/[^0-9.-]/g,"")
            );

        if(!Number.isFinite(value)) continue;

        result.push({
            id:slugify(name),
            name,
            value,
            rarity:"Unknown",
            image:resolvePetImage(name),
            neon:false,
            mega:false,
            fly:false,
            ride:false
        });
    }

    /*
    Optional pets.json overrides/additions.
    */

    const jsonPath =
        path.join(process.cwd(),"pets.json");

    if(fs.existsSync(jsonPath)){

        try{

            const custom =
                JSON.parse(
                    fs.readFileSync(jsonPath,"utf8")
                );

            if(Array.isArray(custom)){

                for(const item of custom){

                    if(!item.name) continue;

                    const id =
                        item.id || slugify(item.name);

                    const existing =
                        result.find(x=>x.id === id);

                    const pet = {
                        id,
                        name:item.name,
                        value:Number(
                            item.value ??
                            existing?.value ??
                            0
                        ),
                        rarity:item.rarity || "Unknown",
                        image:item.image || resolvePetImage(item.name),
                        neon:Boolean(item.neon),
                        mega:Boolean(item.mega),
                        fly:Boolean(item.fly),
                        ride:Boolean(item.ride)
                    };

                    if(existing){
                        Object.assign(existing,pet);
                    }else{
                        result.push(pet);
                    }
                }
            }

        }catch(error){
            console.error(
                "pets.json error:",
                error.message
            );
        }
    }

    console.log(
        "Loaded pets:",
        result.length
    );

    return result;
}

function slugify(value){
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g,"-")
        .replace(/^-|-$/g,"");
}


/*
====================================================
IMAGE PROVIDER
====================================================

We intentionally do NOT scrape Elvebredd or AMVGG.

If you obtain a permitted provider later, set:

PET_IMAGE_BASE_URL=https://example.com/pets/

The provider should have images named like:

shadow-dragon.png
bat-dragon.png
unicorn.png

If no provider is configured, cards simply show the
pet name/value instead of a broken logo image.
*/

function resolvePetImage(name){

    const base =
        process.env.PET_IMAGE_BASE_URL;

    if(!base){
        return "";
    }

    const clean =
        slugify(name);

    return (
        base.replace(/\/$/,"") +
        "/" +
        clean +
        ".png"
    );
}

let pets = loadPetDatabase();

function findPetById(id){
    return pets.find(x=>x.id === id);
}


/*
====================================================
AUTH
====================================================
*/

function createToken(user){
    return jwt.sign({
        sub:String(user._id),
        robloxId:user.robloxId,
        username:user.username
    },JWT_SECRET,{
        expiresIn:"30d"
    });
}

function auth(req,res,next){

    const header =
        req.headers.authorization || "";

    if(!header.startsWith("Bearer ")){
        return res.status(401).json({
            message:"Authentication required."
        });
    }

    const token =
        header.slice(7);

    try{

        req.auth =
            jwt.verify(token,JWT_SECRET);

        next();

    }catch{
        return res.status(401).json({
            message:"Session expired. Sign in again."
        });
    }
}


/*
====================================================
ROBLOX API
====================================================
*/

async function robloxUser(username){

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

    if(!data.data?.length){
        return null;
    }

    const user = data.data[0];

    const avatarResponse =
        await fetch(
            "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
            `?userIds=${user.id}` +
            "&size=150x150&format=Png"
        );

    const avatarData =
        await avatarResponse.json();

    return {
        id:user.id,
        username:user.name,
        avatar:
            avatarData.data?.[0]?.imageUrl || ""
    };
}


/*
====================================================
HOME
====================================================
*/

app.get("/",(req,res)=>{
    res.send("ADMFLIP backend is online");
});


/*
====================================================
STATUS
====================================================
*/

app.get("/status",(req,res)=>{
    res.json({
        online:true
    });
});


/*
====================================================
PET VALUES
====================================================
*/

app.get("/pets",(req,res)=>{
    res.json({
        success:true,
        pets
    });
});


/*
====================================================
ROBLOX LOGIN
====================================================
*/

app.get("/user/:username",async(req,res)=>{

    try{

        const user =
            await robloxUser(
                req.params.username
            );

        if(!user){
            return res.json({
                success:false,
                message:"Roblox username not found."
            });
        }

        res.json({
            success:true,
            user
        });

    }catch(error){

        console.error(error);

        res.status(500).json({
            success:false,
            message:"Roblox lookup failed."
        });
    }
});


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
        ] +
        "-" +
        Math.floor(
            1000 +
            Math.random()*9000
        )
    );
}

app.get("/create",(req,res)=>{
    res.json({
        phrase:generatePhrase()
    });
});


app.post("/check",async(req,res)=>{

    try{

        const {
            username,
            phrase
        } = req.body;

        if(!username || !phrase){
            return res.status(400).json({
                success:false,
                message:"Username and phrase are required."
            });
        }

        const roblox =
            await robloxUser(username);

        if(!roblox){
            return res.json({
                success:false,
                message:"Roblox username not found."
            });
        }

        const profileResponse =
            await fetch(
                `https://users.roblox.com/v1/users/${roblox.id}`
            );

        const profile =
            await profileResponse.json();

        if(
            !profile.description ||
            !profile.description.includes(phrase)
        ){
            return res.json({
                success:false,
                message:"Verification phrase not found in your Roblox bio."
            });
        }

        const user =
            await User.findOneAndUpdate(
                {robloxId:roblox.id},
                {
                    $set:{
                        robloxId:roblox.id,
                        username:roblox.username,
                        avatar:roblox.avatar
                    }
                },
                {
                    new:true,
                    upsert:true
                }
            );

        const token =
            createToken(user);

        res.json({
            success:true,
            token,
            user:{
                id:String(user._id),
                robloxId:user.robloxId,
                username:user.username,
                avatar:user.avatar,
                inventory:user.inventory
            }
        });

    }catch(error){

        console.error(error);

        res.status(500).json({
            success:false,
            message:"Verification failed."
        });
    }
});


/*
====================================================
SESSION
====================================================
*/

app.get("/session",auth,async(req,res)=>{

    const user =
        await User.findById(req.auth.sub)
        .lean();

    if(!user){
        return res.status(401).json({
            message:"User no longer exists."
        });
    }

    res.json({
        user:{
            token:req.headers.authorization.slice(7),
            id:String(user._id),
            robloxId:user.robloxId,
            username:user.username,
            avatar:user.avatar,
            inventory:user.inventory
        }
    });
});


/*
====================================================
INVENTORY
====================================================
*/

app.get("/inventory",auth,async(req,res)=>{

    const user =
        await User.findById(req.auth.sub)
        .lean();

    if(!user){
        return res.status(404).json({
            message:"User not found."
        });
    }

    res.json({
        inventory:user.inventory || []
    });
});


/*
====================================================
COINFLIPS
====================================================
*/

app.get("/coinflips",async(req,res)=>{

    const rows =
        await Coinflip.find({
            status:"active"
        })
        .sort({createdAt:-1})
        .limit(100)
        .lean();

    res.json({
        coinflips:rows.map(x=>({
            id:String(x._id),
            pet:x.pet,
            side:x.side,
            owner:{
                id:x.ownerId,
                username:x.ownerUsername
            }
        }))
    });
});


app.get("/coinflips/:id",auth,async(req,res)=>{

    const cf =
        await Coinflip.findById(req.params.id)
        .lean();

    if(!cf){
        return res.status(404).json({
            message:"Coinflip not found."
        });
    }

    res.json({
        coinflip:{
            id:String(cf._id),
            joined:Boolean(cf.joinedBy),
            pet:cf.pet,
            side:cf.side
        }
    });
});


/*
Create coinflip.

The selected pet is removed from the user's inventory
inside the same MongoDB transaction as the listing.

This prevents the browser from posting a pet that it
doesn't own.
*/

app.post("/coinflips",auth,async(req,res)=>{

    const {
        instanceId,
        side
    } = req.body;

    if(!instanceId ||
       !["heads","tails"].includes(side)){

        return res.status(400).json({
            message:"Pet and side are required."
        });
    }

    const session =
        await mongoose.startSession();

    try{

        let created;

        await session.withTransaction(
            async()=>{

                const user =
                    await User.findById(
                        req.auth.sub
                    ).session(session);

                if(!user){
                    throw new Error("User not found.");
                }

                const index =
                    user.inventory.findIndex(
                        x=>x.instanceId === instanceId
                    );

                if(index === -1){
                    throw new Error(
                        "That pet is not in your inventory."
                    );
                }

                const pet =
                    user.inventory[index];

                user.inventory.splice(index,1);

                await user.save({session});

                const cf =
                    await Coinflip.create([{
                        ownerId:String(user._id),
                        ownerUsername:user.username,
                        petInstanceId:pet.instanceId,
                        pet:pet.toObject
                            ? pet.toObject()
                            : pet,
                        side,
                        status:"active"
                    }],{session});

                created = cf[0];
            }
        );

        res.json({
            success:true,
            id:String(created._id)
        });

    }catch(error){

        res.status(400).json({
            message:error.message
        });

    }finally{
        await session.endSession();
    }
});


/*
====================================================
COINFLIP JOIN
====================================================

For a real production deployment, MongoDB transactions
should run on a replica set / MongoDB Atlas.

The item is held by the server while the listing is active.
*/

app.post("/coinflips/:id/join",auth,async(req,res)=>{

    const session =
        await mongoose.startSession();

    try{

        let result;

        await session.withTransaction(
            async()=>{

                const cf =
                    await Coinflip.findOne({
                        _id:req.params.id,
                        status:"active",
                        ownerId:{
                            $ne:req.auth.sub
                        }
                    }).session(session);

                if(!cf){
                    throw new Error(
                        "Coinflip is no longer available."
                    );
                }

                const joiningUser =
                    await User.findById(
                        req.auth.sub
                    ).session(session);

                if(!joiningUser){
                    throw new Error("User not found.");
                }

                /*
                Temporary bot mode:
                the joining player supplies no pet.
                Instead the server uses the existing held pet
                and resolves the flip.
                */

                const winningSide =
                    Math.random() < .5
                    ? "heads"
                    : "tails";

                const ownerWon =
                    winningSide === cf.side;

                const winnerId =
                    ownerWon
                    ? cf.ownerId
                    : String(joiningUser._id);

                const winner =
                    await User.findById(
                        winnerId
                    ).session(session);

                if(!winner){
                    throw new Error(
                        "Winner could not be found."
                    );
                }

                winner.inventory.push({
                    ...cf.pet,
                    instanceId:
                        makeInstanceId()
                });

                /*
                Wagered is the value of the pet
                being risked.
                */

                const value =
                    Number(cf.pet.value || 0);

                const owner =
                    await User.findById(
                        cf.ownerId
                    ).session(session);

                if(owner){
                    owner.wagered += value;

                    if(ownerWon){
                        owner.profit += value;
                    }else{
                        owner.profit -= value;
                    }

                    await owner.save({session});
                }

                joiningUser.wagered += value;

                if(!ownerWon){
                    joiningUser.profit += value;
                }else{
                    joiningUser.profit -= value;
                }

                await joiningUser.save({session});

                await winner.save({session});

                cf.joinedBy =
                    String(joiningUser._id);

                cf.joinedUsername =
                    joiningUser.username;

                cf.status =
                    "completed";

                cf.winnerId =
                    winnerId;

                cf.winningSide =
                    winningSide;

                cf.completedAt =
                    new Date();

                await cf.save({session});

                result = {
                    winningSide,
                    winnerId,
                    winnerUsername:winner.username,
                    pet:cf.pet
                };
            }
        );

        res.json({
            success:true,
            result
        });

    }catch(error){

        res.status(400).json({
            message:error.message
        });

    }finally{
        await session.endSession();
    }
});


/*
====================================================
COINFLIP HISTORY
====================================================
*/

app.get("/coinflips/history",auth,async(req,res)=>{

    const rows =
        await Coinflip.find({
            $or:[
                {ownerId:req.auth.sub},
                {joinedBy:req.auth.sub}
            ],
            status:"completed"
        })
        .sort({completedAt:-1})
        .limit(50)
        .lean();

    res.json({
        history:rows.map(x=>({
            pet:x.pet,
            result:
                x.winnerId === req.auth.sub
                ? "Won"
                : "Lost"
        }))
    });
});


/*
====================================================
TIP
====================================================

Pet is atomically moved from sender inventory
to receiver inventory.
*/

app.post("/tip",auth,async(req,res)=>{

    const {
        receiverId,
        instanceId
    } = req.body;

    if(!receiverId || !instanceId){
        return res.status(400).json({
            message:"Receiver and pet are required."
        });
    }

    if(receiverId === req.auth.sub){
        return res.status(400).json({
            message:"You cannot tip yourself."
        });
    }

    const session =
        await mongoose.startSession();

    try{

        await session.withTransaction(
            async()=>{

                const sender =
                    await User.findById(
                        req.auth.sub
                    ).session(session);

                const receiver =
                    await User.findById(
                        receiverId
                    ).session(session);

                if(!sender || !receiver){
                    throw new Error(
                        "User not found."
                    );
                }

                const index =
                    sender.inventory.findIndex(
                        x=>x.instanceId === instanceId
                    );

                if(index === -1){
                    throw new Error(
                        "Pet is not in your inventory."
                    );
                }

                const pet =
                    sender.inventory[index];

                sender.inventory.splice(index,1);

                receiver.inventory.push({
                    ...pet.toObject
                        ? pet.toObject()
                        : pet,
                    instanceId:
                        makeInstanceId()
                });

                await sender.save({session});
                await receiver.save({session});
            }
        );

        res.json({
            success:true
        });

    }catch(error){

        res.status(400).json({
            message:error.message
        });

    }finally{
        await session.endSession();
    }
});


/*
====================================================
LEADERBOARD
====================================================
*/

app.get("/leaderboard",async(req,res)=>{

    const players =
        await User.find({})
        .sort({wagered:-1})
        .limit(10)
        .select(
            "username avatar wagered profit"
        )
        .lean();

    res.json({
        players
    });
});


/*
====================================================
USER PROFILE
====================================================
*/

app.get("/users/:id",async(req,res)=>{

    const user =
        await User.findById(
            req.params.id
        )
        .select(
            "username avatar wagered profit"
        )
        .lean();

    if(!user){
        return res.status(404).json({
            message:"User not found."
        });
    }

    res.json({
        user:{
            id:String(user._id),
            username:user.username,
            avatar:user.avatar,
            wagered:user.wagered || 0,
            profit:user.profit || 0
        }
    });
});


/*
====================================================
CHAT
====================================================
*/

const bannedLinkRegex =
    /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|bit\.ly\/|tinyurl\.com|[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|ly)\b)/i;

const bannedContentRegex =
    /\b(sex|sexual|porn|nude|nudes)\b/i;

function cleanChatMessage(message){

    let value =
        String(message || "")
        .replace(/\s+/g," ")
        .trim();

    if(!value){
        throw new Error("Message is empty.");
    }

    if(value.length > 300){
        throw new Error("Message is too long.");
    }

    if(bannedLinkRegex.test(value)){
        throw new Error(
            "Links and site advertising are not allowed."
        );
    }

    if(bannedContentRegex.test(value)){
        throw new Error(
            "That content is not allowed."
        );
    }

    return value;
}


function onlineNumber(){

    /*
    Stable for the process instead of changing
    on every refresh.
    */

    const now =
        Math.floor(
            Date.now()/100000
        );

    let x =
        Math.sin(now * 12.9898) * 43758.5453;

    x =
        x - Math.floor(x);

    return 20 + Math.floor(x * 26);
}


app.post("/presence",auth,async(req,res)=>{
    res.json({
        online:onlineNumber()
    });
});


app.get("/chat",async(req,res)=>{

    const rows =
        await Chat.find({})
        .sort({createdAt:-1})
        .limit(100)
        .lean();

    rows.reverse();

    res.json({
        online:onlineNumber(),

        messages:rows.map((x,i)=>({
            id:
                Number(
                    new Date(x.createdAt)
                ) + i,

            userId:x.userId,
            username:x.username,
            avatar:x.avatar,
            message:x.message
        }))
    });
});


app.post("/chat",auth,async(req,res)=>{

    try{

        const message =
            cleanChatMessage(
                req.body.message
            );

        const user =
            await User.findById(
                req.auth.sub
            ).lean();

        if(!user){
            return res.status(401).json({
                message:"User not found."
            });
        }

        await Chat.create({
            userId:String(user._id),
            username:user.username,
            avatar:user.avatar,
            message
        });

        /*
        Keep chat database small.
        */

        const count =
            await Chat.countDocuments();

        if(count > 500){
            const old =
                await Chat.find({})
                .sort({createdAt:1})
                .limit(count-500)
                .select("_id")
                .lean();

            await Chat.deleteMany({
                _id:{
                    $in:old.map(x=>x._id)
                }
            });
        }

        res.json({
            success:true
        });

    }catch(error){

        res.status(400).json({
            message:error.message
        });
    }
});


/*
====================================================
UTILITIES
====================================================
*/

function makeInstanceId(){
    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2)
    );
}


/*
====================================================
TELEGRAM
====================================================

Keep your existing telegram.js.

IMPORTANT:
Only run ONE Telegram bot process using polling.
The 409 error means another polling instance is
already using the same bot token.
*/

try{
    require("./telegram");
    console.log("Telegram module loaded.");
}catch(error){
    console.warn(
        "Telegram module not loaded:",
        error.message
    );
}


/*
====================================================
START
====================================================
*/

app.listen(PORT,()=>{
    console.log(
        `ADMFLIP backend running on port ${PORT}`
    );
});
