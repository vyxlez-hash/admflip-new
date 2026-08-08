const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const app = express();

const PORT = process.env.PORT || 3000;

const FRONTEND_URL =
    process.env.FRONTEND_URL || "*";

const JWT_SECRET =
    process.env.JWT_SECRET || "CHANGE_THIS_SECRET";


/* =========================
   MIDDLEWARE
========================= */

app.use(cors({
    origin: FRONTEND_URL === "*"
        ? true
        : FRONTEND_URL,
    credentials:false
}));

app.use(express.json({
    limit:"100kb"
}));

app.use(rateLimit({
    windowMs:60 * 1000,
    max:120,
    standardHeaders:true,
    legacyHeaders:false
}));


/* =========================
   MONGODB
========================= */

if(!process.env.MONGO_URL){

    console.error(
        "MONGO_URL is missing."
    );

}else{

    console.log(
        "Mongo URL exists:",
        true
    );

    mongoose.connect(
        process.env.MONGO_URL
    )
    .then(() => {

        console.log(
            "MongoDB connected"
        );

    })
    .catch(error => {

        console.error(
            "MongoDB error:",
            error.message
        );

    });
}


/* =========================
   SCHEMAS
========================= */

const petSchema =
    new mongoose.Schema(
        {
            name:{
                type:String,
                required:true
            },

            value:{
                type:Number,
                required:true,
                min:0
            },

            image:{
                type:String,
                default:""
            },

            fly:{
                type:Boolean,
                default:false
            },

            ride:{
                type:Boolean,
                default:false
            },

            neon:{
                type:Boolean,
                default:false
            },

            megaNeon:{
                type:Boolean,
                default:false
            }
        },
        {
            _id:true
        }
    );


const userSchema =
    new mongoose.Schema(
        {
            robloxId:{
                type:Number,
                unique:true,
                index:true
            },

            username:{
                type:String,
                required:true,
                index:true
            },

            avatar:{
                type:String,
                default:""
            },

            balance:{
                type:Number,
                default:0
            },

            inventory:{
                type:[petSchema],
                default:[]
            },

            wagered:{
                type:Number,
                default:0
            },

            profit:{
                type:Number,
                default:0
            }
        },
        {
            timestamps:true
        }
    );


const coinflipSchema =
    new mongoose.Schema(
        {
            creator:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"User",
                required:true,
                index:true
            },

            username:String,

            pet:{
                type:petSchema,
                required:true
            },

            side:{
                type:String,
                enum:["heads","tails"],
                required:true
            },

            status:{
                type:String,
                enum:[
                    "active",
                    "completed",
                    "cancelled"
                ],
                default:"active",
                index:true
            },

            opponent:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"User",
                default:null
            }
        },
        {
            timestamps:true
        }
    );


const messageSchema =
    new mongoose.Schema(
        {
            username:String,

            robloxId:Number,

            avatar:String,

            text:String
        },
        {
            timestamps:true
        }
    );


const settingsSchema =
    new mongoose.Schema(
        {
            siteOnline:{
                type:Boolean,
                default:true
            },

            announcement:{
                type:String,
                default:""
            }
        }
    );


const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        userSchema
    );

const Coinflip =
    mongoose.models.Coinflip ||
    mongoose.model(
        "Coinflip",
        coinflipSchema
    );

const Message =
    mongoose.models.Message ||
    mongoose.model(
        "Message",
        messageSchema
    );

const Settings =
    mongoose.models.Settings ||
    mongoose.model(
        "Settings",
        settingsSchema
    );


/* =========================
   PET VALUES
========================= */

function loadPets(){

    try{

        const file =
            path.join(
                __dirname,
                "values.txt"
            );

        const text =
            fs.readFileSync(
                file,
                "utf8"
            );

        const lines =
            text
                .split(/\r?\n/)
                .map(x => x.trim())
                .filter(Boolean);

        const result = [];

        for(
            let i = 0;
            i < lines.length;
            i += 2
        ){

            const name =
                lines[i];

            let value =
                lines[i + 1];

            if(!name || !value){
                continue;
            }

            value =
                value
                    .replace(/[^0-9.]/g,"");

            const number =
                Number(value);

            if(!Number.isFinite(number)){
                continue;
            }

            result.push({
                name,
                value:number,
                image:""
            });
        }

        console.log(
            "Loaded pets:",
            result.length
        );

        return result;

    }
    catch(error){

        console.error(
            "values.txt error:",
            error.message
        );

        return [];
    }
}

