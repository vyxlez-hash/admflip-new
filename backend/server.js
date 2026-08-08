const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET";

app.set("trust proxy", 1);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
}));

// =====================================================
// MONGODB
// =====================================================

const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
    console.error("MONGO_URL is missing");
} else {
    mongoose.connect(mongoUrl)
        .then(() => console.log("MongoDB connected"))
        .catch(err => console.error("MongoDB error:", err.message));
}

// =====================================================
// SCHEMAS
// =====================================================

const PetSchema = new mongoose.Schema({
    id: {
        type: String,
        default: () => crypto.randomUUID()
    },
    name: {
        type: String,
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
    quantity: {
        type: Number,
        default: 1
    }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    robloxId: {
        type: Number,
        unique: true,
        index: true
    },

    username: {
        type: String,
        required: true
    },

    avatar: {
        type: String,
        default: ""
    },

    inventory: {
        type: [PetSchema],
        default: []
    },

    wagered: {
        type: Number,
        default: 0
    },

    profit: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model("User", UserSchema);

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

const Settings = mongoose.model("Settings", SettingsSchema);

const ChatSchema = new mongoose.Schema({
    userId: Number,
    username: String,
    avatar: String,
    message: String,
    announcement: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ChatMessage = mongoose.model("ChatMessage", ChatSchema);

const CoinflipSchema = new mongoose.Schema({
    creatorId: Number,
    creatorUsername: String,
    creatorAvatar: String,

    petId: String,
    petName: String,
    petValue: Number,
    petImage: String,

    side: {
        type: String,
        enum: ["heads", "tails"]
    },

    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active"
    },

    winnerId: Number,

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Coinflip = mongoose.model("Coinflip", CoinflipSchema);

// =====================================================
// HELPERS
// =====================================================

function makeToken(user) {
    return jwt.sign(
        {
            id: user.robloxId,
            username: user.username
        },
        JWT_SECRET,
        {
            expiresIn: "30d"
        }
    );
}

function auth(req, res, next) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const token = header.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.auth = decoded;
        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Session expired"
        });
    }
}

function cleanMessage(message) {
    return String(message || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
}

function containsLink(text) {
    const patterns = [
        /https?:\/\//i,
        /www\./i,
        /\b[a-z0-9-]+\.(com|net|org|gg|io|co|me|xyz|dev|site|ly)\b/i,
        /\bdiscord\.gg\b/i,
        /\bdiscord\.com\b/i,
        /\bwww\b/i
    ];

    return patterns.some(pattern => pattern.test(text));
}

// Stable online number for ~100 seconds.
// Refreshing the page does NOT randomly change it.
function getOnlineCount() {
    const bucket = Math.floor(Date.now() / 100000);

    const hash = crypto
        .createHash("sha256")
        .update(String(bucket))
        .digest();

    const number = 20 + (hash[0] % 26);

    return number;
}

// =====================================================
// PET VALUES
// =====================================================

function loadPets() {
    try {
        if (!fs.existsSync("./values.txt")) {
            return [];
        }

        const text = fs.readFileSync("./values.txt", "utf8");

        const lines = text
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);

        const result = [];

        for (let i = 0; i < lines.length; i += 2) {
            const name = lines[i];
            const rawValue = lines[i + 1];

            if (!name || !rawValue) continue;

            const value = Number(
                rawValue
                    .replace(/[$,]/g, "")
                    .replace(/[^0-9.]/g, "")
            );

            result.push({
                name,
                value: Number.isFinite(value) ? value : 0
            });
        }

        console.log("Loaded pets:", result.length);

        return result;
    } catch (err) {
        console.error("Pet loading error:", err.message);
        return [];
    }
}

let pets = loadPets();

function findPet(name) {
    return pets.find(
        pet => pet.name.toLowerCase() === String(name).toLowerCase()
    );
}

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
    res.send("ADMFLIP backend is online");
});

// =====================================================
// STATUS
// =====================================================

app.get("/status", async (req, res) => {
    try {
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({});
        }

        res.json({
            success: true,
            online: settings.siteOnline,
            announcement: settings.announcement,
            onlineCount: getOnlineCount()
        });
    } catch {
        res.json({
            success: true,
            online: true,
            announcement: "",
            onlineCount: getOnlineCount()
        });
    }
});

// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

