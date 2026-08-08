const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;


// ======================================================
// BASIC MIDDLEWARE
// ======================================================

app.use(cors());

app.use(express.json({
    limit: "100kb"
}));


app.set("trust proxy", 1);


// ======================================================
// RATE LIMIT
// ======================================================

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);


// ======================================================
// MONGODB
// ======================================================

console.log(
    "Mongo URL exists:",
    !!process.env.MONGO_URL
);

let mongoConnected = false;

if (process.env.MONGO_URL) {

    mongoose.connect(process.env.MONGO_URL)
        .then(() => {

            mongoConnected = true;

            console.log(
                "MongoDB connected"
            );

        })
        .catch((error) => {

            console.log(
                "MongoDB error:",
                error.message
            );

        });

} else {

    console.log(
        "MONGO_URL is missing"
    );

}


// ======================================================
// USER MODEL
// ======================================================

const userSchema = new mongoose.Schema({

    robloxId: {
        type: Number,
        unique: true,
        sparse: true
    },

    username: {
        type: String,
        trim: true
    },

    avatar: {
        type: String,
        default: ""
    },

    inventory: {
        type: Array,
        default: []
    },

    deposited: {
        type: Array,
        default: []
    }

}, {
    timestamps: true
});


const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        userSchema
    );


// ======================================================
// SETTINGS
// ======================================================

