const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

app.set("trust proxy", 1);

app.use(cors({
    origin: true,
    credentials: false
}));

app.use(express.json({
    limit: "100kb"
}));


/* =========================
   RATE LIMIT
========================= */

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);


/* =========================
   MONGODB
========================= */

const mongoUrl =
    process.env.MONGO_URL;

console.log(
    "Mongo URL exists:",
    Boolean(mongoUrl)
);


if (!mongoUrl) {

    console.error(
        "MONGO_URL environment variable is missing."
    );

} else {

    mongoose.connect(mongoUrl)
        .then(() => {
            console.log("MongoDB connected");
        })
        .catch(error => {
            console.error(
                "MongoDB error:",
                error.message
            );
        });
}


/* =========================
   USER MODEL
========================= */

const UserSchema =
    new mongoose.Schema({

        robloxId: {
            type: Number,
            required: true,
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

        inventory: [{
            name: String,
            value: Number
        }],

        deposited: [{
            name: String,
            value: Number
        }],

        wagered: {
            type: Number,
            default: 0
        },

        profit: {
            type: Number,
            default: 0
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


/* =========================
   CHAT MODEL
========================= */

const ChatSchema =
    new mongoose.Schema({

        robloxId: Number,

        username: String,

        avatar: String,

        message: String

    }, {
        timestamps: true
    });


const Chat =
    mongoose.models.Chat ||
    mongoose.model(
        "Chat",
        ChatSchema
    );


/* =========================
   COINFLIP MODEL
========================= */

const CoinflipSchema =
    new mongoose.Schema({

        ownerId: {
            type: Number,
            required: true,
            index: true
        },

        username: String,

        avatar: String,

        petName: {
            type: String,
            required: true
        },

        petValue: {
            type: Number,
            required: true
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
                "active",
                "playing",
                "completed",
                "cancelled"
            ],
            default: "active",
            index: true
        },

        joinedBy: {
            robloxId: Number
        },

        joinedUsername: String,

        joinedAvatar: String,

        winnerId: Number,

        winnerUsername: String,

        winningSide: String

    }, {
        timestamps: true
    });


const Coinflip =
    mongoose.models.Coinflip ||
    mongoose.model(
        "Coinflip",
        CoinflipSchema
    );


/* =========================
   SETTINGS
========================= */

const SettingsSchema =
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
        SettingsSchema
    );


/* =========================
   PET VALUES
========================= */

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

            const name =
                lines[i];

            let value =
                lines[i + 1];


            if (!name || !value) {
                continue;
            }


            /*
              Keep the numeric value.

              The old code used replace(/./g, "")
              which removes EVERY character.
            */

            value =
                value
                    .replace(/[$,]/g, "")
                    .trim();


            const numericValue =
                Number(value);


            if (
                !Number.isFinite(
                    numericValue
                )
            ) {
                continue;
            }


            pets.push({
                name,
                value: numericValue
            });
        }


        console.log(
            "Loaded pets:",
            pets.length
        );


        return pets;

    } catch (error) {

        console.error(
            "Pet loading error:",
            error.message
        );

        return [];
    }
}


const pets =
    loadPets();


function findPet(
    name
) {

    return pets.find(
        pet =>
            pet.name.toLowerCase() ===
            String(name)
                .trim()
                .toLowerCase()
    );
}


/* =========================
   PET IMAGE
========================= */

function getPetImage(
    name
) {

    return (
        "https://amvgg.com/items/" +
        encodeURIComponent(name) +
        ".webp"
    );
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.send(
        "ADMFLIP backend is online"
    );
});


/* =========================
   STATUS
========================= */

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

        } catch {

            res.json({
                online: true,
                announcement: ""
            });
        }
    }
);


/* =========================
   PETS
========================= */

app.get(
    "/pets",
    (req, res) => {

        res.json({

            success: true,

            pets:
                pets.map(pet => ({
                    id:
                        pet.name
                            .toLowerCase()
                            .replace(
                                /[^a-z0-9]+/g,
                                "-"
                            ),

                    name:
                        pet.name,

                    value:
                        pet.value,

                    image:
                        getPetImage(
                            pet.name
                        )
                }))
        });
    }
);


/* =========================
   ROBLOX USER
========================= */

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


            const avatar =
                avatarData.data?.[0]?.imageUrl ||
                "";


            res.json({

                success: true,

                user: {

                    id: user.id,

                    username:
                        user.name,

                    avatar

                }

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Server error"
            });
        }
    }
);


