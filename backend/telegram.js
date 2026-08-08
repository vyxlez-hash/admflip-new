/*
 * ADMFLIP telegram.js
 * Admin bot + site chat announcements.
 *
 * Required environment:
 * TELEGRAM_TOKEN
 * TELEGRAM_ADMIN_ID
 */

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
  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log("Telegram bot online");

  const PetSchema = new mongoose.Schema({
    petId: String,
    name: String,
    variant: String,
    value: Number,
    image: String,
    locked: Boolean
  }, { _id: false });

  const User = mongoose.models.User || mongoose.model("User",
    new mongoose.Schema({
      robloxId: { type: Number, unique: true },
      username: String,
      avatar: String,
      balance: { type: Number, default: 0 },
      wagered: { type: Number, default: 0 },
      profit: { type: Number, default: 0 },
      inventory: { type: [PetSchema], default: [] }
    })
  );

  const Chat = mongoose.models.Chat || mongoose.model("Chat",
    new mongoose.Schema({
      type: { type: String, default: "message" },
      userId: { type: Number, default: null },
      username: { type: String, default: "Guest" },
      avatar: { type: String, default: "" },
      content: { type: String, required: true },
      pinned: { type: Boolean, default: false }
    }, { timestamps: true })
  );

  const Settings = mongoose.models.Settings || mongoose.model("Settings",
    new mongoose.Schema({
      siteOnline: { type: Boolean, default: true },
      announcement: { type: String, default: "" }
    })
  );

  function isAdmin(msg) {
    return String(msg.from?.id || "") === ADMIN_ID;
  }

  function deny(msg) {
    return bot.sendMessage(msg.chat.id, "⛔ You are not authorized.");
  }

  async function findUser(username) {
    return User.findOne({
      username: {
        $regex: new RegExp("^" + String(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i")
      }
    });
  }

  bot.onText(/^\/help$/i, async msg => {
    if (!isAdmin(msg)) return deny(msg);

    return bot.sendMessage(msg.chat.id, `
ADMFLIP ADMIN

/help
/user <username>
/balance <username>
/setbalance <username> <amount>
/addpet <username> <pet name> [variant]
/removepet <username> <petId>
/inventory <username>
/transfer <from> <to> <petId>
/announce <message>
/shutdown
/start
/status
    `.trim());
  });

  bot.onText(/^\/user\s+(.+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const user = await findUser(match[1].trim());
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");

    return bot.sendMessage(msg.chat.id,
      `User\n\nUsername: ${user.username}\nRoblox ID: ${user.robloxId}\nBalance: ${user.balance}\nWagered: ${user.wagered}\nProfit: ${user.profit}\nPets: ${user.inventory.length}`
    );
  });

  bot.onText(/^\/balance\s+(.+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const user = await findUser(match[1].trim());
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");

    return bot.sendMessage(msg.chat.id, `${user.username} balance: ${user.balance}`);
  });

  bot.onText(/^\/setbalance\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const user = await findUser(match[1]);
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");

    user.balance = Number(match[2]);
    await user.save();

    return bot.sendMessage(msg.chat.id, `Balance updated for ${user.username}.`);
  });

  bot.onText(/^\/addpet\s+(\S+)\s+(.+?)(?:\s+(NP|R|F|FR|N|NR|NF|NFR|M|MR|MF|MFR))?$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const username = match[1];
    const petName = match[2].trim();
    const variant = (match[3] || "NP").toUpperCase();

    const user = await findUser(username);
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");

    let value = 0;
    let image = "";

    try {
      const PetValue = mongoose.models.PetValue || mongoose.model("PetValue",
        new mongoose.Schema({ name: String, value: Number, image: String })
      );

      const safeName = petName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const found = await PetValue.findOne({
        name: { $regex: new RegExp("^" + safeName + "$", "i") }
      });

      if (found) {
        value = Number(found.value) || 0;
        image = found.image || "";
      }
    } catch (_) {}

    const pet = {
      petId: crypto.randomUUID(),
      name: petName,
      variant,
      value,
      image,
      locked: false
    };

    user.inventory.push(pet);
    await user.save();

    return bot.sendMessage(
      msg.chat.id,
      `Added ${petName} ${variant} to ${user.username}.\nPet ID: ${pet.petId}\nValue: ${value}`
    );
  });

  bot.onText(/^\/inventory\s+(.+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const user = await findUser(match[1].trim());
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");
    if (!user.inventory.length) return bot.sendMessage(msg.chat.id, "Inventory is empty.");

    const lines = user.inventory.map(p =>
      `${p.name} ${p.variant}\nValue: ${p.value}\nID: ${p.petId}`
    );

    return bot.sendMessage(msg.chat.id, lines.join("\n\n"));
  });

  bot.onText(/^\/removepet\s+(\S+)\s+(.+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const user = await findUser(match[1]);
    if (!user) return bot.sendMessage(msg.chat.id, "User not found.");

    const index = user.inventory.findIndex(p => p.petId === match[2].trim());
    if (index === -1) return bot.sendMessage(msg.chat.id, "Exact pet ID not found.");

    if (user.inventory[index].locked) {
      return bot.sendMessage(msg.chat.id, "That pet is currently locked in a coinflip.");
    }

    const pet = user.inventory[index];
    user.inventory.splice(index, 1);
    await user.save();

    return bot.sendMessage(msg.chat.id, `Removed ${pet.name} ${pet.variant} from ${user.username}.`);
  });

  bot.onText(/^\/transfer\s+(\S+)\s+(\S+)\s+(.+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const from = await findUser(match[1]);
    const to = await findUser(match[2]);

    if (!from || !to) return bot.sendMessage(msg.chat.id, "User not found.");

    const index = from.inventory.findIndex(p => p.petId === match[3].trim() && !p.locked);
    if (index === -1) {
      return bot.sendMessage(msg.chat.id, "Exact unlocked pet not found.");
    }

    const pet = from.inventory[index];
    from.inventory.splice(index, 1);
    to.inventory.push(pet);

    await from.save();
    await to.save();

    return bot.sendMessage(msg.chat.id, "Transfer completed.");
  });

  /*
   * /announce posts a PINNED announcement in the site's chat.
   * "pinned" is stored in MongoDB so the website can render it at the top.
   */
  bot.onText(/^\/announce\s+([\s\S]+)$/i, async (msg, match) => {
    if (!isAdmin(msg)) return deny(msg);

    const text = match[1].trim();

    await Chat.updateMany(
      { pinned: true },
      { $set: { pinned: false } }
    );

    const announcement = await Chat.create({
      type: "announcement",
      content: text,
      username: "ADMFLIP",
      userId: null,
      avatar: "",
      pinned: true
    });

    return bot.sendMessage(
      msg.chat.id,
      `📌 Announcement posted and pinned.\nID: ${announcement._id}`
    );
  });

  async function setSiteOnline(value) {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        siteOnline: value
      });
    } else {
      settings.siteOnline = value;
      await settings.save();
    }
  }

  bot.onText(/^\/shutdown$/i, async msg => {
    if (!isAdmin(msg)) return deny(msg);
    await setSiteOnline(false);
    return bot.sendMessage(msg.chat.id, "Site disabled.");
  });

  bot.onText(/^\/start$/i, async msg => {
    if (!isAdmin(msg)) return deny(msg);
    await setSiteOnline(true);
    return bot.sendMessage(msg.chat.id, "Site enabled.");
  });

  bot.onText(/^\/status$/i, async msg => {
    if (!isAdmin(msg)) return deny(msg);

    const settings = await Settings.findOne();
    return bot.sendMessage(
      msg.chat.id,
      settings?.siteOnline ? "Site: ONLINE" : "Site: OFFLINE"
    );
  });

  bot.on("polling_error", error => {
    console.error("Telegram polling error:", error.message);
  });

  module.exports = bot;
}
