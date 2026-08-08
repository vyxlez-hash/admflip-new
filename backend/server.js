const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");
const cheerio = require("cheerio");

const app = express();

const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_SECRET_IN_RENDER";

const ADMIN_TELEGRAM_ID =
    String(process.env.TELEGRAM_ADMIN_ID || "");

const IMAGE_SOURCE =
    "https://elvebredd.com/adopt-me-calculator";


// =====================================================
// EXPRESS
// =====================================================

app.set("trust proxy", 1);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({
    limit: "100kb"
}));


app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
}));


// =====================================================
// DATABASE
// =====================================================

console.log(
    "Mongo URL exists:",
    !!MONGO_URL
);

if (!MONGO_URL) {

    console.error(
        "MONGO_URL is missing"
    );

}


mongoose.connect(MONGO_URL || "")
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


// =====================================================
// USER SCHEMA
// =====================================================

const PetSchema = new mongoose.Schema({

    petId: {
        type: String,
        required: true,
        unique: false
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    variant: {
        type: String,
        enum: [
            "NP",
            "R",
            "F",
            "FR",
            "N",
            "NR",
            "NF",
            "NFR",
            "M",
            "MR",
            "MF",
            "MFR"
        ],
        default: "NP"
    },

    value: {
        type: Number,
        required: true,
        min: 0
    },

    image: {
        type: String,
        default: ""
    },

    locked: {
        type: Boolean,
        default: false
    }

}, {
    _id: false
});


const UserSchema = new mongoose.Schema({

    robloxId: {
        type: Number,
        required: true,
        unique: true
    },

    username: {
        type: String,
        required: true,
        index: true
    },

    avatar: {
        type: String,
        default: ""
    },

    balance: {
        type: Number,
        default: 0,
        min: 0
    },

    wagered: {
        type: Number,
        default: 0,
        min: 0
    },

    profit: {
        type: Number,
        default: 0
    },

    inventory: {
        type: [PetSchema],
        default: []
    }

}, {
    timestamps: true
});


const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        UserSchema
    );


// =====================================================
// SETTINGS
// =====================================================

const SettingsSchema = new mongoose.Schema({

    siteOnline: {
        type: Boolean,
        default: true
    },

    announcement: {
        type: String,
        default: ""
    }

});


const Settings =
    mongoose.models.Settings ||
    mongoose.model(
        "Settings",
        SettingsSchema
    );


// =====================================================
// CHAT
// =====================================================

const ChatSchema = new mongoose.Schema({

    type: {
        type: String,
        enum: [
            "message",
            "announcement"
        ],
        default: "message"
    },

    userId: {
        type: Number,
        default: null
    },

    username: {
        type: String,
        default: ""
    },

    avatar: {
        type: String,
        default: ""
    },

    content: {
        type: String,
        required: true,
        maxlength: 500
    }

}, {
    timestamps: true
});


const Chat =
    mongoose.models.Chat ||
    mongoose.model(
        "Chat",
        ChatSchema
    );


// =====================================================
// COINFLIP
// =====================================================

const CoinflipSchema = new mongoose.Schema({

    flipId: {
        type: String,
        unique: true,
        required: true
    },

    creatorId: {
        type: Number,
        required: true
    },

    creatorUsername: {
        type: String,
        required: true
    },

    petId: {
        type: String,
        required: true
    },

    petName: {
        type: String,
        required: true
    },

    petVariant: {
        type: String,
        required: true
    },

    petValue: {
        type: Number,
        required: true
    },

    petImage: {
        type: String,
        default: ""
    },

    side: {
        type: String,
        enum: [
            "heads",
            "tails"
        ],
        required: true
    },

    status: {
        type: String,
        enum: [
            "open",
            "matched",
            "finished",
            "cancelled"
        ],
        default: "open"
    },

    opponentId: {
        type: Number,
        default: null
    },

    winnerId: {
        type: Number,
        default: null
    }

}, {
    timestamps: true
});