const pets =
    loadPets();


/* =========================
   AUTH
========================= */

function createToken(user){

    return jwt.sign(
        {
            id:user._id.toString(),
            robloxId:user.robloxId,
            username:user.username
        },
        JWT_SECRET,
        {
            expiresIn:"30d"
        }
    );
}


function auth(req,res,next){

    const header =
        req.headers.authorization || "";

    if(!header.startsWith("Bearer ")){

        return res.status(401).json({
            success:false,
            message:"Sign in first."
        });
    }

    const token =
        header.slice(7);

    try{

        req.auth =
            jwt.verify(
                token,
                JWT_SECRET
            );

        next();

    }
    catch{

        return res.status(401).json({
            success:false,
            message:"Your session expired. Sign in again."
        });
    }
}


/* =========================
   HOME
========================= */

app.get("/",(req,res)=>{

    res.json({
        success:true,
        message:"ADMFLIP backend is online"
    });
});


/* =========================
   STATUS
========================= */

app.get("/status",async(req,res)=>{

    try{

        let settings =
            await Settings.findOne();

        if(!settings){

            settings =
                await Settings.create({});
        }

        /*
         * Stable count.
         * It changes slowly instead of every refresh.
         */

        const minute =
            Math.floor(
                Date.now() / 120000
            );

        const online =
            30 + (
                minute % 25
            );

        res.json({
            online,
            siteOnline:
                settings.siteOnline,
            announcement:
                settings.announcement
        });

    }
    catch{

        res.json({
            online:42,
            siteOnline:true,
            announcement:""
        });
    }
});


/* =========================
   PET VALUES
========================= */

app.get("/pets",(req,res)=>{

    res.json({
        success:true,
        pets
    });
});


/* =========================
   ROBLOX USER
========================= */

