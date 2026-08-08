const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

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
  .catch((error) => {
    console.error("MongoDB error:", error.message);
  });

// =====================================================
// USER SCHEMA
// =====================================================

const inventoryItemSchema = new mongoose.Schema({
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
  new mongoose.Schema(
    {
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
    },
    {
      timestamps: true
    }
  )
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
      enum: ["heads", "tails", "H", "T"]
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
// PET VALUES
// =====================================================

function loadPets() {
  try {
    const text = fs.readFileSync(
      "./values.txt",
      "utf8"
    );

    const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    const result = [];

    for (let i = 0; i < lines.length; i += 2) {
      const name = lines[i];
      const raw = lines[i + 1];

      if (!name || !raw) {
        continue;
      }

      const value = Number(
        raw.replace(/[^\d.-]/g, "")
      );

      if (!Number.isFinite(value)) {
        continue;
      }

      result.push({
        name,
        value
      });
    }

    console.log(
      `Loaded pets: ${result.length}`
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

const pets = loadPets();

function petImage(name) {
  if (!name) {
    return "";
  }

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(
      String(name).trim()
    ) +
    ".webp"
  );
}

// =====================================================
// HEALTH
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ADMFLIP backend is online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true
  });
});

// =====================================================
// STATUS
// =====================================================

app.get("/status", async (req, res) => {
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
      online: settings.siteOnline,
      announcement:
        settings.announcement || ""
    });

  } catch (error) {
    console.error(
      "Status error:",
      error.message
    );

    res.json({
      success: true,
      online: true,
      announcement: ""
    });
  }
});

// =====================================================
// ONLINE COUNT
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

      res.json({
        success: true,
        online:
          settings.onlineCount ?? 37
      });

    } catch (error) {
      console.error(
        "Online count error:",
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
// PETS / VALUES
// =====================================================

app.get("/pets", (req, res) => {
  res.json({
    success: true,

    pets: pets.map((pet) => ({
      id: pet.name
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          "-"
        ),

      name: pet.name,

      value: pet.value,

      image: petImage(
        pet.name
      )
    }))
  });
});

// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

async function getRobloxUser(
  username
) {
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

  if (!response.ok) {
    throw new Error(
      `Roblox API returned ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    !data.data ||
    !data.data.length
  ) {
    return null;
  }

  return data.data[0];
}

async function getRobloxAvatar(
  userId
) {
  try {
    const response =
      await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
      );

    if (!response.ok) {
      return "";
    }

    const data =
      await response.json();

    return (
      data.data?.[0]
        ?.imageUrl || ""
    );

  } catch {
    return "";
  }
}

// =====================================================
// USER LOOKUP
// =====================================================

app.get(
  "/user/:username",
  async (req, res) => {
    try {
      const username =
        String(
          req.params.username || ""
        ).trim();

      if (!username) {
        return res.status(400).json({
          success: false,
          message:
            "Username required"
        });
      }

      const robloxUser =
        await getRobloxUser(
          username
        );

      if (!robloxUser) {
        return res.json({
          success: false,
          message:
            "Roblox username not found"
        });
      }

      const avatar =
        await getRobloxAvatar(
          robloxUser.id
        );

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

          robloxId:
            robloxUser.id,

          username:
            robloxUser.name,

          avatar
        }
      });

    } catch (error) {
      console.error(
        "User lookup:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not contact Roblox"
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

app.get("/create", (req, res) => {
  res.json({
    success: true,
    phrase:
      generatePhrase()
  });
});

// =====================================================
// VERIFY ROBLOX BIO
// =====================================================

app.post(
  "/check",
  async (req, res) => {
    try {
      const username =
        String(
          req.body?.username || ""
        ).trim();

      const phrase =
        String(
          req.body?.phrase || ""
        ).trim();

      if (!username || !phrase) {
        return res.status(400).json({
          success: false,
          message:
            "Username and phrase required"
        });
      }

      const robloxUser =
        await getRobloxUser(
          username
        );

      if (!robloxUser) {
        return res.json({
          success: false,
          message:
            "Roblox username not found"
        });
      }

      const profileResponse =
        await fetch(
          `https://users.roblox.com/v1/users/${robloxUser.id}`
        );

      if (!profileResponse.ok) {
        return res.status(502).json({
          success: false,
          message:
            "Could not read Roblox profile"
        });
      }

      const profile =
        await profileResponse.json();

      const description =
        String(
          profile.description || ""
        );

      if (
        !description.includes(
          phrase
        )
      ) {
        return res.json({
          success: false,
          message:
            "Verification phrase not found in Roblox bio"
        });
      }

      const avatar =
        await getRobloxAvatar(
          robloxUser.id
        );

      await User.findOneAndUpdate(
        {
          robloxId:
            robloxUser.id
        },

        {
          $set: {
            username:
              profile.name,

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

        id:
          robloxUser.id,

        username:
          profile.name,

        avatar
      });

    } catch (error) {
      console.error(
        "Verification error:",
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

          robloxId:
            user.robloxId,

          username:
            user.username,

          avatar:
            user.avatar || "",

          balance:
            user.balance || 0,

          wagered:
            user.wagered || 0,

          profit:
            user.profit || 0,

          inventory:
            (user.inventory || [])
              .map((item) => ({
                itemId:
                  item._id,

                _id:
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
      console.error(
        "Account error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not load account"
      });
    }
  }
);

// =====================================================
// INVENTORY
// =====================================================

app.get(
  "/inventory/:robloxId",
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

        inventory:
          (user.inventory || [])
            .map((item) => ({
              itemId:
                item._id,

              _id:
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
      });

    } catch (error) {
      console.error(
        "Inventory error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not load inventory"
      });
    }
  }
);

// =====================================================
// CHAT HELPERS
// =====================================================

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg|discord\.com\/invite|(?:^|\s)[\w-]+\.(?:com|net|gg|org|io)(?:\s|$))/i
    .test(text);
}