const Coinflip =
    mongoose.models.Coinflip ||
    mongoose.model(
        "Coinflip",
        CoinflipSchema
    );


// =====================================================
// PET VALUE CACHE
// =====================================================

const PetValueSchema = new mongoose.Schema({

    name: {
        type: String,
        unique: true,
        required: true
    },

    value: {
        type: Number,
        default: 0
    },

    image: {
        type: String,
        default: ""
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }

});


const PetValue =
    mongoose.models.PetValue ||
    mongoose.model(
        "PetValue",
        PetValueSchema
    );


// =====================================================
// HELPERS
// =====================================================

function makePetId() {

    return crypto
        .randomUUID();

}


function makeFlipId() {

    return crypto
        .randomUUID();

}


function signToken(user) {

    return jwt.sign({

        userId: user.robloxId,

        username: user.username

    }, JWT_SECRET, {
        expiresIn: "30d"
    });

}


function auth(req, res, next) {

    try {

        const header =
            req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {

            return res.status(401).json({

                success: false,

                message: "Authentication required"

            });

        }


        const token =
            header.substring(7);


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.auth = decoded;

        next();

    }
    catch {

        return res.status(401).json({

            success: false,

            message: "Invalid or expired login"

        });

    }

}


async function getCurrentUser(req) {

    return User.findOne({
        robloxId: req.auth.userId
    });

}


function cleanText(value, max = 500) {

    return String(value || "")
        .trim()
        .slice(0, max);

}


function containsLink(text) {

    const value =
        String(text || "")
            .toLowerCase();


    const patterns = [

        /https?:\/\//i,

        /www\./i,

        /\b[a-z0-9-]+\.(com|net|org|gg|io|me|xyz|co|tv|dev)\b/i,

        /discord\.gg/i,

        /discord\.com/i,

        /t\.me\//i

    ];


    return patterns.some(
        regex => regex.test(value)
    );

}


function normalizeVariant(value) {

    const variant =
        String(value || "NP")
            .toUpperCase();


    const valid = [

        "NP",
        "R",
        "F",
        "FR",
        "N",
        "NR",
        "NF",
        "NFR",
        "M",
        "MR",
        "MF",
        "MFR"

    ];


    return valid.includes(variant)
        ? variant
        : "NP";

}


// =====================================================
// PET VALUES FILE
// =====================================================

function loadLocalPets() {

    try {

        if (!fs.existsSync("./values.txt")) {

            return [];

        }


        const text =
            fs.readFileSync(
                "./values.txt",
                "utf8"
            );


        const lines =
            text
                .split(/\r?\n/)
                .map(x => x.trim())
                .filter(Boolean);


        const result = [];


        for (
            let i = 0;
            i < lines.length;
            i += 2
        ) {

            const name =
                lines[i];

            let value =
                lines[i + 1];


            if (!name || !value) {

                continue;

            }


            /*
             * IMPORTANT:
             *
             * The old code used:
             *
             * .replace(/./g, "")
             *
             * which removed EVERYTHING.
             *
             * This version only removes commas/currency.
             */

            value =
                String(value)
                    .replace(/[$,]/g, "")
                    .replace(/[^\d.]/g, "");


            const number =
                Number(value);


            if (!Number.isFinite(number)) {

                continue;

            }


            result.push({

                name,

                value: number,

                image: ""

            });

        }


        return result;

    }
    catch (error) {

        console.error(
            "Values file error:",
            error.message
        );

        return [];

    }

}


const localPets =
    loadLocalPets();


console.log(
    "Loaded local pets:",
    localPets.length
);


// =====================================================
// IMAGE LOOKUP
// =====================================================

let imagePageCache = null;

let imagePageCacheTime = 0;