/* =========================
   CREATE PHRASE
========================= */

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


/* =========================
   VERIFY BIO
========================= */

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

                return res.status(400)
                    .json({
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

                const user =
                    await User.findOneAndUpdate(
                        {
                            robloxId: id
                        },

                        {
                            $set: {
                                robloxId: id,
                                username:
                                    profile.name,
                                avatar:
                                    ""
                            },

                            $setOnInsert: {
                                inventory: [],
                                deposited: [],
                                wagered: 0,
                                profit: 0
                            }
                        },

                        {
                            upsert: true,
                            new: true
                        }
                    );


                return res.json({

                    success: true,

                    username:
                        profile.name,

                    id:
                        profile.id,

                    inventory:
                        user.inventory || []

                });
            }


            res.json({

                success: false,

                message:
                    "Verification phrase not found"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Verification failed"
            });
        }
    }
);


/* =========================
   INVENTORY
========================= */

app.get(
    "/inventory/:robloxId",
    async (req, res) => {

        try {

            const robloxId =
                Number(
                    req.params.robloxId
                );


            if (
                !Number.isSafeInteger(
                    robloxId
                )
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid user"
                    });
            }


            const user =
                await User.findOne({
                    robloxId
                });


            if (!user) {

                return res.json({
                    success: true,
                    inventory: []
                });
            }


            res.json({

                success: true,

                inventory:
                    user.inventory || []

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Inventory error"
            });
        }
    }
);


/* =========================
   CHAT GET
========================= */

app.get(
    "/chat",
    async (req, res) => {

        try {

            const messages =
                await Chat.find()
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

            console.error(error);

            res.status(500).json({

                success: false,

                messages: []
            });
        }
    }
);


/* =========================
   CHAT POST
========================= */

app.post(
    "/chat",
    async (req, res) => {

        try {

            const {
                robloxId,
                username,
                avatar,
                message
            } = req.body;


            if (
                !Number.isSafeInteger(
                    Number(robloxId)
                )
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Sign in required"
                    });
            }


            const clean =
                String(message || "")
                    .trim();


            if (!clean) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Message is empty"
                    });
            }


            if (clean.length > 250) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Message too long"
                    });
            }


            const linkPattern =
                /(?:https?:\/\/|www\.|discord\.gg\/|t\.me\/|[a-z0-9-]+\.(?:com|net|org|gg|io|xyz|me|co|dev|app)(?:\/|$))/i;


            if (
                linkPattern.test(clean)
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Links are not allowed"
                    });
            }


            const recent =
                await Chat.findOne({
                    robloxId:
                        Number(robloxId),

                    createdAt: {
                        $gt:
                            new Date(
                                Date.now() -
                                2500
                            )
                    }
                });


            if (recent) {

                return res.status(429)
                    .json({
                        success: false,
                        message:
                            "Slow down"
                    });
            }


            await Chat.create({

                robloxId:
                    Number(robloxId),

                username:
                    String(username)
                        .slice(0, 32),

                avatar:
                    String(avatar || "")
                        .slice(0, 500),

                message:
                    clean

            });


            const messages =
                await Chat.find()
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

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Chat failed"
            });
        }
    }
);


/* =========================
   COINFLIPS GET
========================= */

app.get(
    "/coinflips",
    async (req, res) => {

        try {

            const coinflips =
                await Coinflip.find({
                    status: "active"
                })
                .sort({
                    createdAt: -1
                })
                .limit(100)
                .lean();


            res.json({

                success: true,

                coinflips

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                coinflips: []
            });
        }
    }
);


/* =========================
   CREATE COINFLIP
========================= */