// =====================================================
// CHAT GET
// =====================================================

async function getChatMessages() {
  const messages =
    await ChatMessage.find()
      .sort({
        createdAt: -1
      })
      .limit(100)
      .lean();

  return messages.reverse();
}

app.get(
  "/chat/messages",
  async (req, res) => {
    try {
      const messages =
        await getChatMessages();

      res.json({
        success: true,
        messages
      });

    } catch (error) {
      console.error(
        "Chat GET:",
        error
      );

      res.json({
        success: true,
        messages: []
      });
    }
  }
);

// Compatibility route for older frontend
app.get(
  "/chat",
  async (req, res) => {
    try {
      const messages =
        await getChatMessages();

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
          settings.onlineCount ?? 37,

        messages
      });

    } catch (error) {
      console.error(
        "Chat compatibility GET:",
        error
      );

      res.json({
        success: true,
        online: 37,
        messages: []
      });
    }
  }
);

// =====================================================
// CHAT POST
// =====================================================

async function sendChatMessage(
  req,
  res
) {
  try {
    const robloxId =
      Number(
        req.body?.robloxId ||
        req.body?.userId
      );

    const username =
      String(
        req.body?.username || ""
      ).trim();

    const avatar =
      String(
        req.body?.avatar || ""
      );

    const message =
      String(
        req.body?.message || ""
      )
        .replace(/[<>]/g, "")
        .trim();

    if (
      !Number.isSafeInteger(
        robloxId
      ) ||
      !username ||
      !message
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Sign in to chat"
      });
    }

    if (message.length > 300) {
      return res.status(400).json({
        success: false,
        message:
          "Message is too long"
      });
    }

    if (containsLink(message)) {
      return res.status(400).json({
        success: false,
        message:
          "Links are not allowed"
      });
    }

    const user =
      await User.findOne({
        robloxId
      }).lean();

    if (!user) {
      return res.status(403).json({
        success: false,
        message:
          "Verify your Roblox account first"
      });
    }

    const doc =
      await ChatMessage.create({
        username:
          user.username ||
          username,

        robloxId,

        avatar:
          user.avatar ||
          avatar,

        message,

        type: "message"
      });

    res.json({
      success: true,
      message: doc
    });

  } catch (error) {
    console.error(
      "Chat POST:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Could not send message"
    });
  }
}

app.post(
  "/chat/messages",
  sendChatMessage
);

// Compatibility route
app.post(
  "/chat",
  sendChatMessage
);

