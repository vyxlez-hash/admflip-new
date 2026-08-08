const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

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
// MONGODB
// ======================

console.log(
    "Mongo URL exists:",
    !!process.env.MONGO_URL
);

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


// ======================
// USER DATABASE
// ======================

const User = mongoose.model(
    "User",
    new mongoose.Schema({
        robloxId: Number,

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
    })
);


// ======================
// SETTINGS DATABASE
// ======================

const Settings = mongoose.model(
    "Settings",
    new mongoose.Schema({
        siteOnline: {
            type: Boolean,
            default: true
        },

        announcement: {
            type: String,
            default: ""
        }
    })
);


// ======================
// CHAT DATABASE
// ======================

const Chat = mongoose.model(
    "Chat",
    new mongoose.Schema({
        username: {
            type: String,
            required: true
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
            default: "message"
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    })
);


// ======================
// PET VALUES
// ======================

function loadPets() {

    try {

        const text = fs.readFileSync(
            "./values.txt",
            "utf8"
        );

        const lines = text
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

            value = value
                .replace(/\./g, "")
                .replace(/,/g, "")
                .trim();

            const numericValue = Number(value);

            if (Number.isNaN(numericValue)) {
                continue;
            }

            pets.push({
                name: name,
                value: numericValue
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


// ======================
// HOME
// ======================

app.get("/", (req, res) => {

    res.send(
        "ADMFLIP backend is online"
    );

});


// ======================
// SITE STATUS
// ======================

app.get("/status", async (req, res) => {

    try {

        let settings =
            await Settings.findOne();

        if (!settings) {

            settings =
                await Settings.create({
                    siteOnline: true,
                    announcement: ""
                });

        }

        res.json({
            online: settings.siteOnline,
            announcement: settings.announcement
        });

    } catch (error) {

        console.log(
            "Status error:",
            error.message
        );

        res.status(500).json({
            online: true,
            announcement: ""
        });
    }
});


// ======================
// PETS
// ======================

app.get("/pets", (req, res) => {

    res.json({
        success: true,
        pets: pets
    });

});


// ======================
// CHAT - GET
// ======================

app.get("/chat", async (req, res) => {

    try {

        const messages =
            await Chat.find()
                .sort({ createdAt: 1 })
                .limit(100)
                .lean();

        res.json({
            success: true,
            messages: messages
        });

    } catch (error) {

        console.log(
            "Chat GET error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Could not load chat"
        });
    }
});


// ======================
// CHAT - SEND
// ======================

app.post("/chat", async (req, res) => {

    try {

        const {
            username,
            avatar,
            message
        } = req.body;

        if (
            typeof username !== "string" ||
            typeof message !== "string"
        ) {

            return res.status(400).json({
                success: false,
                message: "Missing username or message"
            });
        }

        const cleanUsername =
            username.trim().slice(0, 30);

        const cleanMessage =
            message.trim().slice(0, 500);

        const cleanAvatar =
            typeof avatar === "string"
                ? avatar.trim().slice(0, 500)
                : "";

        if (
            !cleanUsername ||
            !cleanMessage
        ) {

            return res.status(400).json({
                success: false,
                message: "Username and message are required"
            });
        }

        const chat =
            await Chat.create({

                username: cleanUsername,

                avatar: cleanAvatar,

                message: cleanMessage,

                type: "message"

            });

        res.json({
            success: true,
            chat: chat
        });

    } catch (error) {

        console.log(
            "Chat POST error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Could not send message"
        });
    }
});


// ======================
// ROBLOX USER
// ======================

app.get("/user/:username", async (req, res) => {

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
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        usernames: [username],
                        excludeBannedUsers: true
                    })
                }
            );

        if (!response.ok) {

            return res.status(502).json({
                success: false,
                message: "Roblox API error"
            });
        }

        const data =
            await response.json();

        if (
            !data.data ||
            !data.data.length
        ) {

            return res.json({
                success: false,
                message: "Roblox username not found"
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
                avatar: avatar
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
});


// ======================
// CREATE VERIFICATION PHRASE
// ======================

function generatePhrase() {

    const words = [
        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GoldenLeaf"
    ];

    const word =
        words[
            Math.floor(
                Math.random() * words.length
            )
        ];

    const number =
        Math.floor(
            1000 + Math.random() * 9000
        );

    return word + "-" + number;
}


app.get("/create", (req, res) => {

    res.json({
        phrase: generatePhrase()
    });

});


// ======================
// VERIFY ROBLOX BIO
// ======================

app.post("/check", async (req, res) => {

    try {

        const {
            username,
            phrase
        } = req.body;

        if (
            typeof username !== "string" ||
            typeof phrase !== "string"
        ) {

            return res.status(400).json({
                success: false,
                message: "Username and phrase are required"
            });
        }

        const response =
            await fetch(
                "https://users.roblox.com/v1/usernames/users",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        usernames: [
                            username.trim()
                        ],

                        excludeBannedUsers: true
                    })
                }
            );

        if (!response.ok) {

            return res.status(502).json({
                success: false,
                message: "Roblox API error"
            });
        }

        const data =
            await response.json();

        if (
            !data.data ||
            !data.data.length
        ) {

            return res.json({
                success: false,
                message: "Roblox username not found"
            });
        }

        const id =
            data.data[0].id;

        const profileResponse =
            await fetch(
                `https://users.roblox.com/v1/users/${id}`
            );

        if (!profileResponse.ok) {

            return res.status(502).json({
                success: false,
                message: "Could not load Roblox profile"
            });
        }

        const profile =
            await profileResponse.json();

        if (
            profile.description &&
            profile.description.includes(
                phrase.trim()
            )
        ) {

            return res.json({

                success: true,

                username: profile.name,

                id: profile.id

            });
        }

        return res.json({

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
});


// ======================
// TELEGRAM BOT
// ======================

try {

    require("./telegram");

} catch (error) {

    console.log(
        "Telegram startup error:",
        error.message
    );

}


// ======================
// START SERVER
// ======================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );

    }
);
