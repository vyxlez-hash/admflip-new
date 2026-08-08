const TelegramBot =
    require("node-telegram-bot-api");

const mongoose =
    require("mongoose");

const crypto =
    require("crypto");


const TOKEN =
    process.env.TELEGRAM_TOKEN;


const ADMIN_ID =
    String(
        process.env.TELEGRAM_ADMIN_ID || ""
    );


if (!TOKEN) {

    console.log(
        "Telegram disabled: TELEGRAM_TOKEN missing"
    );

    return;

}


if (!ADMIN_ID) {

    console.log(
        "Telegram disabled: TELEGRAM_ADMIN_ID missing"
    );

    return;

}


/*
 * polling: true
 *
 * IMPORTANT:
 * Only ONE Render instance should run this bot.
 */

const bot =
    new TelegramBot(
        TOKEN,
        {
            polling: true
        }
    );


console.log(
    "Telegram bot online"
);


// =====================================================
// USER MODEL
// =====================================================

const PetSchema =
    new mongoose.Schema({

        petId: String,

        name: String,

        variant: String,

        value: Number,

        image: String,

        locked: Boolean

    }, {
        _id: false
    });


const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        new mongoose.Schema({

            robloxId: {
                type: Number,
                unique: true
            },

            username: String,

            avatar: String,

            balance: {
                type: Number,
                default: 0
            },

            wagered: {
                type: Number,
                default: 0
            },

            profit: {
                type: Number,
                default: 0
            },

            inventory: {
                type: [PetSchema],
                default: []
            }

        })
    );


// =====================================================
// ADMIN CHECK
// =====================================================

function isAdmin(msg) {

    return (
        String(
            msg.from?.id
        ) === ADMIN_ID
    );

}


function deny(msg) {

    return bot.sendMessage(
        msg.chat.id,
        "⛔ You are not authorized."
    );

}


function args(text) {

    return String(text)
        .trim()
        .split(/\s+/)
        .slice(1);

}


// =====================================================
// HELP
// =====================================================

bot.onText(
    /^\/help$/i,
    async msg => {

        if (!isAdmin(msg))
            return deny(msg);


        const text = `

ADMFLIP ADMIN

/help
Show commands

/user <username>
Find a user

/balance <username>
Show balance

/setbalance <username> <amount>
Set balance

/addpet <username> <pet> [variant]
Give a pet

/removepet <username> <petId>
Remove exact pet

/inventory <username>
Show inventory

/transfer <from> <to> <petId>
Transfer exact pet

/announce <message>
Post site announcement

/shutdown
Disable site

/start
Enable site

/status
Show status
`;


        bot.sendMessage(
            msg.chat.id,
            text
        );

    }
);


// =====================================================
// USER
// =====================================================

bot.onText(
    /^\/user\s+(.+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1].trim();


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        bot.sendMessage(
            msg.chat.id,

            `

User

Username: ${user.username}
Roblox ID: ${user.robloxId}

Balance: ${user.balance}
Wagered: ${user.wagered}
Profit: ${user.profit}

Pets: ${user.inventory.length}
`
        );

    }
);


// =====================================================
// BALANCE
// =====================================================

bot.onText(
    /^\/balance\s+(.+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1].trim();


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        bot.sendMessage(
            msg.chat.id,

            `${user.username} balance: ${user.balance}`
        );

    }
);


// =====================================================
// SET BALANCE
// =====================================================

bot.onText(
    /^\/setbalance\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1];

        const amount =
            Number(match[2]);


        if (!Number.isFinite(amount))
            return;


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        user.balance =
            amount;


        await user.save();


        bot.sendMessage(
            msg.chat.id,

            `Balance updated for ${user.username}.`
        );

    }
);


// =====================================================
// ADD PET
// =====================================================

bot.onText(
    /^\/addpet\s+(\S+)\s+(.+?)(?:\s+(NP|R|F|FR|N|NR|NF|NFR|M|MR|MF|MFR))?$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1];


        const petName =
            match[2].trim();


        const variant =
            (
                match[3] ||
                "NP"
            ).toUpperCase();


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        /*
         * NEVER trust a value supplied by Telegram.
         *
         * Look up the trusted value.
         */

        let value = 0;


        try {

            const PetValue =
                mongoose.models.PetValue ||
                mongoose.model(
                    "PetValue",
                    new mongoose.Schema({

                        name: String,

                        value: Number,

                        image: String

                    })
                );


            const found =
                await PetValue.findOne({

                    name: {
                        $regex:
                            new RegExp(
                                "^" +
                                petName +
                                "$",
                                "i"
                            )
                    }

                });


            if (found) {

                value =
                    Number(found.value) || 0;

            }

        }
        catch {}


        const pet = {

            petId:
                crypto.randomUUID(),

            name:
                petName,

            variant,

            value,

            image: "",

            locked: false

        };


        user.inventory.push(
            pet
        );


        await user.save();


        bot.sendMessage(
            msg.chat.id,

            `Added ${petName} ${variant} to ${user.username}.\nPet ID: ${pet.petId}`
        );

    }
);


// =====================================================
// INVENTORY
// =====================================================

bot.onText(
    /^\/inventory\s+(.+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1].trim();


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        if (!user.inventory.length) {

            return bot.sendMessage(
                msg.chat.id,
                "Inventory is empty."
            );

        }


        const lines =
            user.inventory.map(
                pet =>

                    `${pet.name} ${pet.variant}\n` +
                    `Value: ${pet.value}\n` +
                    `ID: ${pet.petId}\n`
            );


        bot.sendMessage(
            msg.chat.id,

            lines.join("\n")
        );

    }
);


