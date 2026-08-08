const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50kb" }));

// ==============================
// RATE LIMIT
// ==============================

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);

// ==============================
// MONGODB
// ==============================

console.log(
    "Mongo URL exists:",
    !!process.env.MONGO_URL
);

if (process.env.MONGO_URL) {

    mongoose.connect(process.env.MONGO_URL)
        .then(() => {
            console.log("MongoDB connected");
        })
        .catch((err) => {
            console.log(
                "MongoDB error:",
                err.message
            );
        });

} else {

    console.log(
        "MONGO_URL is missing"
    );

}

// ==============================
// USER MODEL
// ==============================

const userSchema = new mongoose.Schema({

    robloxId: {
        type: Number,
        unique: true,
        index: true
    },

    username: String,

    avatar: String,

    inventory: [{
        name: String,
        value: Number
    }],

    deposited: [{
        name: String,
        value: Number
    }]

}, {
    timestamps: true
});

const User =
    mongoose.models.User ||
    mongoose.model("User", userSchema);

// ==============================
// SETTINGS
// ==============================

const settingsSchema = new mongoose.Schema({

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
    mongoose.model("Settings", settingsSchema);

// ==============================
// CHAT MESSAGE MODEL
// ==============================

const chatMessageSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        maxlength: 30
    },

    robloxId: {
        type: Number,
        required: true
    },

    avatar: {
        type: String,
        default: ""
    },

    message: {
        type: String,
        required: true,
        maxlength: 250
    }

}, {
    timestamps: true
});

const ChatMessage =
    mongoose.models.ChatMessage ||
    mongoose.model(
        "ChatMessage",
        chatMessageSchema
    );

// ==============================
// PET VALUES
// ==============================

function loadPets() {

    try {

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

        const pets = [];

        for (
            let i = 0;
            i < lines.length;
            i += 2
        ) {

            const name = lines[i];
            let value = lines[i + 1];

            if (!name || !value) {
                continue;
            }

            value =
                value
                    .replace(/[$]/g, "")
                    .replace(/,/g, "");

            const numericValue =
                Number(value);

            pets.push({
                name,
                value: Number.isFinite(numericValue)
                    ? numericValue
                    : 0
            });

        }

        console.log(
            "Loaded pets:",
            pets.length
        );

        return pets;

    } catch (error) {

        console.log(
            "Pet loading error:",
            error.message
        );

        return [];
    }
}

const pets = loadPets();

// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {

    res.send(
        "ADMFLIP backend is online"
    );

});

// ==============================
// STATUS
// ==============================

app.get("/status", async (req, res) => {

    try {

        let settings =
            await Settings.findOne();

        if (!settings) {

            settings =
                await Settings.create({});

        }

        res.json({

            online: settings.siteOnline,

            announcement:
                settings.announcement

        });

    } catch (error) {

        res.json({

            online: true,

            announcement: ""

        });

    }

});

// ==============================
// PETS
// ==============================

app.get("/pets", (req, res) => {

    res.json({

        success: true,

        pets

    });

});

// ==============================
// ROBLOX USER
// ==============================