app.get("/user/:username", async (req, res) => {
    try {
        const username = req.params.username.trim();

        if (!username) {
            return res.json({
                success: false,
                message: "Username required"
            });
        }

        const response = await fetch(
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

        const data = await response.json();

        if (!data.data || !data.data.length) {
            return res.json({
                success: false,
                message: "Roblox username not found"
            });
        }

        const robloxUser = data.data[0];

        const avatarResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
        );

        const avatarData = await avatarResponse.json();

        res.json({
            success: true,
            user: {
                id: robloxUser.id,
                username: robloxUser.name,
                avatar: avatarData?.data?.[0]?.imageUrl || ""
            }
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =====================================================
// CREATE VERIFICATION PHRASE
// =====================================================

function generatePhrase() {
    const words = [
        "BlueTiger",
        "FastCloud",
        "LuckyWave",
        "SilverMoon",
        "GoldenLeaf",
        "PurpleFox",
        "NightStar"
    ];

    return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

app.get("/create", (req, res) => {
    res.json({
        success: true,
        phrase: generatePhrase()
    });
});

// =====================================================
// VERIFY ROBLOX BIO + LOGIN
// =====================================================

app.post("/check", async (req, res) => {
    try {
        const { username, phrase } = req.body;

        if (!username || !phrase) {
            return res.status(400).json({
                success: false,
                message: "Username and phrase required"
            });
        }

        const response = await fetch(
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

        const data = await response.json();

        if (!data.data || !data.data.length) {
            return res.json({
                success: false,
                message: "Roblox username not found"
            });
        }

        const robloxUser = data.data[0];

        const profileResponse = await fetch(
            `https://users.roblox.com/v1/users/${robloxUser.id}`
        );

        const profile = await profileResponse.json();

        if (
            !profile.description ||
            !profile.description.includes(phrase)
        ) {
            return res.json({
                success: false,
                message: "Verification phrase not found"
            });
        }

        const avatarResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
        );

        const avatarData = await avatarResponse.json();

        let user = await User.findOne({
            robloxId: robloxUser.id
        });

        if (!user) {
            user = await User.create({
                robloxId: robloxUser.id,
                username: robloxUser.name,
                avatar: avatarData?.data?.[0]?.imageUrl || ""
            });
        } else {
            user.username = robloxUser.name;

            if (avatarData?.data?.[0]?.imageUrl) {
                user.avatar = avatarData.data[0].imageUrl;
            }

            await user.save();
        }

        const token = makeToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user.robloxId,
                username: user.username,
                avatar: user.avatar,
                inventory: user.inventory,
                wagered: user.wagered,
                profit: user.profit
            }
        });

    } catch (err) {
        console.error("Verification error:", err);

        res.status(500).json({
            success: false,
            message: "Verification failed"
        });
    }
});

// =====================================================
// CURRENT USER
// =====================================================

app.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: {
                id: user.robloxId,
                username: user.username,
                avatar: user.avatar,
                inventory: user.inventory,
                wagered: user.wagered,
                profit: user.profit
            }
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Could not load account"
        });
    }
});

// =====================================================
// PET VALUES
// =====================================================

app.get("/pets", (req, res) => {
    res.json({
        success: true,
        pets
    });
});

// =====================================================
// CHAT
// =====================================================

app.get("/chat", async (req, res) => {
    try {
        const messages = await ChatMessage
            .find()
            .sort({ createdAt: -1 })
            .limit(80)
            .lean();

        res.json({
            success: true,
            messages: messages.reverse(),
            online: getOnlineCount()
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Could not load chat"
        });
    }
});

app.post("/chat", auth, async (req, res) => {
    try {
        const message = cleanMessage(req.body.message);

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is empty"
            });
        }

        if (containsLink(message)) {
            return res.status(400).json({
                success: false,
                message: "Links are not allowed in chat"
            });
        }

        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const created = await ChatMessage.create({
            userId: user.robloxId,
            username: user.username,
            avatar: user.avatar,
            message
        });

        res.json({
            success: true,
            message: created
        });

    } catch (err) {
        console.error("Chat error:", err);

        res.status(500).json({
            success: false,
            message: "Could not send message"
        });
    }
});

// =====================================================
// INVENTORY
// =====================================================

app.get("/inventory", auth, async (req, res) => {
    try {
        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        res.json({
            success: true,
            inventory: user.inventory
        });

    } catch {
        res.status(500).json({
            success: false
        });
    }
});

// =====================================================
// ADD PET - ADMIN/BOT USE
// =====================================================