const settingsSchema =
    new mongoose.Schema({

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
        settingsSchema
    );


// ======================================================
// CHAT MODEL
// ======================================================

const chatSchema =
    new mongoose.Schema({

        username: {
            type: String,
            required: true,
            maxlength: 30
        },

        avatar: {
            type: String,
            default: ""
        },

        message: {
            type: String,
            required: true,
            maxlength: 500
        },

        type: {
            type: String,
            enum: [
                "message",
                "announcement"
            ],
            default: "message"
        }

    }, {
        timestamps: true
    });


const Chat =
    mongoose.models.Chat ||
    mongoose.model(
        "Chat",
        chatSchema
    );


// ======================================================
// PET VALUES.TXT
// ======================================================

function loadLocalPets() {

    try {

        const text =
            fs.readFileSync(
                "./values.txt",
                "utf8"
            );


        const lines =
            text
                .split(/\r?\n/)
                .map(
                    line =>
                        line.trim()
                )
                .filter(Boolean);


        const result = [];


        for (
            let i = 0;
            i < lines.length;
            i += 2
        ) {

            let name =
                lines[i];

            let value =
                lines[i + 1];


            if (
                !name ||
                !value
            ) {
                continue;
            }


            // Keep decimals and commas.
            // Remove currency symbols.
            value =
                value
                    .replace(
                        /[$€£]/g,
                        ""
                    )
                    .replace(
                        /,/g,
                        ""
                    )
                    .trim();


            const numericValue =
                Number(value);


            if (
                Number.isNaN(
                    numericValue
                )
            ) {
                continue;
            }


            result.push({

                name,

                value:
                    numericValue

            });

        }


        console.log(
            "Loaded local pets:",
            result.length
        );


        return result;

    }
    catch (error) {

        console.log(
            "values.txt error:",
            error.message
        );

        return [];

    }

}


const localPets =
    loadLocalPets();


// ======================================================
// AMVGG CACHE
// ======================================================

let amvggPets = [];

let amvggLastUpdate = 0;

const AMVGG_CACHE_TIME =
    30 * 60 * 1000;


// ======================================================
// NORMALIZE PET NAME
// ======================================================

function normalizePetName(name) {

    return String(name)
        .toLowerCase()
        .replace(
            /\b(fly|ride|neon|mega|mega neon|m|n|f|r)\b/gi,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


// ======================================================
// NORMALIZE HTML
// ======================================================

function cleanText(value) {

    return String(value || "")
        .replace(
            /&nbsp;/gi,
            " "
        )
        .replace(
            /&amp;/gi,
            "&"
        )
        .replace(
            /&quot;/gi,
            '"'
        )
        .replace(
            /&#39;/gi,
            "'"
        )
        .replace(
            /<[^>]*>/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


// ======================================================
// EXTRACT IMAGE URL
// ======================================================

function extractImageFromTag(tag) {

    if (!tag) {
        return "";
    }


    const attributes = [

        "src",

        "data-src",

        "data-lazy-src",

        "data-original",

        "data-image"

    ];


    for (
        const attribute
        of attributes
    ) {

        const regex =
            new RegExp(
                attribute +
                '\\s*=\\s*["\\']([^"\\']+)["\\']',
                "i"
            );


        const match =
            tag.match(regex);


        if (
            match &&
            match[1]
        ) {

            let url =
                match[1];


            if (
                url.startsWith("//")
            ) {

                url =
                    "https:" +
                    url;

            }


            if (
                url.startsWith("/")
            ) {

                url =
                    "https://amvgg.com" +
                    url;

            }


            if (
                url.startsWith("http")
            ) {

                return url;

            }

        }

    }


    return "";

}


// ======================================================
// SCRAPE AMVGG
// ======================================================

async function fetchAMVGGPets() {

    const now =
        Date.now();


    if (
        amvggPets.length > 0 &&
        now - amvggLastUpdate <
            AMVGG_CACHE_TIME
    ) {

        return amvggPets;

    }


    console.log(
        "Fetching AMVGG pet values..."
    );


    try {

        const response =
            await fetch(
                "https://amvgg.com/values/pets",
                {

                    headers: {

                        "User-Agent":
                            "Mozilla/5.0 " +
                            "(compatible; ADMFLIP/1.0)",

                        "Accept":
                            "text/html"

                    }

                }
            );


        if (!response.ok) {

            throw new Error(
                "AMVGG returned " +
                response.status
            );

        }


        const html =
            await response.text();


        const pets = [];


        /*
         * AMVGG currently renders
         * pet cards in the pets value
         * list.
         *
         * We locate headings and then
         * inspect the surrounding card.
         */


        const headingRegex =
            /<(?:h2|h3|h4)[^>]*>([\s\S]*?)<\/(?:h2|h3|h4)>/gi;


        let headingMatch;


        while (
            (headingMatch =
                headingRegex.exec(html))
        ) {

            const rawName =
                cleanText(
                    headingMatch[1]
                );


            if (
                !rawName ||
                rawName.length > 100
            ) {
                continue;
            }


            const before =
                html.slice(
                    Math.max(
                        0,
                        headingMatch.index -
                        5000
                    ),
                    headingMatch.index
                );


            const after =
                html.slice(
                    headingMatch.index,
                    Math.min(
                        html.length,
                        headingMatch.index +
                        5000
                    )
                );


            const card =
                before + after;


            const valueMatch =
                card.match(
                    /Value\s*([\d.]+)/i
                );


            if (!valueMatch) {
                continue;
            }


            const value =
                Number(
                    valueMatch[1]
                );


            if (
                Number.isNaN(value)
            ) {
                continue;
            }


            const image =
                extractImageFromTag(
                    card
                );


            const duplicate =
                pets.some(
                    pet =>
                        pet.name.toLowerCase() ===
                        rawName.toLowerCase()
                );


            if (duplicate) {
                continue;
            }


            pets.push({

                name:
                    rawName,

                value,

                image,

                normalized:
                    normalizePetName(
                        rawName
                    )

            });

        }


        /*
         * Remove obviously invalid
         * headings.
         */

        const filtered =
            pets.filter(
                pet => {

                    if (
                        pet.name.length < 1
                    ) {
                        return false;
                    }


                    if (
                        pet.name
                            .toLowerCase()
                            .includes(
                                "amvgg"
                            )
                    ) {
                        return false;
                    }


                    return true;

                }
            );


        if (
            filtered.length > 0
        ) {

            amvggPets =
                filtered;

            amvggLastUpdate =
                now;

            console.log(
                "AMVGG pets loaded:",
                amvggPets.length
            );

        }
        else {

            console.log(
                "AMVGG returned no parsed pets"
            );

        }


        return amvggPets;

    }
    catch (error) {

        console.log(
            "AMVGG fetch error:",
            error.message
        );


        return amvggPets;

    }

}


// ======================================================
// MATCH LOCAL PET TO AMVGG
// ======================================================

function findAMVGGPet(
    localName
) {

    const normalized =
        normalizePetName(
            localName
        );


    if (!normalized) {
        return null;
    }


    // Exact match first.

    let match =
        amvggPets.find(
            pet =>
                pet.normalized ===
                normalized
        );


    if (match) {
        return match;
    }


    // Then loose match.

    match =
        amvggPets.find(
            pet => {

                return (
                    pet.normalized
                        .includes(
                            normalized
                        ) ||
                    normalized.includes(
                        pet.normalized
                    )
                );

            }
        );


    return match || null;

}


// ======================================================
// PET VARIANT PARSER
// ======================================================

function parsePetVariant(
    originalName
) {

    let name =
        String(originalName)
            .trim();


    let fly = false;

    let ride = false;

    let neon = false;

    let mega = false;


    /*
     * Supports:
     *
     * FR Bat Dragon
     * F R Bat Dragon
     * N Bat Dragon
     * M Bat Dragon
     * Mega Neon Bat Dragon
     * Neon Bat Dragon
     * Ride Bat Dragon
     * Fly Bat Dragon
     */


    const lower =
        name.toLowerCase();


    if (
        /\bfly\b/i.test(lower) ||
        /^\s*f\s+/i.test(lower) ||
        /\bfly\s*ride\b/i.test(lower)
    ) {

        fly = true;

    }


    if (
        /\bride\b/i.test(lower) ||
        /^\s*r\s+/i.test(lower) ||
        /\bfly\s*ride\b/i.test(lower)
    ) {

        ride = true;

    }


    if (
        /\bneon\b/i.test(lower) ||
        /^\s*n\s+/i.test(lower)
    ) {

        neon = true;

    }


    if (
        /\bmega\s*neon\b/i.test(lower) ||
        /^\s*m\s+/i.test(lower)
    ) {

        mega = true;

        neon = true;

    }


    name =
        name
            .replace(
                /\bmega\s+neon\b/gi,
                ""
            )
            .replace(
                /\bneon\b/gi,
                ""
            )
            .replace(
                /\bfly\b/gi,
                ""
            )
            .replace(
                /\bride\b/gi,
                ""
            )
            .replace(
                /^\s*[FRNM](?:\s+[FRNM])*\s+/i,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const badges = [];


    if (mega) {
        badges.push("MEGA");
    }
    else if (neon) {
        badges.push("NEON");
    }


    if (fly) {
        badges.push("FLY");
    }


    if (ride) {
        badges.push("RIDE");
    }


    return {

        name,

        fly,

        ride,

        neon,

        mega,

        badges

    };

}


// ======================================================
// PET API
// ======================================================

app.get(
    "/pets",
    async (req, res) => {

        try {

            const amvgg =
                await fetchAMVGGPets();


            const result =
                localPets.map(
                    localPet => {

                        const variant =
                            parsePetVariant(
                                localPet.name
                            );


                        const amvggPet =
                            findAMVGGPet(
                                variant.name
                            );


                        return {

                            name:
                                variant.name,

                            displayName:
                                localPet.name,

                            value:
                                localPet.value,

                            image:
                                amvggPet
                                    ? amvggPet.image
                                    : "",

                            fly:
                                variant.fly,

                            ride:
                                variant.ride,

                            neon:
                                variant.neon,

                            mega:
                                variant.mega,

                            badges:
                                variant.badges

                        };

                    }
                );


            res.json({

                success: true,

                source:
                    "AMVGG",

                pets:
                    result

            });

        }
        catch (error) {

            console.log(
                "Pets API error:",
                error.message
            );


            res.status(500).json({

                success: false,

                pets: []

            });

        }

    }
);


// ======================================================
// HOME
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.send(
            "ADMFLIP backend is online"
        );

    }
);


// ======================================================
// STATUS
// ======================================================

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

                online:
                    settings.siteOnline,

                announcement:
                    settings.announcement

            });

        }
        catch (error) {

            console.log(
                error.message
            );


            res.json({

                online: true,

                announcement: ""

            });

        }

    }
);