// =====================================================
// REMOVE PET
// =====================================================

bot.onText(
    /^\/removepet\s+(\S+)\s+(.+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const username =
            match[1];

        const petId =
            match[2].trim();


        const user =
            await User.findOne({

                username: {
                    $regex:
                        new RegExp(
                            "^" +
                            username +
                            "$",
                            "i"
                        )
                }

            });


        if (!user) {

            return bot.sendMessage(
                msg.chat.id,
                "User not found."
            );

        }


        const index =
            user.inventory.findIndex(
                pet =>
                    pet.petId ===
                    petId
            );


        if (index === -1) {

            return bot.sendMessage(
                msg.chat.id,
                "Exact pet ID not found."
            );

        }


        const pet =
            user.inventory[index];


        if (pet.locked) {

            return bot.sendMessage(
                msg.chat.id,
                "That pet is currently locked in a coinflip."
            );

        }


        user.inventory.splice(
            index,
            1
        );


        await user.save();


        bot.sendMessage(
            msg.chat.id,

            `Removed ${pet.name} ${pet.variant} from ${user.username}.`
        );

    }
);


// =====================================================
// TRANSFER
// =====================================================

bot.onText(
    /^\/transfer\s+(\S+)\s+(\S+)\s+(.+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const fromName =
            match[1];

        const toName =
            match[2];

        const petId =
            match[3].trim();


        const session =
            await mongoose.startSession();


        try {

            await session.withTransaction(
                async () => {

                    const from =
                        await User.findOne({

                            username: {
                                $regex:
                                    new RegExp(
                                        "^" +
                                        fromName +
                                        "$",
                                        "i"
                                    )
                            }

                        }).session(session);


                    const to =
                        await User.findOne({

                            username: {
                                $regex:
                                    new RegExp(
                                        "^" +
                                        toName +
                                        "$",
                                        "i"
                                    )
                            }

                        }).session(session);


                    if (!from || !to) {

                        throw new Error(
                            "User not found"
                        );

                    }


                    const index =
                        from.inventory.findIndex(
                            pet =>
                                pet.petId ===
                                petId &&
                                !pet.locked
                        );


                    if (index === -1) {

                        throw new Error(
                            "Exact unlocked pet not found"
                        );

                    }


                    const pet =
                        from.inventory[index];


                    from.inventory.splice(
                        index,
                        1
                    );


                    to.inventory.push(
                        pet
                    );


                    await from.save({
                        session
                    });


                    await to.save({
                        session
                    });

                }
            );


            bot.sendMessage(
                msg.chat.id,
                "Transfer completed."
            );

        }
        catch (error) {

            bot.sendMessage(
                msg.chat.id,
                `Transfer failed: ${error.message}`
            );

        }
        finally {

            await session.endSession();

        }

    }
);


// =====================================================
// ANNOUNCEMENT
// =====================================================

bot.onText(
    /^\/announce\s+([\s\S]+)$/i,
    async (msg, match) => {

        if (!isAdmin(msg))
            return deny(msg);


        const text =
            match[1].trim();


        const Chat =
            mongoose.models.Chat ||
            mongoose.model(
                "Chat",
                new mongoose.Schema({

                    type: String,

                    userId: Number,

                    username: String,

                    avatar: String,

                    content: String

                }, {
                    timestamps: true
                })
            );


        await Chat.create({

            type:
                "announcement",

            content:
                text,

            username:
                "ADMFLIP",

            userId:
                null,

            avatar:
                ""

        });


        bot.sendMessage(
            msg.chat.id,
            "Announcement posted."
        );

    }
);


// =====================================================
// SHUTDOWN
// =====================================================

async function setSiteOnline(value) {

    const Settings =
        mongoose.models.Settings ||
        mongoose.model(
            "Settings",
            new mongoose.Schema({

                siteOnline: Boolean,

                announcement: String

            })
        );


    let settings =
        await Settings.findOne();


    if (!settings) {

        settings =
            await Settings.create({
                siteOnline: value
            });

    }
    else {

        settings.siteOnline =
            value;

        await settings.save();

    }

}


bot.onText(
    /^\/shutdown$/i,
    async msg => {

        if (!isAdmin(msg))
            return deny(msg);


        await setSiteOnline(
            false
        );


        bot.sendMessage(
            msg.chat.id,
            "Site disabled."
        );

    }
);


bot.onText(
    /^\/start$/i,
    async msg => {

        if (!isAdmin(msg))
            return deny(msg);


        await setSiteOnline(
            true
        );


        bot.sendMessage(
            msg.chat.id,
            "Site enabled."
        );

    }
);


// =====================================================
// STATUS
// =====================================================

bot.onText(
    /^\/status$/i,
    async msg => {

        if (!isAdmin(msg))
            return deny(msg);


        const Settings =
            mongoose.models.Settings ||
            mongoose.model(
                "Settings",
                new mongoose.Schema({

                    siteOnline: Boolean,

                    announcement: String

                })
            );


        const settings =
            await Settings.findOne();


        bot.sendMessage(
            msg.chat.id,

            settings?.siteOnline
                ? "Site: ONLINE"
                : "Site: OFFLINE"
        );

    }
);


// =====================================================
// TELEGRAM ERRORS
// =====================================================

bot.on(
    "polling_error",
    error => {

        console.error(
            "Telegram polling error:",
            error.message
        );

    }
);