app.post("/admin/add-pet", auth, async (req, res) => {
    try {
        const adminIds = String(
            process.env.TELEGRAM_ADMIN_ID || ""
        )
            .split(",")
            .map(x => x.trim());

        if (!adminIds.includes(String(req.auth.id))) {
            return res.status(403).json({
                success: false,
                message: "Admin only"
            });
        }

        const {
            robloxId,
            petName,
            value,
            image
        } = req.body;

        if (!robloxId || !petName) {
            return res.status(400).json({
                success: false,
                message: "Missing data"
            });
        }

        const user = await User.findOne({
            robloxId: Number(robloxId)
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.inventory.push({
            id: crypto.randomUUID(),
            name: petName,
            value: Number(value) || findPet(petName)?.value || 0,
            image: image || "",
            quantity: 1
        });

        await user.save();

        res.json({
            success: true,
            inventory: user.inventory
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false
        });
    }
});

// =====================================================
// REMOVE PET - ADMIN/BOT USE
// =====================================================

app.post("/admin/remove-pet", auth, async (req, res) => {
    try {
        const adminIds = String(
            process.env.TELEGRAM_ADMIN_ID || ""
        )
            .split(",")
            .map(x => x.trim());

        if (!adminIds.includes(String(req.auth.id))) {
            return res.status(403).json({
                success: false,
                message: "Admin only"
            });
        }

        const { robloxId, petId } = req.body;

        const user = await User.findOne({
            robloxId: Number(robloxId)
        });

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        const before = user.inventory.length;

        user.inventory = user.inventory.filter(
            pet => pet.id !== petId
        );

        if (before === user.inventory.length) {
            return res.status(404).json({
                success: false,
                message: "Pet not found"
            });
        }

        await user.save();

        res.json({
            success: true,
            inventory: user.inventory
        });

    } catch {
        res.status(500).json({
            success: false
        });
    }
});

// =====================================================
// TIP / TRANSFER PET
// =====================================================

app.post("/tip", auth, async (req, res) => {
    try {
        const {
            recipientId,
            petId
        } = req.body;

        if (!recipientId || !petId) {
            return res.status(400).json({
                success: false,
                message: "Recipient and pet required"
            });
        }

        if (Number(recipientId) === Number(req.auth.id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot tip yourself"
            });
        }

        const sender = await User.findOne({
            robloxId: req.auth.id
        });

        const receiver = await User.findOne({
            robloxId: Number(recipientId)
        });

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Find the exact pet currently owned by sender.
        const petIndex = sender.inventory.findIndex(
            pet => pet.id === petId
        );

        if (petIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Pet is no longer in your inventory"
            });
        }

        const pet = sender.inventory[petIndex];

        // Remove first.
        sender.inventory.splice(petIndex, 1);

        // Then add the same unique item to receiver.
        receiver.inventory.push({
            id: pet.id,
            name: pet.name,
            value: pet.value,
            image: pet.image,
            quantity: pet.quantity
        });

        await sender.save();
        await receiver.save();

        res.json({
            success: true,
            message: `${pet.name} transferred successfully`
        });

    } catch (err) {
        console.error("Tip error:", err);

        res.status(500).json({
            success: false,
            message: "Transfer failed"
        });
    }
});

// =====================================================
// LEADERBOARD
// =====================================================

app.get("/leaderboard", async (req, res) => {
    try {
        const users = await User
            .find()
            .sort({ wagered: -1 })
            .limit(10)
            .select("username avatar wagered profit robloxId")
            .lean();

        res.json({
            success: true,
            users
        });

    } catch {
        res.status(500).json({
            success: false,
            users: []
        });
    }
});

// =====================================================
// COINFLIPS
// =====================================================

app.get("/coinflips", async (req, res) => {
    try {
        const flips = await Coinflip
            .find({ status: "active" })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({
            success: true,
            coinflips: flips
        });

    } catch {
        res.status(500).json({
            success: false,
            coinflips: []
        });
    }
});

app.post("/coinflips", auth, async (req, res) => {
    try {
        const {
            petId,
            side
        } = req.body;

        if (!["heads", "tails"].includes(side)) {
            return res.status(400).json({
                success: false,
                message: "Invalid side"
            });
        }

        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        const petIndex = user.inventory.findIndex(
            pet => pet.id === petId
        );

        if (petIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Pet is not in your inventory"
            });
        }

        const pet = user.inventory[petIndex];

        // Lock the pet into the active coinflip by removing it
        // from the normal inventory.
        user.inventory.splice(petIndex, 1);

        const flip = await Coinflip.create({
            creatorId: user.robloxId,
            creatorUsername: user.username,
            creatorAvatar: user.avatar,
            petId: pet.id,
            petName: pet.name,
            petValue: pet.value,
            petImage: pet.image,
            side
        });

        await user.save();

        res.json({
            success: true,
            coinflip: flip
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: "Could not create coinflip"
        });
    }
});