async function getCalculatorHTML() {

    const now =
        Date.now();


    /*
     * Cache the page for 30 minutes.
     * Do not request the external site for every user.
     */

    if (
        imagePageCache &&
        now - imagePageCacheTime <
            30 * 60 * 1000
    ) {

        return imagePageCache;

    }


    const response =
        await fetch(
            IMAGE_SOURCE,
            {
                headers: {
                    "User-Agent":
                        "ADMFLIP/2.0"
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            "Calculator image source unavailable"
        );

    }


    imagePageCache =
        await response.text();

    imagePageCacheTime =
        now;


    return imagePageCache;

}


async function findPetImage(name) {

    /*
     * First use Mongo cache.
     */

    const cached =
        await PetValue.findOne({
            name: {
                $regex:
                    new RegExp(
                        "^" +
                        escapeRegex(name) +
                        "$",
                        "i"
                    )
            }
        }).lean();


    if (
        cached &&
        cached.image
    ) {

        return cached.image;

    }


    try {

        const html =
            await getCalculatorHTML();


        const $ =
            cheerio.load(html);


        let found = "";


        $("img").each(
            (_, element) => {

                if (found) return;


                const src =
                    $(element)
                        .attr("src");


                const alt =
                    $(element)
                        .attr("alt") ||
                    "";


                const title =
                    $(element)
                        .attr("title") ||
                    "";


                const combined =
                    `${alt} ${title}`
                        .toLowerCase();


                if (
                    combined.includes(
                        name.toLowerCase()
                    ) &&
                    src
                ) {

                    found =
                        makeAbsoluteURL(
                            src
                        );

                }

            }
        );


        return found;

    }
    catch (error) {

        console.error(
            "Pet image lookup:",
            error.message
        );

        return "";

    }

}


function escapeRegex(value) {

    return String(value)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

}


function makeAbsoluteURL(src) {

    if (!src) return "";

    if (
        src.startsWith("http://") ||
        src.startsWith("https://")
    ) {

        return src;

    }


    if (src.startsWith("//")) {

        return "https:" + src;

    }


    if (src.startsWith("/")) {

        return "https://elvebredd.com" + src;

    }


    return "";
}


// =====================================================
// PET VALUE LOOKUP
// =====================================================

async function getPetValue(name) {

    const local =
        localPets.find(
            pet =>
                pet.name.toLowerCase() ===
                String(name).toLowerCase()
        );


    if (local) {

        return local.value;

    }


    const cached =
        await PetValue.findOne({

            name: {
                $regex:
                    new RegExp(
                        "^" +
                        escapeRegex(name) +
                        "$",
                        "i"
                    )
            }

        }).lean();


    if (cached) {

        return cached.value;

    }


    return 0;

}


async function getPetMetadata(name) {

    let record =
        await PetValue.findOne({

            name: {
                $regex:
                    new RegExp(
                        "^" +
                        escapeRegex(name) +
                        "$",
                        "i"
                    )
            }

        });


    const value =
        await getPetValue(name);


    let image =
        record?.image || "";


    if (!image) {

        image =
            await findPetImage(name);

    }


    if (record) {

        record.value =
            value;

        record.image =
            image;

        record.updatedAt =
            new Date();

        await record.save();

    }
    else {

        await PetValue.create({

            name,

            value,

            image,

            updatedAt:
                new Date()

        });

    }


    return {

        value,

        image

    };

}


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

    res.send(
        "ADMFLIP backend is online"
    );

});


// =====================================================
// STATUS
// =====================================================

app.get(
    "/status",
    async (req, res) => {

        try {

            let settings =
                await Settings.findOne();


            if (!settings) {

                settings =
                    await Settings.create({});

            }


            res.json({

                success: true,

                online:
                    settings.siteOnline,

                announcement:
                    settings.announcement

            });

        }
        catch {

            res.json({

                success: true,

                online: true,

                announcement: ""

            });

        }

    }
);


// =====================================================
// PETS
// =====================================================