app.get(
    "/user/:username",
    async (req, res) => {

        try {

            const username =
                req.params.username.trim();

            if (!username) {

                return res.json({
                    success: false,
                    message: "Username required"
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

                        body: JSON.stringify({
                            usernames: [username],
                            excludeBannedUsers: true
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

            const avatar =
                avatarData.data &&
                avatarData.data[0]
                    ? avatarData.data[0].imageUrl
                    : "";

            res.json({

                success: true,

                user: {

                    id: user.id,

                    username: user.name,

                    avatar

                }

            });

        } catch (error) {

            console.log(
                "Roblox user error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message: "Server error"

            });

        }

    }
);

// ==============================
// CREATE VERIFICATION PHRASE
// ==============================

function generatePhrase() {

    const words = [
        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GoldenLeaf",
        "DarkFalcon",
        "CrystalWolf",
        "NeonDragon"
    ];

    const word =
        words[
            Math.floor(
                Math.random() *
                words.length
            )
        ];

    const number =
        Math.floor(
            1000 +
            Math.random() * 9000
        );

    return `${word}-${number}`;
}

app.get("/create", (req, res) => {

    res.json({

        phrase:
            generatePhrase()

    });

});

// ==============================
// VERIFY ROBLOX BIO
// ==============================

app.post(
    "/check",
    async (req, res) => {

        try {

            const {
                username,
                phrase
            } = req.body;

            if (!username || !phrase) {

                return res.json({

                    success: false,

                    message:
                        "Username and phrase required"

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

                        body: JSON.stringify({

                            usernames: [username],

                            excludeBannedUsers: true

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

        } catch (error) {

            console.log(
                "Verification error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Verification failed"

            });

        }

    }
);

// ==================================================
// AMVGG PET LOOKUP
// ==================================================
//
// This searches the AMVGG pet page.
// Example:
// /amvgg-pet/Unicorn
//
// It extracts:
// - value
// - image
// - variation information
//
// ==================================================

function escapeRegex(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}

app.get(
    "/amvgg-pet/:petName",
    async (req, res) => {

        try {

            const petName =
                decodeURIComponent(
                    req.params.petName
                ).trim();

            if (!petName) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Pet name required"

                });

            }

            const slug =
                petName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

            const url =
                `https://amvgg.com/pet/${slug}`;

            const response =
                await fetch(url, {

                    headers: {

                        "User-Agent":
                            "Mozilla/5.0 ADMFLIP Value Lookup"

                    }

                });

            if (!response.ok) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Pet not found on AMVGG"

                });

            }

            const html =
                await response.text();

            // ------------------------------
            // IMAGE
            // ------------------------------

            let image = "";

            const imageMatches =
                html.match(
                    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
                ) || [];

            for (
                const tag of imageMatches
            ) {

                const match =
                    tag.match(
                        /src=["']([^"']+)["']/i
                    );

                if (!match) {
                    continue;
                }

                const src = match[1];

                if (
                    !src.includes("logo") &&
                    !src.includes("avatar") &&
                    !src.includes("icon") &&
                    (
                        src.includes("/storage/") ||
                        src.includes("/uploads/") ||
                        src.includes("amvgg")
                    )
                ) {

                    image = src;

                    if (
                        image.startsWith("/")
                    ) {

                        image =
                            "https://amvgg.com" +
                            image;

                    }

                    break;
                }

            }

            // ------------------------------
            // TEXT
            // ------------------------------

            const clean =
                html
                    .replace(
                        /<script[\s\S]*?<\/script>/gi,
                        " "
                    )
                    .replace(
                        /<style[\s\S]*?<\/style>/gi,
                        " "
                    )
                    .replace(
                        /<[^>]+>/g,
                        " "
                    )
                    .replace(
                        /&nbsp;/g,
                        " "
                    )
                    .replace(
                        /&amp;/g,
                        "&"
                    )
                    .replace(
                        /\s+/g,
                        " "
                    );

            // Look for "Value 0.123"
            const valueMatch =
                clean.match(
                    /Value\s+([0-9]+(?:\.[0-9]+)?)/i
                );

            const value =
                valueMatch
                    ? Number(valueMatch[1])
                    : null;

            // ------------------------------
            // VARIATIONS
            // ------------------------------

            const upper =
                petName.toUpperCase();

            const variations = {

                ride:
                    /\bR\b/.test(upper),

                fly:
                    /\bF\b/.test(upper),

                neon:
                    /\bN\b/.test(upper),

                megaNeon:
                    /\bM\b/.test(upper)

            };

            res.json({

                success: true,

                pet: {

                    name: petName,

                    value,

                    image,

                    variations

                },

                source: "AMVGG"

            });

        } catch (error) {

            console.log(
                "AMVGG lookup error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "AMVGG lookup failed"

            });

        }

    }
);

// ==================================================
// CHAT
// ==================================================

function containsLink(text) {

    const patterns = [

        /https?:\/\//i,

        /www\./i,

        /\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|tv|site|dev|app)\b/i,

        /\bdiscord\.gg\b/i,

        /\bdiscord\.com\b/i,

        /\bt\.me\b/i,

        /\bbit\.ly\b/i

    ];

    return patterns.some(
        regex => regex.test(text)
    );

}

// GET CHAT MESSAGES

app.get(
    "/chat/messages",
    async (req, res) => {

        try {

            const messages =
                await ChatMessage
                    .find()
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

        } catch (error) {

            console.log(
                "Chat read error:",
                error.message
            );

            res.status(500).json({

                success: false,

                messages: []

            });

        }

    }
);

// SEND CHAT MESSAGE

app.post(
    "/chat/messages",
    async (req, res) => {

        try {

            const {
                username,
                robloxId,
                avatar,
                message
            } = req.body;

            if (
                !username ||
                !robloxId ||
                !message
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You must be signed in"

                });

            }

            const cleanMessage =
                String(message)
                    .trim()
                    .replace(/\s+/g, " ");

            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Message cannot be empty"

                });

            }

            if (
                cleanMessage.length > 250
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Message is too long"

                });

            }

            // BLOCK ALL LINKS

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

            // Simple anti-spam cooldown

            const recent =
                await ChatMessage
                    .findOne({
                        robloxId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .lean();

            if (recent) {

                const elapsed =
                    Date.now() -
                    new Date(
                        recent.createdAt
                    ).getTime();

                if (elapsed < 2500) {

                    return res.status(429).json({

                        success: false,

                        message:
                            "Slow down."

                    });

                }

            }

            const newMessage =
                await ChatMessage.create({

                    username:
                        String(username)
                            .slice(0, 30),

                    robloxId:
                        Number(robloxId),

                    avatar:
                        String(avatar || ""),

                    message:
                        cleanMessage

                });

            res.json({

                success: true,

                message:
                    newMessage

            });

        } catch (error) {

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

// ==============================
// TELEGRAM
// ==============================

try {

    require("./telegram");

    console.log(
        "Telegram module loaded"
    );

} catch (error) {

    console.log(
        "Telegram module error:",
        error.message
    );

}

// ==============================
// SERVER
// ==============================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );

    }
);
