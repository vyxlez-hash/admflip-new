/*
 * ADMFLIP telegram.js
 *
 * Telegram admin bot.
 *
 * Required:
 *
 * TELEGRAM_TOKEN
 * TELEGRAM_ADMIN_ID
 */

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
    process.env.TELEGRAM_ADMIN_ID ||
    ""
  );


if (!TOKEN) {

  console.log(
    "Telegram disabled: TELEGRAM_TOKEN missing"
  );

  module.exports = {};

  return;

}


if (!ADMIN_ID) {

  console.log(
    "Telegram disabled: TELEGRAM_ADMIN_ID missing"
  );

  module.exports = {};

  return;

}


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


/* =========================================================
   USER
========================================================= */

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


/* =========================================================
   IMPORTANT:
   SAME CHAT MODEL AS SERVER.JS
========================================================= */

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model(
    "ChatMessage",
    new mongoose.Schema({

      username: {
        type: String,
        default: "ADMFLIP"
      },

      robloxId: {
        type: Number,
        default: null
      },

      avatar: {
        type: String,
        default: ""
      },

      message: {
        type: String,
        maxlength: 300,
        required: true
      },

      type: {
        type: String,
        default: "message"
      },

      pinned: {
        type: Boolean,
        default: false
      },

      createdAt: {
        type: Date,
        default: Date.now
      }

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
      },

      onlineCount: {
        type: Number,
        default: 0
      }

    })
  );


/* =========================================================
   HELPERS
========================================================= */

function isAdmin(msg) {

  return (
    String(
      msg.from?.id ||
      ""
    ) === ADMIN_ID
  );

}


function deny(msg) {

  return bot.sendMessage(
    msg.chat.id,
    "⛔ You are not authorized."
  );

}


function findUser(username) {

  const escaped =
    String(
      username || ""
    )
      .trim()
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );


  return User.findOne({

    username: {
      $regex:
        new RegExp(
          "^" +
          escaped +
          "$",
          "i"
        )
    }

  });

}


/* =========================================================
   HELP
========================================================= */

bot.onText(
  /^\/help$/i,
  async msg => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    return bot.sendMessage(
      msg.chat.id,

      `
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
      `.trim()
    );

  }
);


/* =========================================================
   USER
========================================================= */