// =====================================================
// JOIN COINFLIP
// =====================================================

app.post("/coinflips/:id/join", auth, async (req, res) => {
    try {
        const flip = await Coinflip.findOne({
            _id: req.params.id,
            status: "active"
        });

        if (!flip) {
            return res.status(404).json({
                success: false,
                message: "Coinflip is no longer active"
            });
        }

        if (flip.creatorId === req.auth.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot join your own coinflip"
            });
        }

        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        // This temporary version lets the user join with a pet
        // approximately equal in value.
        const joinPetIndex = user.inventory.findIndex(
            pet =>
                Math.abs(Number(pet.value) - Number(flip.petValue)) <=
                Math.max(1, Number(flip.petValue) * 0.10)
        );

        if (joinPetIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "You need a pet within 10% of this value"
            });
        }

        const joinPet = user.inventory[joinPetIndex];

        // Remove joining pet.
        user.inventory.splice(joinPetIndex, 1);

        const winnerSide =
            Math.random() < 0.5
                ? "heads"
                : "tails";

        const creatorWins =
            winnerSide === flip.side;

        let winner;
        let loser;

        const creator = await User.findOne({
            robloxId: flip.creatorId
        });

        if (!creator) {
            return res.status(404).json({
                success: false,
                message: "Creator no longer exists"
            });
        }

        if (creatorWins) {
            winner = creator;
            loser = user;
        } else {
            winner = user;
            loser = creator;
        }

        // Winner receives both locked pets.
        winner.inventory.push({
            id: flip.petId,
            name: flip.petName,
            value: flip.petValue,
            image: flip.petImage,
            quantity: 1
        });

        winner.inventory.push({
            id: joinPet.id,
            name: joinPet.name,
            value: joinPet.value,
            image: joinPet.image,
            quantity: joinPet.quantity
        });

        winner.wagered += Number(flip.petValue) + Number(joinPet.value);

        if (winner._id.toString() !== loser._id.toString()) {
            winner.profit += Number(loser === creator ? flip.petValue : joinPet.value);
        }

        await user.save();
        await creator.save();

        flip.status = "completed";
        flip.winnerId = winner.robloxId;

        await flip.save();

        res.json({
            success: true,
            winnerId: winner.robloxId,
            winnerSide,
            flip
        });

    } catch (err) {
        console.error("Join flip error:", err);

        res.status(500).json({
            success: false,
            message: "Could not join coinflip"
        });
    }
});

// =====================================================
// CANCEL COINFLIP
// =====================================================

app.post("/coinflips/:id/cancel", auth, async (req, res) => {
    try {
        const flip = await Coinflip.findOne({
            _id: req.params.id,
            status: "active",
            creatorId: req.auth.id
        });

        if (!flip) {
            return res.status(404).json({
                success: false,
                message: "Coinflip not found"
            });
        }

        const user = await User.findOne({
            robloxId: req.auth.id
        });

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        user.inventory.push({
            id: flip.petId,
            name: flip.petName,
            value: flip.petValue,
            image: flip.petImage,
            quantity: 1
        });

        await user.save();

        flip.status = "completed";

        await flip.save();

        res.json({
            success: true
        });

    } catch {
        res.status(500).json({
            success: false
        });
    }
});

// =====================================================
// ADMIN ANNOUNCEMENT
// =====================================================

app.post("/admin/announcement", auth, async (req, res) => {
    try {
        const adminIds = String(
            process.env.TELEGRAM_ADMIN_ID || ""
        )
            .split(",")
            .map(x => x.trim());

        if (!adminIds.includes(String(req.auth.id))) {
            return res.status(403).json({
                success: false,
                message: "Admin only"
            });
        }

        const announcement = cleanMessage(
            req.body.announcement
        );

        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({});
        }

        settings.announcement = announcement;

        await settings.save();

        if (announcement) {
            await ChatMessage.create({
                userId: 0,
                username: "ADMFLIP",
                avatar: "",
                message: announcement,
                announcement: true
            });
        }

        res.json({
            success: true
        });

    } catch {
        res.status(500).json({
            success: false
        });
    }
});

// =====================================================
// TELEGRAM
// =====================================================

try {
    require("./telegram");
    console.log("Telegram module loaded");
} catch (err) {
    console.log("Telegram module not loaded:", err.message);
}

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {
    console.log(`ADMFLIP backend running on port ${PORT}`);
});
