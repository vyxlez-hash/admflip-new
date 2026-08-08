const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));


// =====================================================
// MONGODB
// =====================================================

if (!process.env.MONGO_URL) {
  console.error("MONGO_URL is missing");
}

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(error => {
    console.error(
      "MongoDB error:",
      error.message
    );
  });


// =====================================================
// USER
// =====================================================

const inventoryItemSchema =
  new mongoose.Schema({
    name: {
      type: String,
      required: true
    },

    value: {
      type: Number,
      required: true,
      min: 0
    },

    variant: {
      type: String,
      default: ""
    },

    addedAt: {
      type: Date,
      default: Date.now
    }
  });


const User = mongoose.model(
  "User",
  new mongoose.Schema({
    robloxId: {
      type: Number,
      unique: true,
      index: true
    },

    username: {
      type: String,
      index: true
    },

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
      type: [inventoryItemSchema],
      default: []
    },

    deposited: {
      type: [inventoryItemSchema],
      default: []
    }
  }, {
    timestamps: true
  })
);


// =====================================================
// SETTINGS
// =====================================================

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
    },

    // PERSISTENT CHAT COUNT
    onlineCount: {
      type: Number,
      default: 37
    }
  })
);


// =====================================================
// CHAT
// =====================================================

const ChatMessage = mongoose.model(
  "ChatMessage",
  new mongoose.Schema({
    username: String,

    robloxId: Number,

    avatar: String,

    message: {
      type: String,
      maxlength: 300,
      required: true
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


// =====================================================
// COINFLIP
// =====================================================

const Coinflip = mongoose.model(
  "Coinflip",
  new mongoose.Schema({
    creatorId: Number,

    creatorUsername: String,

    creatorAvatar: String,

    itemId: mongoose.Schema.Types.ObjectId,

    petName: String,

    petValue: Number,

    petVariant: String,

    side: {
      type: String,

      enum: [
        "heads",
        "tails"
      ]
    },

    status: {
      type: String,

      enum: [
        "active",
        "joined",
        "completed",
        "cancelled"
      ],

      default: "active"
    },

    joinerId: Number,

    joinerUsername: String,

    joinerAvatar: String,

    winnerId: Number,

    createdAt: {
      type: Date,
      default: Date.now
    },

    completedAt: Date
  })
);


// =====================================================
// VALUES
// =====================================================

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

    const result = [];

    for (
      let i = 0;
      i < lines.length;
      i += 2
    ) {

      const name =
        lines[i];

      const raw =
        lines[i + 1];

      if (!name || !raw) {
        continue;
      }

      const value =
        Number(
          raw.replace(
            /[^\d.-]/g,
            ""
          )
        );

      if (
        !Number.isFinite(value)
      ) {
        continue;
      }

      result.push({
        name,
        value
      });
    }

    console.log(
      "Loaded pets:",
      result.length
    );

    return result;

  } catch (error) {

    console.error(
      "values.txt error:",
      error.message
    );

    return [];
  }
}


const pets =
  loadPets();


function petImage(name) {

  if (!name) {
    return "";
  }

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp"
  );
}


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

  res.json({
    success: true,
    message:
      "ADMFLIP backend is online"
  });

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
          await Settings.create({
            siteOnline: true,
            onlineCount: 37
          });

      }

      res.json({
        success: true,

        online:
          settings.siteOnline,

        announcement:
          settings.announcement
      });

    } catch {

      res.json({
        success: true,

        online: true,

        announcement: ""
      });

    }

  }
);


// =====================================================
// PERSISTENT ONLINE COUNT
// =====================================================

app.get(
  "/chat/online",
  async (req, res) => {

    try {

      let settings =
        await Settings.findOne();

      if (!settings) {

        settings =
          await Settings.create({
            siteOnline: true,
            onlineCount: 37
          });

      }

      // IMPORTANT:
      // No Math.random() here.
      // Refreshing will return the same value.

      res.json({
        success: true,

        online:
          settings.onlineCount ?? 37
      });

    } catch (error) {

      console.error(
        "Online count:",
        error.message
      );

      res.json({
        success: true,
        online: 37
      });

    }

  }
);