// ======================================================
// ROBLOX USER
// ======================================================

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
                    "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
                    "?userIds=" +
                    user.id +
                    "&size=150x150&format=Png"
                );


            const avatarData =
                await avatarResponse.json();


            res.json({

                success: true,

                user: {

                    id:
                        user.id,

                    username:
                        user.name,

                    avatar:
                        avatarData.data?.[0]
                            ?.imageUrl || ""

                }

            });

        }
        catch (error) {

            console.log(
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Server error"

            });

        }

    }
);


// ======================================================
// CREATE PHRASE
// ======================================================

function generatePhrase() {

    const words = [

        "BlueTiger",

        "FastCloud",

        "LuckyWave",

        "SilverMoon",

        "GoldenLeaf"

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
            Math.random() *
            9000
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


// ======================================================
// ROBLOX BIO VERIFY
// ======================================================

app.post(
    "/check",
    async (req, res) => {

        try {

            const {
                username,
                phrase
            } = req.body;


            if (
                typeof username !==
                "string" ||
                typeof phrase !==
                "string"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid request"

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
                profile.description &&
                profile.description.includes(
                    phrase
                )
            ) {

                if (
                    mongoConnected
                ) {

                    await User.findOneAndUpdate(

                        {
                            robloxId: profile.id
                        },

                        {

                            robloxId:
                                profile.id,

                            username:
                                profile.name

                        },

                        {
                            upsert: true,
                            new: true
                        }

                    ).catch(
                        error =>
                            console.log(
                                "User save error:",
                                error.message
                            )
                    );

                }


                return res.json({

                    success: true,

                    username:
                        profile.name,

                    id:
                        profile.id

                });

            }


            res.json({

                success: false,

                message:
                    "Verification phrase not found"

            });

        }
        catch (error) {

            console.log(
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Verification failed"

            });

        }

    }
);


// ======================================================
// CHAT LINK FILTER
// ======================================================

function containsLink(text) {

    const patterns = [

        /https?:\/\//i,

        /www\./i,

        /ftp:\/\//i,

        /discord\.gg/i,

        /discord\.com\/invite/i,

        /discordapp\.com\/invite/i,

        /t\.me\//i,

        /telegram\.me\//i,

        /bit\.ly\//i,

        /tinyurl\.com/i,

        /youtu\.be\//i,

        /youtube\.com/i,

        /\.com\b/i,

        /\.net\b/i,

        /\.org\b/i,

        /\.gg\b/i,

        /\.io\b/i,

        /\.xyz\b/i,

        /\.me\b/i,

        /\.co\b/i

    ];


    return patterns.some(
        regex =>
            regex.test(text)
    );

}


// ======================================================
// GET CHAT
// ======================================================

app.get(
    "/chat",
    async (req, res) => {

        try {

            if (
                !mongoConnected
            ) {

                return res.json({

                    success: true,

                    messages: []

                });

            }


            const messages =
                await Chat.find()
                    .sort({
                        createdAt: 1
                    })
                    .limit(100)
                    .lean();


            res.json({

                success: true,

                messages

            });

        }
        catch (error) {

            console.log(
                "Chat load error:",
                error.message
            );


            res.status(500).json({

                success: false,

                messages: []

            });

        }

    }
);


// ======================================================
// SEND CHAT
// ======================================================

app.post(
    "/chat",
    async (req, res) => {

        try {

            const {
                username,
                avatar,
                message
            } = req.body;


            if (
                !username ||
                !message
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Missing username or message"

                });

            }


            const cleanUsername =
                String(username)
                    .trim()
                    .slice(0, 30);


            const cleanMessage =
                String(message)
                    .trim()
                    .slice(0, 500);


            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Message is empty"

                });

            }


            if (
                containsLink(
                    cleanMessage
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Links are not allowed in chat."

                });

            }


            if (
                !mongoConnected
            ) {

                return res.status(503).json({

                    success: false,

                    message:
                        "Chat database is unavailable."

                });

            }


            const saved =
                await Chat.create({

                    username:
                        cleanUsername,

                    avatar:
                        String(
                            avatar || ""
                        ).slice(0, 500),

                    message:
                        cleanMessage,

                    type:
                        "message"

                });


            res.json({

                success: true,

                message: saved

            });

        }
        catch (error) {

            console.log(
                "Chat send error:",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Could not send message"

            });

        }

    }
);


// ======================================================
// TELEGRAM
// ======================================================

try {

    require("./telegram");

    console.log(
        "Telegram module loaded"
    );

}
catch (error) {

    console.log(
        "Telegram module error:",
        error.message
    );

}


// ======================================================
// START
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );

    }
);