bot.onText(
  /^\/user\s+(.+)$/i,
  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const user =
        await findUser(
          match[1]
        );


      if (!user) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      return bot.sendMessage(
        msg.chat.id,

        `User

Username: ${user.username}
Roblox ID: ${user.robloxId}

Balance: ${user.balance}
Wagered: ${user.wagered}
Profit: ${user.profit}

Pets: ${user.inventory.length}`
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `User lookup failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   BALANCE
========================================================= */

bot.onText(
  /^\/balance\s+(.+)$/i,
  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const user =
        await findUser(
          match[1]
        );


      if (!user) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      return bot.sendMessage(
        msg.chat.id,

        `${user.username} balance: ${user.balance}`
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Balance failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   SET BALANCE
========================================================= */

bot.onText(
  /^\/setbalance\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)$/i,
  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const user =
        await findUser(
          match[1]
        );


      if (!user) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      const amount =
        Number(match[2]);


      if (!Number.isFinite(amount)) {

        return bot.sendMessage(
          msg.chat.id,
          "Invalid amount."
        );

      }


      user.balance =
        amount;


      await user.save();


      return bot.sendMessage(
        msg.chat.id,

        `Balance updated for ${user.username}.`
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Set balance failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   ADD PET
========================================================= */

bot.onText(
  /^\/addpet\s+(\S+)\s+(.+?)(?:\s+(NP|R|F|FR|N|NR|NF|NFR|M|MR|MF|MFR))?$/i,

  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

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
        await findUser(
          username
        );


      if (!user) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      /*
       * Look up the trusted value
       * from the site's values database.
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


        const escaped =
          petName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        const found =
          await PetValue.findOne({

            name: {
              $regex:
                new RegExp(
                  "^" +
                  escaped +
                  "$",
                  "i"
                )
            }

          });


        if (found) {

          value =
            Number(
              found.value
            ) || 0;

        }

      } catch (_) {}


      const pet = {

        petId:
          crypto.randomUUID(),

        name:
          petName,

        variant,

        value,

        image:
          "https://amvgg.com/items/" +
          encodeURIComponent(
            petName
          ) +
          ".webp",

        locked:
          false

      };


      user.inventory.push(
        pet
      );


      await user.save();


      return bot.sendMessage(
        msg.chat.id,

        `Added ${petName} ${variant} to ${user.username}.
Pet ID: ${pet.petId}
Value: ${value}`
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Add pet failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   INVENTORY
========================================================= */

bot.onText(
  /^\/inventory\s+(.+)$/i,
  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const user =
        await findUser(
          match[1]
        );


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
            `${pet.name} ${pet.variant || ""}\n` +
            `Value: ${pet.value || 0}\n` +
            `ID: ${pet.petId}`
        );


      return bot.sendMessage(
        msg.chat.id,
        lines.join("\n\n")
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Inventory failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   REMOVE PET
========================================================= */

bot.onText(
  /^\/removepet\s+(\S+)\s+(.+)$/i,

  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const user =
        await findUser(
          match[1]
        );


      if (!user) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      const petId =
        match[2].trim();


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


      return bot.sendMessage(
        msg.chat.id,

        `Removed ${pet.name} ${pet.variant || ""} from ${user.username}.`
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Remove pet failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   TRANSFER
========================================================= */

bot.onText(
  /^\/transfer\s+(\S+)\s+(\S+)\s+(.+)$/i,

  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const from =
        await findUser(
          match[1]
        );


      const to =
        await findUser(
          match[2]
        );


      if (!from || !to) {

        return bot.sendMessage(
          msg.chat.id,
          "User not found."
        );

      }


      const petId =
        match[3].trim();


      const index =
        from.inventory.findIndex(
          pet =>
            pet.petId ===
            petId &&
            !pet.locked
        );


      if (index === -1) {

        return bot.sendMessage(
          msg.chat.id,
          "Exact unlocked pet not found."
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


      await from.save();

      await to.save();


      return bot.sendMessage(
        msg.chat.id,
        "Transfer completed."
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Transfer failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   ANNOUNCE + PIN
========================================================= */

bot.onText(
  /^\/announce\s+([\s\S]+)$/i,

  async (msg, match) => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const text =
        match[1]
          .trim()
          .slice(0, 300);


      if (!text) {

        return bot.sendMessage(
          msg.chat.id,
          "Announcement is empty."
        );

      }


      /*
       * Unpin all previous site announcements.
       */

      await ChatMessage.updateMany(
        {
          type:
            "announcement"
        },

        {
          $set: {
            pinned: false
          }
        }
      );


      /*
       * Create the new pinned
       * announcement in the SAME
       * collection the website reads.
       */

      await ChatMessage.create({

        username:
          "ADMFLIP",

        robloxId:
          null,

        avatar:
          "",

        message:
          text,

        type:
          "announcement",

        pinned:
          true

      });


      await Settings.findOneAndUpdate(

        {},

        {
          $set: {
            announcement:
              text
          }
        },

        {
          upsert: true
        }

      );


      return bot.sendMessage(
        msg.chat.id,

        "📌 Announcement posted and pinned in the site chat."
      );

    } catch (error) {

      console.error(
        "Announcement:",
        error
      );


      return bot.sendMessage(
        msg.chat.id,

        `Announcement failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   SITE ONLINE / OFFLINE
========================================================= */

async function setSiteOnline(
  value
) {

  return Settings.findOneAndUpdate(

    {},

    {
      $set: {
        siteOnline:
          Boolean(value)
      }
    },

    {
      upsert: true,
      new: true
    }

  );

}


bot.onText(
  /^\/shutdown$/i,

  async msg => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      await setSiteOnline(
        false
      );


      return bot.sendMessage(
        msg.chat.id,
        "Site disabled."
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Shutdown failed: ${error.message}`
      );

    }

  }
);


bot.onText(
  /^\/start$/i,

  async msg => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      await setSiteOnline(
        true
      );


      return bot.sendMessage(
        msg.chat.id,
        "Site enabled."
      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Start failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   STATUS
========================================================= */

bot.onText(
  /^\/status$/i,

  async msg => {

    if (!isAdmin(msg)) {
      return deny(msg);
    }


    try {

      const settings =
        await Settings.findOne();


      return bot.sendMessage(

        msg.chat.id,

        settings?.siteOnline === false
          ? "Site: OFFLINE"
          : "Site: ONLINE"

      );

    } catch (error) {

      return bot.sendMessage(
        msg.chat.id,
        `Status failed: ${error.message}`
      );

    }

  }
);


/* =========================================================
   ERRORS
========================================================= */

bot.on(
  "polling_error",

  error => {

    console.error(
      "Telegram polling error:",
      error.message
    );

  }
);


module.exports = {
  bot
};