app.get(
    "/pets",
    async (req, res) => {

        try {

            const values =
                localPets.map(
                    pet => ({
                        name: pet.name,
                        value: pet.value,
                        image: ""
                    })
                );


            /*
             * Add cached Mongo images.
             */

            const cached =
                await PetValue.find({});


            const cacheMap =
                new Map();


            for (const item of cached) {

                cacheMap.set(
                    item.name.toLowerCase(),
                    item
                );

            }


            const result =
                values.map(pet => {

                    const cachedItem =
                        cacheMap.get(
                            pet.name.toLowerCase()
                        );


                    return {

                        name: pet.name,

                        value:
                            pet.value,

                        image:
                            cachedItem?.image ||
                            ""

                    };

                });


            res.json({

                success: true,

                pets: result

            });

        }
        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Unable to load pets"

            });

        }

    }
);


// =====================================================
// PET IMAGE
// =====================================================

app.get(
    "/pet-image/:name",
    async (req, res) => {

        try {

            const name =
                req.params.name;


            const metadata =
                await getPetMetadata(
                    name
                );


            res.json({

                success: true,

                name,

                value:
                    metadata.value,

                image:
                    metadata.image

            });

        }
        catch {

            res.status(500).json({

                success: false,

                image: ""

            });

        }

    }
);


// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

app.get(
    "/user/:username",
    async (req, res) => {

        try {

            const username =
                req.params.username;


            const response =
                await fetch(

                    "https://users.roblox.com/v1/usernames/users",

                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                usernames: [
                                    username
                                ],

                                excludeBannedUsers:
                                    true

                            })

                    }

                );


            const data =
                await response.json();


            if (
                !data.data ||
                !data.data.length
            ) {

                return res.json({

                    success: false,

                    message:
                        "Roblox username not found"

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

                success: true,

                user: {

                    id: user.id,

                    username:
                        user.name,

                    avatar:
                        avatarData
                            ?.data?.[0]
                            ?.imageUrl || ""

                }

            });

        }
        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Server error"

            });

        }

    }
);


// =====================================================
// CREATE PHRASE
// =====================================================

