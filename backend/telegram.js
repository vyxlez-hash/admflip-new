const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const crypto = require("crypto");

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = String(process.env.TELEGRAM_ADMIN_ID || "");

if (!TOKEN) {
    console.log("Telegram disabled: TELEGRAM_TOKEN missing");
    module.exports = null;
} else if (!ADMIN_ID) {
    console.log("Telegram disabled: TELEGRAM_ADMIN_ID missing");
    module.exports = null;
} else {

    const bot = new TelegramBot(TOKEN, {
        polling: true
    });

    console.log("Telegram bot online");

    // =====================================================
    // MODELS
    // =====================================================

    const PetSchema = new mongoose.Schema({
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

    const Chat =
        mongoose.models.Chat ||
        mongoose.model(
            "Chat",
            new mongoose.Schema({
                type: {
                    type: String,
                    default: "message"
                },

                userId: Number,
                username: String,
                avatar: String,
                content: String
            }, {
                timestamps: true
            })
        );

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

    const Settings =
        mongoose.models.Settings ||
        mongoose.model(
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

    // =====================================================
    // HELPERS
    // =====================================================

    function isAdmin(msg) {
        return String(msg.from?.id || "") === ADMIN_ID;
    }

    function deny(msg) {
        return bot.sendMessage(
            msg.chat.id,
            "⛔ You are not authorized."
        );
    }

    function escapeRegex(value) {
        return String(value).replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    }

    async function findUser(username) {
        return User.findOne({
            username: {
                $regex: new RegExp(
                    "^" + escapeRegex(username) + "$",
                    "i"
                )
            }
        });
    }

    // =====================================================
    // HELP
    // =====================================================

    bot.onText(/^\/help$/i, async (msg) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

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
Show site status
`;

        await bot.sendMessage(
            msg.chat.id,
            text
        );
    });

    // =====================================================
    // USER
    // =====================================================

    bot.onText(/^\/user\s+(.+)$/i, async (msg, match) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            const username = match[1].trim();
            const user = await findUser(username);

            if (!user) {
                return bot.sendMessage(
                    msg.chat.id,
                    "User not found."
                );
            }

            await bot.sendMessage(
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

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to find user."
            );
        }
    });

    // =====================================================
    // BALANCE
    // =====================================================

    bot.onText(/^\/balance\s+(.+)$/i, async (msg, match) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            const username = match[1].trim();
            const user = await findUser(username);

            if (!user) {
                return bot.sendMessage(
                    msg.chat.id,
                    "User not found."
                );
            }

            await bot.sendMessage(
                msg.chat.id,
                `${user.username} balance: ${user.balance}`
            );

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to get balance."
            );
        }
    });

    // =====================================================
    // SET BALANCE
    // =====================================================

    bot.onText(
        /^\/setbalance\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)$/i,
        async (msg, match) => {

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            try {

                const username = match[1];
                const amount = Number(match[2]);

                if (!Number.isFinite(amount)) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "Invalid amount."
                    );
                }

                const user = await findUser(username);

                if (!user) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "User not found."
                    );
                }

                user.balance = amount;

                await user.save();

                await bot.sendMessage(
                    msg.chat.id,
                    `Balance updated for ${user.username}: ${amount}`
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    "Failed to update balance."
                );
            }
        }
    );

    // =====================================================
    // ADD PET
    // =====================================================

    bot.onText(
        /^\/addpet\s+(\S+)\s+(.+?)(?:\s+(NP|R|F|FR|N|NR|NF|NFR|M|MR|MF|MFR))?$/i,
        async (msg, match) => {

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            try {

                const username = match[1];
                const petName = match[2].trim();

                const variant =
                    (match[3] || "NP").toUpperCase();

                const user = await findUser(username);

                if (!user) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "User not found."
                    );
                }

                const found = await PetValue.findOne({
                    name: {
                        $regex: new RegExp(
                            "^" + escapeRegex(petName) + "$",
                            "i"
                        )
                    }
                });

                const value =
                    Number(found?.value) || 0;

                const image =
                    found?.image || "";

                const pet = {
                    petId: crypto.randomUUID(),
                    name: found?.name || petName,
                    variant,
                    value,
                    image,
                    locked: false
                };

                user.inventory.push(pet);

                await user.save();

                await bot.sendMessage(
                    msg.chat.id,
                    `Added ${pet.name} ${variant} to ${user.username}.\nValue: ${value}\nPet ID: ${pet.petId}`
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    "Failed to add pet."
                );
            }
        }
    );

    // =====================================================
    // INVENTORY
    // =====================================================

    bot.onText(/^\/inventory\s+(.+)$/i, async (msg, match) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            const username = match[1].trim();
            const user = await findUser(username);

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

            const lines = user.inventory.map((pet, index) => {
                return (
                    `${index + 1}. ${pet.name} ${pet.variant}\n` +
                    `Value: ${pet.value}\n` +
                    `ID: ${pet.petId}`
                );
            });

            await bot.sendMessage(
                msg.chat.id,
                lines.join("\n\n")
            );

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to load inventory."
            );
        }
    });

    // =====================================================
    // REMOVE PET
    // =====================================================

    bot.onText(
        /^\/removepet\s+(\S+)\s+(.+)$/i,
        async (msg, match) => {

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            try {

                const username = match[1];
                const petId = match[2].trim();

                const user = await findUser(username);

                if (!user) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "User not found."
                    );
                }

                const index = user.inventory.findIndex(
                    pet =>
                        pet.petId === petId
                );

                if (index === -1) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "Exact pet ID not found."
                    );
                }

                const pet = user.inventory[index];

                if (pet.locked) {
                    return bot.sendMessage(
                        msg.chat.id,
                        "That pet is currently locked in a coinflip."
                    );
                }

                user.inventory.splice(index, 1);

                await user.save();

                await bot.sendMessage(
                    msg.chat.id,
                    `Removed ${pet.name} ${pet.variant} from ${user.username}.`
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    "Failed to remove pet."
                );
            }
        }
    );

    // =====================================================
    // TRANSFER
    // =====================================================

    bot.onText(
        /^\/transfer\s+(\S+)\s+(\S+)\s+(.+)$/i,
        async (msg, match) => {

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            const fromName = match[1];
            const toName = match[2];
            const petId = match[3].trim();

            const session = await mongoose.startSession();

            try {

                await session.withTransaction(async () => {

                    const from = await findUser(fromName)
                        .session(session);

                    const to = await findUser(toName)
                        .session(session);

                    if (!from || !to) {
                        throw new Error("User not found");
                    }

                    const index =
                        from.inventory.findIndex(
                            pet =>
                                pet.petId === petId &&
                                !pet.locked
                        );

                    if (index === -1) {
                        throw new Error(
                            "Exact unlocked pet not found"
                        );
                    }

                    const pet = from.inventory[index];

                    from.inventory.splice(index, 1);
                    to.inventory.push(pet);

                    await from.save({ session });
                    await to.save({ session });
                });

                await bot.sendMessage(
                    msg.chat.id,
                    "Transfer completed."
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    `Transfer failed: ${error.message}`
                );

            } finally {

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

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            try {

                const text = match[1].trim();

                await Chat.create({
                    type: "announcement",
                    content: text,
                    username: "ADMFLIP",
                    userId: null,
                    avatar: ""
                });

                await bot.sendMessage(
                    msg.chat.id,
                    "Announcement posted."
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    "Failed to post announcement."
                );
            }
        }
    );

    // =====================================================
    // SITE STATUS
    // =====================================================

    async function setSiteOnline(value) {

        let settings =
            await Settings.findOne();

        if (!settings) {

            settings =
                await Settings.create({
                    siteOnline: value
                });

        } else {

            settings.siteOnline = value;

            await settings.save();
        }
    }

    // =====================================================
    // SHUTDOWN
    // =====================================================

    bot.onText(/^\/shutdown$/i, async (msg) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            await setSiteOnline(false);

            await bot.sendMessage(
                msg.chat.id,
                "Site disabled."
            );

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to disable site."
            );
        }
    });

    // =====================================================
    // START
    // =====================================================

    bot.onText(/^\/start$/i, async (msg) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            await setSiteOnline(true);

            await bot.sendMessage(
                msg.chat.id,
                "Site enabled."
            );

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to enable site."
            );
        }
    });

    // =====================================================
    // STATUS
    // =====================================================

    bot.onText(/^\/status$/i, async (msg) => {

        if (!isAdmin(msg)) {
            return deny(msg);
        }

        try {

            const settings =
                await Settings.findOne();

            await bot.sendMessage(
                msg.chat.id,
                settings?.siteOnline
                    ? "Site: ONLINE"
                    : "Site: OFFLINE"
            );

        } catch (error) {

            console.error(error);

            await bot.sendMessage(
                msg.chat.id,
                "Failed to read site status."
            );
        }
    });

    // =====================================================
    // TELEGRAM -> SITE CHAT
    // =====================================================

    bot.onText(
        /^\/chat\s+([\s\S]+)$/i,
        async (msg, match) => {

            if (!isAdmin(msg)) {
                return deny(msg);
            }

            try {

                const content = match[1].trim();

                await Chat.create({
                    type: "message",
                    userId: Number(msg.from?.id) || null,
                    username: "ADMFLIP",
                    avatar: "",
                    content
                });

                await bot.sendMessage(
                    msg.chat.id,
                    "Message sent to site chat."
                );

            } catch (error) {

                console.error(error);

                await bot.sendMessage(
                    msg.chat.id,
                    "Failed to send chat message."
                );
            }
        }
    );

    // =====================================================
    // ERRORS
    // =====================================================

    bot.on("polling_error", error => {
        console.error(
            "Telegram polling error:",
            error.message
        );
    });

    bot.on("error", error => {
        console.error(
            "Telegram bot error:",
            error.message
        );
    });

    module.exports = bot;
}