app.post(
    "/coinflips",
    async (req, res) => {

        const session =
            await mongoose.startSession();


        try {

            const {
                robloxId,
                username,
                avatar,
                petName,
                side
            } = req.body;


            const userId =
                Number(robloxId);


            if (
                !Number.isSafeInteger(
                    userId
                )
            ) {

                return res.status(401)
                    .json({
                        success: false,
                        message:
                            "Sign in required"
                    });
            }


            const normalizedSide =
                String(side)
                    .toLowerCase();


            if (
                normalizedSide !==
                    "heads" &&
                normalizedSide !==
                    "tails"
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid side"
                    });
            }


            const officialPet =
                findPet(petName);


            if (!officialPet) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "Pet is not in the value database"
                    });
            }


            let created;


            await session.withTransaction(
                async () => {

                    const user =
                        await User.findOne({
                            robloxId: userId
                        })
                        .session(session);


                    if (!user) {
                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }


                    /*
                      Find the actual inventory item.
                      The browser's value is ignored.
                    */

                    const index =
                        user.inventory.findIndex(
                            pet =>
                                String(
                                    pet.name
                                ).toLowerCase() ===
                                String(
                                    officialPet.name
                                ).toLowerCase() &&
                                Number(
                                    pet.value
                                ) ===
                                Number(
                                    officialPet.value
                                )
                        );


                    if (index === -1) {

                        throw new Error(
                            "PET_NOT_OWNED"
                        );
                    }


                    /*
                      Remove it atomically from
                      the user's inventory.
                    */

                    user.inventory.splice(
                        index,
                        1
                    );


                    await user.save({
                        session
                    });


                    const result =
                        await Coinflip.create(
                            [{
                                ownerId: userId,

                                username:
                                    user.username,

                                avatar:
                                    user.avatar ||
                                    avatar ||
                                    "",

                                petName:
                                    officialPet.name,

                                petValue:
                                    officialPet.value,

                                side:
                                    normalizedSide,

                                status:
                                    "active"
                            }],
                            {
                                session
                            }
                        );


                    created =
                        result[0];
                }
            );


            res.json({

                success: true,

                coinflip: created

            });

        } catch (error) {

            console.error(
                "Create coinflip:",
                error
            );


            if (
                error.message ===
                "USER_NOT_FOUND"
            ) {

                return res.status(401)
                    .json({
                        success: false,
                        message:
                            "Sign in required"
                    });
            }


            if (
                error.message ===
                "PET_NOT_OWNED"
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "That pet is not in your inventory."
                    });
            }


            res.status(500).json({

                success: false,

                message:
                    "Could not create coinflip"
            });

        } finally {

            await session.endSession();
        }
    }
);


/* =========================
   JOIN COINFLIP
========================= */