function generatePhrase() {

    const words = [

        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GoldenLeaf",
        "PurpleFox",
        "RapidStar",
        "CrystalMoon"

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


app.get(
    "/create",
    (req, res) => {

        res.json({

            phrase:
                generatePhrase()

        });

    }
);


// =====================================================
// VERIFY ROBLOX BIO + CREATE AUTH TOKEN
// =====================================================

app.post(
    "/check",
    async (req, res) => {

        try {

            const {
                username,
                phrase
            } = req.body;


            if (
                !username ||
                !phrase
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Missing username or phrase"

                });

            }


            const response =
                await fetch(

                    "https://users.roblox.com/v1/usernames/users",

                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                usernames: [
                                    username
                                ],

                                excludeBannedUsers:
                                    true

                            })

                    }

                );


            const data =
                await response.json();


            if (
                !data.data ||
                !data.data.length
            ) {

                return res.json({

                    success: false,

                    message:
                        "Roblox username not found"

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


            if (
                !profile.description ||
                !profile.description.includes(
                    phrase
                )
            ) {

                return res.json({

                    success: false,

                    message:
                        "Verification phrase not found"

                });

            }


            const avatarResponse =
                await fetch(

                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`

                );


            const avatarData =
                await avatarResponse.json();


            const avatar =
                avatarData
                    ?.data?.[0]
                    ?.imageUrl || "";


            let user =
                await User.findOne({
                    robloxId: id
                });


            if (!user) {

                user =
                    await User.create({

                        robloxId: id,

                        username:
                            profile.name,

                        avatar,

                        inventory: []

                    });

            }
            else {

                user.username =
                    profile.name;

                user.avatar =
                    avatar;

                await user.save();

            }


            const token =
                signToken(user);


            res.json({

                success: true,

                token,

                username:
                    user.username,

                id:
                    user.robloxId,

                avatar:
                    user.avatar

            });

        }
        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Verification failed"

            });

        }

    }
);


// =====================================================
// CURRENT USER
// =====================================================

app.get(
    "/me",
    auth,
    async (req, res) => {

        const user =
            await getCurrentUser(req);


        if (!user) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        res.json({

            success: true,

            user: {

                id:
                    user.robloxId,

                username:
                    user.username,

                avatar:
                    user.avatar,

                balance:
                    user.balance,

                wagered:
                    user.wagered,

                profit:
                    user.profit,

                inventory:
                    user.inventory

            }

        });

    }
);


// =====================================================
// INVENTORY
// =====================================================

app.get(
    "/inventory",
    auth,
    async (req, res) => {

        const user =
            await getCurrentUser(req);


        if (!user) {

            return res.status(404).json({

                success: false

            });

        }


        res.json({

            success: true,

            inventory:
                user.inventory.filter(
                    pet =>
                        !pet.locked
                )

        });

    }
);


// =====================================================
// PUBLIC PROFILE
// =====================================================

app.get(
    "/profile/:robloxId",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.robloxId
                );


            if (!Number.isFinite(id)) {

                return res.status(400).json({

                    success: false

                });

            }


            const user =
                await User.findOne({
                    robloxId: id
                }).lean();


            if (!user) {

                return res.status(404).json({

                    success: false

                });

            }


            res.json({

                success: true,

                user: {

                    id:
                        user.robloxId,

                    username:
                        user.username,

                    avatar:
                        user.avatar,

                    wagered:
                        user.wagered,

                    profit:
                        user.profit

                }

            });

        }
        catch {

            res.status(500).json({

                success: false

            });

        }

    }
);


// =====================================================
// TIP
// =====================================================

app.post(
    "/tip",
    auth,
    async (req, res) => {

        const session =
            await mongoose.startSession();


        try {

            const {
                receiverId,
                petId
            } = req.body;


            const receiver =
                Number(receiverId);


            if (
                !Number.isFinite(receiver) ||
                !petId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid tip"

                });

            }


            if (
                receiver ===
                req.auth.userId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You cannot tip yourself"

                });

            }


            let result;


            await session.withTransaction(
                async () => {

                    const sender =
                        await User.findOne({
                            robloxId:
                                req.auth.userId
                        }).session(session);


                    const target =
                        await User.findOne({
                            robloxId:
                                receiver
                        }).session(session);


                    if (!sender || !target) {

                        throw new Error(
                            "User not found"
                        );

                    }


                    const index =
                        sender.inventory.findIndex(
                            pet =>
                                pet.petId ===
                                    petId &&
                                !pet.locked
                        );


                    if (index === -1) {

                        throw new Error(
                            "Pet not available"
                        );

                    }


                    const pet =
                        sender.inventory[index];


                    /*
                     * Remove exact pet.
                     */

                    sender.inventory.splice(
                        index,
                        1
                    );


                    /*
                     * Create a new object with
                     * the SAME unique pet ID.
                     */

                    target.inventory.push(
                        pet
                    );


                    await sender.save({
                        session
                    });


                    await target.save({
                        session
                    });


                    result = {

                        name:
                            pet.name,

                        value:
                            pet.value

                    };

                }
            );


            res.json({

                success: true,

                message:
                    "Pet tipped successfully",

                pet: result

            });

        }
        catch (error) {

            console.error(
                "Tip error:",
                error.message
            );


            res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Tip failed"

            });

        }
        finally {

            await session.endSession();

        }

    }
);


// =====================================================
// COINFLIP LIST
// =====================================================

app.get(
    "/coinflips",
    async (req, res) => {

        const flips =
            await Coinflip.find({

                status: "open"

            })
                .sort({
                    createdAt: -1
                })
                .limit(100)
                .lean();


        res.json({

            success: true,

            flips

        });

    }
);


// =====================================================
// CREATE COINFLIP
// =====================================================

app.post(
    "/coinflips",
    auth,
    async (req, res) => {

        const session =
            await mongoose.startSession();


        try {

            const {
                petId,
                side
            } = req.body;


            if (
                !petId ||
                ![
                    "heads",
                    "tails"
                ].includes(side)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid flip"

                });

            }


            let created;


            await session.withTransaction(
                async () => {

                    const user =
                        await User.findOne({
                            robloxId:
                                req.auth.userId
                        }).session(session);


                    if (!user) {

                        throw new Error(
                            "User not found"
                        );

                    }


                    const index =
                        user.inventory.findIndex(
                            pet =>
                                pet.petId ===
                                    petId &&
                                !pet.locked
                        );


                    if (index === -1) {

                        throw new Error(
                            "Pet not available"
                        );

                    }


                    const pet =
                        user.inventory[index];


                    /*
                     * Lock the exact pet.
                     */

                    user.inventory[index]
                        .locked = true;


                    await user.save({
                        session
                    });


                    const flip =
                        await Coinflip.create(
                            [{
                                flipId:
                                    makeFlipId(),

                                creatorId:
                                    user.robloxId,

                                creatorUsername:
                                    user.username,

                                petId:
                                    pet.petId,

                                petName:
                                    pet.name,

                                petVariant:
                                    pet.variant,

                                petValue:
                                    pet.value,

                                petImage:
                                    pet.image,

                                side,

                                status:
                                    "open"

                            }],
                            {
                                session
                            }
                        );


                    created =
                        flip[0];

                }
            );


            res.json({

                success: true,

                flip: created

            });

        }
        catch (error) {

            res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Could not create flip"

            });

        }
        finally {

            await session.endSession();

        }

    }
);


// =====================================================
// CANCEL COINFLIP
// =====================================================

app.post(
    "/coinflips/:flipId/cancel",
    auth,
    async (req, res) => {

        const session =
            await mongoose.startSession();


        try {

            await session.withTransaction(
                async () => {

                    const flip =
                        await Coinflip.findOne({

                            flipId:
                                req.params.flipId,

                            creatorId:
                                req.auth.userId,

                            status:
                                "open"

                        }).session(session);


                    if (!flip) {

                        throw new Error(
                            "Flip not found"
                        );

                    }


                    const user =
                        await User.findOne({

                            robloxId:
                                req.auth.userId

                        }).session(session);


                    const pet =
                        user.inventory.find(
                            item =>
                                item.petId ===
                                flip.petId
                        );


                    if (pet) {

                        pet.locked = false;

                    }


                    flip.status =
                        "cancelled";


                    await user.save({
                        session
                    });


                    await flip.save({
                        session
                    });

                }
            );


            res.json({

                success: true

            });

        }
        catch (error) {

            res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }
        finally {

            await session.endSession();

        }

    }
);


// =====================================================
// CHAT GET
// =====================================================

app.get(
    "/chat",
    async (req, res) => {

        try {

            const messages =
                await Chat.find({})
                    .sort({
                        createdAt: -1
                    })
                    .limit(100)
                    .lean();


            messages.reverse();


            res.json({

                success: true,

                messages

            });

        }
        catch {

            res.status(500).json({

                success: false

            });

        }

    }
);


// =====================================================
// CHAT SEND
// =====================================================

app.post(
    "/chat",
    auth,
    async (req, res) => {

        try {

            const content =
                cleanText(
                    req.body.content,
                    300
                );


            if (!content) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Message is empty"

                });

            }


            if (containsLink(content)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Links are not allowed"

                });

            }


            const user =
                await getCurrentUser(req);


            if (!user) {

                return res.status(401).json({

                    success: false

                });

            }


            const message =
                await Chat.create({

                    type:
                        "message",

                    userId:
                        user.robloxId,

                    username:
                        user.username,

                    avatar:
                        user.avatar,

                    content

                });


            res.json({

                success: true,

                message

            });

        }
        catch {

            res.status(500).json({

                success: false,

                message:
                    "Message failed"

            });

        }

    }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );

    }
);


// =====================================================
// TELEGRAM
// =====================================================

/*
 * Telegram is loaded AFTER the HTTP server starts.
 *
 * This also means a Telegram failure does not prevent
 * the website itself from starting.
 */

try {

    require("./telegram");

    console.log(
        "Telegram module loaded"
    );

}
catch (error) {

    console.error(
        "Telegram module error:",
        error.message
    );

}