// =====================================================
// PETS
// =====================================================

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
            petImage(
              pet.name
            )
        }))
    });

  }
);


// =====================================================
// ROBLOX USER
// =====================================================

app.get(
  "/user/:username",
  async (req, res) => {

    try {

      const username =
        req.params.username.trim();

      if (!username) {

        return res.status(400).json({
          success: false,
          message:
            "Username required"
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

      const robloxUser =
        data.data[0];

      let avatar = "";

      try {

        const avatarResponse =
          await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
          );

        const avatarData =
          await avatarResponse.json();

        avatar =
          avatarData.data?.[0]
            ?.imageUrl || "";

      } catch {}

      await User.findOneAndUpdate(

        {
          robloxId:
            robloxUser.id
        },

        {
          $set: {
            username:
              robloxUser.name,

            avatar
          },

          $setOnInsert: {
            robloxId:
              robloxUser.id
          }
        },

        {
          upsert: true,
          new: true
        }

      );

      res.json({
        success: true,

        user: {
          id:
            robloxUser.id,

          username:
            robloxUser.name,

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


// =====================================================
// VERIFICATION PHRASE
// =====================================================

function generatePhrase() {

  const words = [
    "BlueTiger",
    "FastCloud",
    "LuckyWave",
    "SilverMoon",
    "GoldenLeaf",
    "PurpleFox",
    "NightWolf",
    "CrystalStar"
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
      success: true,

      phrase:
        generatePhrase()
    });

  }
);


// =====================================================
// VERIFY
// =====================================================

app.post(
  "/check",
  async (req, res) => {

    try {

      const {
        username,
        phrase
      } = req.body;

      if (!username || !phrase) {

        return res.status(400).json({
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

      let avatar = "";

      try {

        const avatarResponse =
          await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
          );

        const avatarData =
          await avatarResponse.json();

        avatar =
          avatarData.data?.[0]
            ?.imageUrl || "";

      } catch {}

      await User.findOneAndUpdate(

        {
          robloxId: id
        },

        {
          $set: {
            username:
              profile.name,

            avatar
          },

          $setOnInsert: {
            robloxId: id
          }
        },

        {
          upsert: true,
          new: true
        }

      );

      res.json({
        success: true,

        username:
          profile.name,

        id,

        avatar
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


// =====================================================
// ACCOUNT
// =====================================================

app.get(
  "/account/:robloxId",
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.robloxId
        );

      if (
        !Number.isSafeInteger(id)
      ) {

        return res.status(400).json({
          success: false,

          message:
            "Invalid user"
        });

      }

      const user =
        await User.findOne({
          robloxId: id
        }).lean();

      if (!user) {

        return res.status(404).json({
          success: false,

          message:
            "User not found"
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
            user.balance || 0,

          wagered:
            user.wagered || 0,

          profit:
            user.profit || 0,

          inventory:
            (user.inventory || [])
              .map(item => ({

                itemId:
                  item._id,

                name:
                  item.name,

                value:
                  item.value,

                variant:
                  item.variant || "",

                image:
                  petImage(
                    item.name
                  )

              }))
        }

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Could not load account"
      });

    }

  }
);


// =====================================================
// CHAT
// =====================================================

function containsLink(text) {

  return /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|\.com\b|\.net\b|\.gg\b|\.org\b)/i
    .test(text);

}


app.get(
  "/chat/messages",
  async (req, res) => {

    try {

      const messages =
        await ChatMessage.find()
          .sort({
            createdAt: -1
          })
          .limit(100)
          .lean();

      res.json({
        success: true,

        messages:
          messages.reverse()
      });

    } catch {

      res.json({
        success: true,

        messages: []
      });

    }

  }
);


app.post(
  "/chat/messages",
  async (req, res) => {

    try {

      const {
        robloxId,
        username,
        avatar,
        message
      } = req.body;

      if (
        !robloxId ||
        !username ||
        !message
      ) {

        return res.status(400).json({
          success: false,

          message:
            "Sign in to chat"
        });

      }

      const clean =
        String(message)
          .replace(
            /[<>]/g,
            ""
          )
          .trim();

      if (!clean) {

        return res.status(400).json({
          success: false,

          message:
            "Message is empty"
        });

      }

      if (clean.length > 300) {

        return res.status(400).json({
          success: false,

          message:
            "Message is too long"
        });

      }

      if (containsLink(clean)) {

        return res.status(400).json({
          success: false,

          message:
            "Links are not allowed"
        });

      }

      const messageDoc =
        await ChatMessage.create({
          username,

          robloxId:
            Number(robloxId),

          avatar:
            avatar || "",

          message:
            clean,

          type:
            "message"
        });

      res.json({
        success: true,

        message:
          messageDoc
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Could not send message"
      });

    }

  }
);


// =====================================================
// COINFLIPS
// =====================================================

app.get(
  "/coinflips",
  async (req, res) => {

    try {

      const flips =
        await Coinflip.find({
          status: "active"
        })
          .sort({
            createdAt: -1
          })
          .limit(50)
          .lean();

      res.json({
        success: true,

        coinflips:
          flips.map(flip => ({

            id:
              flip._id,

            username:
              flip.creatorUsername,

            avatar:
              flip.creatorAvatar,

            petName:
              flip.petName,

            petValue:
              flip.petValue,

            variant:
              flip.petVariant || "",

            side:
              flip.side,

            image:
              petImage(
                flip.petName
              )
          }))
      });

    } catch {

      res.json({
        success: true,

        coinflips: []
      });

    }

  }
);


// =====================================================
// CREATE COINFLIP
// =====================================================

app.post(
  "/coinflips",
  async (req, res) => {

    try {

      const {
        robloxId,
        itemId,
        side
      } = req.body;

      const userId =
        Number(robloxId);

      if (
        !Number.isSafeInteger(
          userId
        ) ||
        !mongoose.isValidObjectId(
          itemId
        )
      ) {

        return res.status(400).json({
          success: false,

          message:
            "Invalid request"
        });

      }

      if (
        side !== "heads" &&
        side !== "tails"
      ) {

        return res.status(400).json({
          success: false,

          message:
            "Invalid side"
        });

      }

      const user =
        await User.findOne({
          robloxId:
            userId
        });

      if (!user) {

        return res.status(404).json({
          success: false,

          message:
            "User not found"
        });

      }

      const item =
        user.inventory.id(
          itemId
        );

      if (!item) {

        return res.status(400).json({
          success: false,

          message:
            "Pet is not in your inventory"
        });

      }

      /*
       * Remove the exact inventory item.
       * The browser never supplies the pet value.
       */
      const locked =
        await User.findOneAndUpdate(

          {
            robloxId:
              userId,

            "inventory._id":
              itemId
          },

          {
            $pull: {
              inventory: {
                _id:
                  itemId
              }
            }
          },

          {
            new: true
          }
        );

      if (!locked) {

        return res.status(409).json({
          success: false,

          message:
            "That pet is already being used."
        });

      }

      const flip =
        await Coinflip.create({

          creatorId:
            userId,

          creatorUsername:
            user.username,

          creatorAvatar:
            user.avatar,

          itemId,

          petName:
            item.name,

          petValue:
            item.value,

          petVariant:
            item.variant || "",

          side,

          status:
            "active"
        });

      res.json({
        success: true,

        coinflip: {

          id:
            flip._id,

          petName:
            flip.petName,

          petValue:
            flip.petValue,

          side:
            flip.side,

          image:
            petImage(
              flip.petName
            )
        }
      });

    } catch (error) {

      console.error(
        "Create coinflip:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          "Could not create coinflip"
      });

    }

  }
);


// =====================================================
// LEADERBOARD
// =====================================================

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
          .lean();

      res.json({
        success: true,

        users:
          users.map(
            (user, index) => ({

              place:
                index + 1,

              username:
                user.username,

              avatar:
                user.avatar,

              wagered:
                user.wagered || 0,

              profit:
                user.profit || 0
            })
          )
      });

    } catch {

      res.json({
        success: true,

        users: []
      });

    }

  }
);


// =====================================================
// TELEGRAM
// =====================================================

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


// =====================================================
// START
// =====================================================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      `ADMFLIP backend running on port ${PORT}`
    );

  }
);