app.post(
    "/coinflips/:id/join",
    async (req, res) => {

        const session =
            await mongoose.startSession();


        try {

            const {
                robloxId
            } = req.body;


            const userId =
                Number(robloxId);


            if (
                !Number.isSafeInteger(
                    userId
                )
            ) {

                return res.status(401)
                    .json({
                        success: false,
                        message:
                            "Sign in required"
                    });
            }


            let result;


            await session.withTransaction(
                async () => {

                    const flip =
                        await Coinflip.findOne({
                            _id:
                                req.params.id,

                            status:
                                "active"
                        })
                        .session(session);


                    if (!flip) {

                        throw new Error(
                            "FLIP_NOT_FOUND"
                        );
                    }


                    if (
                        flip.ownerId ===
                        userId
                    ) {

                        throw new Error(
                            "OWN_FLIP"
                        );
                    }


                    const joiningUser =
                        await User.findOne({
                            robloxId: userId
                        })
                        .session(session);


                    if (!joiningUser) {

                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }


                    /*
                      The joiner must also put up
                      a pet of equal value.

                      Find an official-valued pet
                      in their inventory.
                    */

                    const joinIndex =
                        joiningUser.inventory.findIndex(
                            pet =>
                                Number(
                                    pet.value
                                ) ===
                                Number(
                                    flip.petValue
                                ) &&
                                findPet(
                                    pet.name
                                )
                        );


                    if (joinIndex === -1) {

                        throw new Error(
                            "NO_MATCHING_PET"
                        );
                    }


                    const joinedPet =
                        joiningUser.inventory[
                            joinIndex
                        ];


                    const officialJoinedPet =
                        findPet(
                            joinedPet.name
                        );


                    joiningUser.inventory.splice(
                        joinIndex,
                        1
                    );


                    await joiningUser.save({
                        session
                    });


                    /*
                      Reserve the flip before
                      resolving it. This prevents
                      two people joining the same
                      active flip simultaneously.
                    */

                    flip.status =
                        "playing";

                    flip.joinedBy =
                        userId;

                    flip.joinedUsername =
                        joiningUser.username;

                    flip.joinedAvatar =
                        joiningUser.avatar || "";


                    await flip.save({
                        session
                    });


                    /*
                      Server-side random result.
                      Never use a result supplied
                      by the browser.
                    */

                    const winningSide =
                        Math.random() < 0.5
                            ? "heads"
                            : "tails";


                    const ownerWins =
                        winningSide ===
                        flip.side;


                    const winnerId =
                        ownerWins
                            ? flip.ownerId
                            : userId;


                    const winnerUsername =
                        ownerWins
                            ? flip.username
                            : joiningUser.username;


                    const owner =
                        await User.findOne({
                            robloxId:
                                flip.ownerId
                        })
                        .session(session);


                    if (!owner) {

                        throw new Error(
                            "OWNER_NOT_FOUND"
                        );
                    }


                    /*
                      Winner gets BOTH pets.
                    */

                    owner.inventory.push({
                        name:
                            ownerWins
                                ? flip.petName
                                : officialJoinedPet.name,

                        value:
                            ownerWins
                                ? flip.petValue
                                : officialJoinedPet.value
                    });


                    joiningUser.inventory.push({
                        name:
                            ownerWins
                                ? officialJoinedPet.name
                                : flip.petName,

                        value:
                            ownerWins
                                ? officialJoinedPet.value
                                : flip.petValue
                    });


                    /*
                      Remove the losing pet again.
                    */

                    if (ownerWins) {

                        joiningUser.inventory.pop();

                    } else {

                        owner.inventory.pop();
                    }


                    owner.wagered =
                        Number(
                            owner.wagered || 0
                        ) +
                        Number(
                            flip.petValue
                        );


                    joiningUser.wagered =
                        Number(
                            joiningUser.wagered || 0
                        ) +
                        Number(
                            officialJoinedPet.value
                        );


                    if (ownerWins) {

                        owner.profit =
                            Number(
                                owner.profit || 0
                            ) +
                            Number(
                                officialJoinedPet.value
                            ) -
                            Number(
                                flip.petValue
                            );

                    } else {

                        owner.profit =
                            Number(
                                owner.profit || 0
                            ) -
                            Number(
                                flip.petValue
                            );
                    }


                    await owner.save({
                        session
                    });


                    if (
                        String(
                            joiningUser._id
                        ) !==
                        String(
                            owner._id
                        )
                    ) {

                        await joiningUser.save({
                            session
                        });
                    }


                    flip.status =
                        "completed";

                    flip.winnerId =
                        winnerId;

                    flip.winnerUsername =
                        winnerUsername;

                    flip.winningSide =
                        winningSide;


                    await flip.save({
                        session
                    });


                    result = {

                        winnerId,

                        winnerUsername,

                        winningSide,

                        ownerUsername:
                            owner.username,

                        joinedUsername:
                            joiningUser.username
                    };
                }
            );


            res.json({

                success: true,

                result

            });

        } catch (error) {

            console.error(
                "Join coinflip:",
                error
            );


            if (
                error.message ===
                "FLIP_NOT_FOUND"
            ) {

                return res.status(404)
                    .json({
                        success: false,
                        message:
                            "Coinflip is no longer available."
                    });
            }


            if (
                error.message ===
                "OWN_FLIP"
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "You cannot join your own coinflip."
                    });
            }


            if (
                error.message ===
                "USER_NOT_FOUND"
            ) {

                return res.status(401)
                    .json({
                        success: false,
                        message:
                            "Sign in first."
                    });
            }


            if (
                error.message ===
                "NO_MATCHING_PET"
            ) {

                return res.status(400)
                    .json({
                        success: false,
                        message:
                            "You need a pet with the same value to join."
                    });
            }


            res.status(500).json({

                success: false,

                message:
                    "Could not join coinflip"
            });

        } finally {

            await session.endSession();
        }
    }
);


/* =========================
   LEADERBOARD
========================= */

app.get(
    "/leaderboard",
    async (req, res) => {

        try {

            const users =
                await User.find()
                    .sort({
                        wagered: -1
                    })
                    .limit(10)
                    .select(
                        "username avatar wagered profit"
                    )
                    .lean();


            res.json({

                success: true,

                users

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                users: []
            });
        }
    }
);


/* =========================
   TELEGRAM
========================= */

try {

    require("./telegram");

    console.log(
        "Telegram module loaded"
    );

} catch (error) {

    console.log(
        "Telegram module not loaded:",
        error.message
    );
}


/* =========================
   SERVER
========================= */

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    () => {

        console.log(
            `ADMFLIP backend running on port ${PORT}`
        );
    }
);