// =====================================================
// COINFLIPS GET
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
          flips.map((flip) => ({
            id:
              flip._id,

            _id:
              flip._id,

            userId:
              flip.creatorId,

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

            petVariant:
              flip.petVariant || "",

            side:
              flip.side,

            image:
              petImage(
                flip.petName
              )
          }))
      });

    } catch (error) {
      console.error(
        "Coinflip GET:",
        error
      );

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
      const robloxId =
        Number(
          req.body?.robloxId ||
          req.body?.userId
        );

      const itemId =
        req.body?.itemId;

      let side =
        String(
          req.body?.side || ""
        ).toLowerCase();

      if (side === "h") {
        side = "heads";
      }

      if (side === "t") {
        side = "tails";
      }

      if (
        !Number.isSafeInteger(
          robloxId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user"
        });
      }

      if (
        !mongoose.isValidObjectId(
          itemId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid inventory item"
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
          robloxId
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

      const locked =
        await User.findOneAndUpdate(
          {
            robloxId,

            "inventory._id":
              itemId
          },

          {
            $pull: {
              inventory: {
                _id: itemId
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
            "That pet is already being used"
        });
      }

      const flip =
        await Coinflip.create({
          creatorId:
            robloxId,

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
// JOIN COINFLIP
// =====================================================

app.post(
  "/coinflips/:id/join",
  async (req, res) => {
    try {
      const flipId =
        req.params.id;

      const robloxId =
        Number(
          req.body?.robloxId ||
          req.body?.userId
        );

      if (
        !mongoose.isValidObjectId(
          flipId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid coinflip"
        });
      }

      if (
        !Number.isSafeInteger(
          robloxId
        )
      ) {
        return res.status(400).json({
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
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const flip =
        await Coinflip.findOne({
          _id: flipId,
          status: "active"
        });

      if (!flip) {
        return res.status(409).json({
          success: false,
          message:
            "Coinflip is no longer available"
        });
      }

      if (
        flip.creatorId ===
        robloxId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot join your own coinflip"
        });
      }

      /*
       * Find a matching inventory item.
       * The joiner must have a pet available.
       */
      const item =
        user.inventory.find(
          (x) =>
            Number(x.value) ===
            Number(flip.petValue)
        );

      if (!item) {
        return res.status(400).json({
          success: false,
          message:
            "You need a pet of matching value to join"
        });
      }

      const locked =
        await User.findOneAndUpdate(
          {
            robloxId,

            "inventory._id":
              item._id
          },

          {
            $pull: {
              inventory: {
                _id: item._id
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
            "That pet is no longer available"
        });
      }

      const result =
        Math.random() < 0.5
          ? "heads"
          : "tails";

      const creatorWon =
        result === flip.side;

      const winnerId =
        creatorWon
          ? flip.creatorId
          : robloxId;

      flip.joinerId =
        robloxId;

      flip.joinerUsername =
        user.username;

      flip.joinerAvatar =
        user.avatar;

      flip.winnerId =
        winnerId;

      flip.status =
        "completed";

      flip.completedAt =
        new Date();

      await flip.save();

      /*
       * For now, return both pets to
       * the winner's deposited inventory.
       */
      const winner =
        await User.findOne({
          robloxId:
            winnerId
        });

      if (winner) {
        winner.inventory.push(
          {
            name:
              flip.petName,

            value:
              flip.petValue,

            variant:
              flip.petVariant || ""
          }
        );

        winner.inventory.push(
          {
            name:
              item.name,

            value:
              item.value,

            variant:
              item.variant || ""
          }
        );

        winner.wagered =
          Number(
            winner.wagered || 0
          ) +
          Number(
            flip.petValue || 0
          );

        await winner.save();
      }

      res.json({
        success: true,

        result,

        winnerId,

        message:
          "Coinflip completed"
      });

    } catch (error) {
      console.error(
        "Join coinflip:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not join coinflip"
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

      const formatted =
        users.map(
          (user, index) => ({
            place:
              index + 1,

            username:
              user.username,

            avatar:
              user.avatar || "",

            wagered:
              user.wagered || 0,

            profit:
              user.profit || 0
          })
        );

      /*
       * Return both names so old/new
       * frontend versions work.
       */
      res.json({
        success: true,

        users:
          formatted,

        players:
          formatted
      });

    } catch (error) {
      console.error(
        "Leaderboard:",
        error
      );

      res.json({
        success: true,
        users: [],
        players: []
      });
    }
  }
);

// =====================================================
// OPTIONAL TELEGRAM MODULE
// =====================================================

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

// =====================================================
// START SERVER
// =====================================================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ADMFLIP backend running on port ${PORT}`
    );
  }
);