app.get(
    "/user/:username",
    async(req,res)=>{

        try{

            const username =
                req.params.username.trim();

            const response =
                await fetch(
                    "https://users.roblox.com/v1/usernames/users",
                    {
                        method:"POST",
                        headers:{
                            "Content-Type":
                                "application/json"
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
                !data.data.length
            ){

                return res.json({
                    success:false,
                    message:
                        "Roblox username not found."
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
                        avatarData.data?.[0]
                            ?.imageUrl || ""
                }
            });

        }
        catch(error){

            console.error(error);

            res.status(500).json({
                success:false,
                message:
                    "Roblox lookup failed."
            });
        }
    }
);


/* =========================
   PHRASE
========================= */

function generatePhrase(){

    const words = [
        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GoldenLeaf",
        "PurpleFox",
        "NeonStar"
    ];

    return (
        words[
            Math.floor(
                Math.random() *
                words.length
            )
        ] +
        "-" +
        Math.floor(
            1000 +
            Math.random() * 9000
        )
    );
}


app.get("/create",(req,res)=>{

    res.json({
        phrase:
            generatePhrase()
    });
});


/* =========================
   VERIFY
========================= */

app.post(
    "/check",
    async(req,res)=>{

        try{

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const phrase =
                String(
                    req.body.phrase || ""
                ).trim();

            if(!username || !phrase){

                return res.status(400).json({
                    success:false,
                    message:
                        "Username and phrase are required."
                });
            }

            const response =
                await fetch(
                    "https://users.roblox.com/v1/usernames/users",
                    {
                        method:"POST",
                        headers:{
                            "Content-Type":
                                "application/json"
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
                !data.data.length
            ){

                return res.json({
                    success:false,
                    message:
                        "Roblox username not found."
                });
            }

            const roblox =
                data.data[0];

            const profileResponse =
                await fetch(
                    `https://users.roblox.com/v1/users/${roblox.id}`
                );

            const profile =
                await profileResponse.json();

            if(
                !profile.description ||
                !profile.description.includes(
                    phrase
                )
            ){

                return res.json({
                    success:false,
                    message:
                        "Verification phrase not found in your Roblox bio."
                });
            }

            const avatarResponse =
                await fetch(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${roblox.id}&size=150x150&format=Png`
                );

            const avatarData =
                await avatarResponse.json();

            const avatar =
                avatarData.data?.[0]
                    ?.imageUrl || "";

            const user =
                await User.findOneAndUpdate(
                    {
                        robloxId:roblox.id
                    },
                    {
                        $set:{
                            username:roblox.name,
                            avatar
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
                    id:user._id,
                    robloxId:user.robloxId,
                    username:user.username,
                    avatar:user.avatar
                }
            });

        }
        catch(error){

            console.error(error);

            res.status(500).json({
                success:false,
                message:
                    "Verification failed."
            });
        }
    }
);


/* =========================
   INVENTORY
========================= */

app.get(
    "/inventory",
    auth,
    async(req,res)=>{

        try{

            const user =
                await User.findById(
                    req.auth.id
                ).lean();

            if(!user){

                return res.status(404).json({
                    success:false,
                    message:"User not found."
                });
            }

            res.json({
                success:true,
                inventory:
                    user.inventory || []
            });

        }
        catch{

            res.status(500).json({
                success:false,
                message:
                    "Unable to load inventory."
            });
        }
    }
);


/* =========================
   COINFLIPS
========================= */

app.get(
    "/coinflips",
    async(req,res)=>{

        try{

            const flips =
                await Coinflip
                    .find({
                        status:"active"
                    })
                    .sort({
                        createdAt:-1
                    })
                    .limit(100)
                    .lean();

            res.json({
                success:true,
                coinflips:flips.map(f => ({
                    _id:f._id,
                    username:f.username,
                    pet:f.pet,
                    side:f.side
                }))
            });

        }
        catch{

            res.status(500).json({
                success:false,
                message:
                    "Unable to load coinflips."
            });
        }
    }
);


app.post(
    "/coinflips",
    auth,
    async(req,res)=>{

        const session =
            await mongoose.startSession();

        try{

            const {
                petId,
                side
            } = req.body;

            if(
                !mongoose.isValidObjectId(
                    petId
                )
            ){

                return res.status(400).json({
                    success:false,
                    message:"Invalid pet."
                });
            }

            if(
                !["heads","tails"]
                    .includes(side)
            ){

                return res.status(400).json({
                    success:false,
                    message:"Invalid side."
                });
            }

            session.startTransaction();

            const user =
                await User.findOne(
                    {
                        _id:req.auth.id,
                        "inventory._id":petId
                    }
                ).session(session);

            if(!user){

                await session.abortTransaction();

                return res.status(400).json({
                    success:false,
                    message:
                        "That pet is not in your inventory."
                });
            }

            const pet =
                user.inventory.id(
                    petId
                );

            /*
             * Remove the exact owned pet
             * before creating the coinflip.
             */

            const petData =
                pet.toObject();

            user.inventory.pull(
                petId
            );

            await user.save({
                session
            });

            await Coinflip.create(
                [{
                    creator:user._id,
                    username:user.username,
                    pet:petData,
                    side,
                    status:"active"
                }],
                {
                    session
                }
            );

            await session.commitTransaction();

            res.json({
                success:true
            });

        }
        catch(error){

            try{
                await session.abortTransaction();
            }catch{}

            console.error(
                "Coinflip error:",
                error.message
            );

            res.status(500).json({
                success:false,
                message:
                    "Coinflip could not be created."
            });

        }
        finally{

            session.endSession();
        }
    }
);


/* =========================
   CHAT LINK BLOCK
========================= */

function containsLink(text){

    const patterns = [

        /https?:\/\//i,

        /www\./i,

        /\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|tv|ly)\b/i,

        /\bdiscord\.gg\b/i,

        /\bdiscord\.com\b/i,

        /\bt\.me\b/i,

        /\btelegram\.me\b/i

    ];

    return patterns.some(
        regex => regex.test(text)
    );
}


app.get(
    "/chat",
    async(req,res)=>{

        try{

            const messages =
                await Message
                    .find()
                    .sort({
                        createdAt:-1
                    })
                    .limit(80)
                    .lean();

            const settings =
                await Settings.findOne();

            res.json({
                success:true,

                messages:
                    messages.reverse(),

                announcement:
                    settings?.announcement || "",

                online:
                    30 + (
                        Math.floor(
                            Date.now() / 120000
                        ) % 25
                    )
            });

        }
        catch{

            res.status(500).json({
                success:false,
                messages:[]
            });
        }
    }
);


app.post(
    "/chat",
    auth,
    async(req,res)=>{

        try{

            const text =
                String(
                    req.body.text || ""
                ).trim();

            if(!text){

                return res.status(400).json({
                    success:false,
                    message:
                        "Message cannot be empty."
                });
            }

            if(text.length > 300){

                return res.status(400).json({
                    success:false,
                    message:
                        "Message is too long."
                });
            }

            if(containsLink(text)){

                return res.status(400).json({
                    success:false,
                    message:
                        "Links and advertising are not allowed in chat."
                });
            }

            const user =
                await User.findById(
                    req.auth.id
                );

            if(!user){

                return res.status(401).json({
                    success:false,
                    message:
                        "Sign in first."
                });
            }

            await Message.create({
                username:user.username,
                robloxId:user.robloxId,
                avatar:user.avatar,
                text
            });

            /*
             * Keep chat database small.
             */

            const count =
                await Message.countDocuments();

            if(count > 500){

                const old =
                    await Message
                        .find()
                        .sort({
                            createdAt:1
                        })
                        .limit(
                            count - 500
                        )
                        .select("_id")
                        .lean();

                await Message.deleteMany({
                    _id:{
                        $in:
                            old.map(
                                x => x._id
                            )
                    }
                });
            }

            res.json({
                success:true
            });

        }
        catch(error){

            console.error(error);

            res.status(500).json({
                success:false,
                message:
                    "Message could not be sent."
            });
        }
    }
);


/* =========================
   LEADERBOARD
========================= */

app.get(
    "/leaderboard",
    async(req,res)=>{

        try{

            const users =
                await User
                    .find({
                        wagered:{
                            $gt:0
                        }
                    })
                    .sort({
                        wagered:-1
                    })
                    .limit(50)
                    .select(
                        "username avatar wagered profit"
                    )
                    .lean();

            res.json({
                success:true,
                users
            });

        }
        catch{

            res.status(500).json({
                success:false,
                users:[]
            });
        }
    }
);


/* =========================
   PET IMAGE PROXY
========================= */

/*
 * This is deliberately a fallback.
 *
 * External calculator sites can change their
 * HTML at any time, so the frontend does not
 * depend on them directly.
 */

const imageCache =
    new Map();


async function findPetImage(name){

    const key =
        name.toLowerCase();

    if(imageCache.has(key)){
        return imageCache.get(key);
    }

    try{

        const url =
            "https://elvebredd.com/adopt-me-calculator";

        const response =
            await fetch(
                url,
                {
                    headers:{
                        "User-Agent":
                            "ADMFLIP value client"
                    }
                }
            );

        if(!response.ok){
            return "";
        }

        const html =
            await response.text();

        const $ =
            cheerio.load(html);

        let found = "";

        $("img").each(
            (_,element) => {

                if(found){
                    return;
                }

                const src =
                    $(element).attr("src");

                const alt =
                    (
                        $(element).attr("alt") ||
                        ""
                    ).toLowerCase();

                if(
                    src &&
                    alt.includes(key)
                ){

                    found = src;
                }
            }
        );

        if(
            found &&
            found.startsWith("/")
        ){

            found =
                new URL(
                    found,
                    url
                ).href;
        }

        imageCache.set(
            key,
            found || ""
        );

        return found || "";

    }
    catch{

        return "";
    }
}


app.get(
    "/pet-image/:name",
    async(req,res)=>{

        const name =
            req.params.name;

        const image =
            await findPetImage(
                name
            );

        if(!image){

            return res.status(404).end();
        }

        res.redirect(image);
    }
);


/* =========================
   TELEGRAM
========================= */

try{

    require("./telegram");

    console.log(
        "Telegram module loaded."
    );

}
catch(error){

    console.log(
        "Telegram module not loaded:",
        error.message
    );
}


/* =========================
   START
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );

    }
);
