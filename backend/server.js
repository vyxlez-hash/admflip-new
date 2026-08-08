const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

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
  max: 150,
  standardHeaders: true,
  legacyHeaders: false
}));

// =====================================================
// CONFIG
// =====================================================

const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("ERROR: MONGO_URL is missing");
}

// =====================================================
// MONGODB
// =====================================================

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB error:", error.message);
  });

// =====================================================
// USER
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

const userSchema = new mongoose.Schema(
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

    avatar: {
      type: String,
      default: ""
    },

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
);

const User = mongoose.model("User", userSchema);

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

const coinflipSchema = new mongoose.Schema({
  creatorId: Number,

  creatorUsername: String,

  creatorAvatar: String,

  itemId: mongoose.Schema.Types.ObjectId,

  petName: String,

  petValue: Number,

  petVariant: String,

  side: {
    type: String,
    enum: ["heads", "tails"]
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

  result: String,

  createdAt: {
    type: Date,
    default: Date.now
  },

  completedAt: Date
});

const Coinflip = mongoose.model(
  "Coinflip",
  coinflipSchema
);

// =====================================================
// VALUES
// =====================================================

function loadPets() {
  try {
    const valuesPath = path.join(
      __dirname,
      "values.txt"
    );

    const text = fs.readFileSync(
      valuesPath,
      "utf8"
    );

    const lines = text
      .split(/\r?\n/)
      .map(x => x.trim())
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

// =====================================================
// PET IMAGE
// =====================================================

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
// HELPERS
// =====================================================

function normalizeSide(side) {
  if (!side) {
    return null;
  }

  const value =
    String(side)
      .trim()
      .toLowerCase();

  if (
    value === "h" ||
    value === "heads"
  ) {
    return "heads";
  }

  if (
    value === "t" ||
    value === "tails"
  ) {
    return "tails";
  }

  return null;
}

function userIdFromBody(body) {
  const raw =
    body.userId ??
    body.robloxId;

  const id = Number(raw);

  if (!Number.isSafeInteger(id)) {
    return null;
  }

  return id;
}

function serializeInventoryItem(item) {
  return {
    id: item._id,
    itemId: item._id,
    name: item.name,
    value: item.value,
    variant: item.variant || "",
    image: petImage(item.name)
  };
}

function serializeCoinflip(flip) {
  return {
    id: flip._id,

    _id: flip._id,

    userId: flip.creatorId,

    username: flip.creatorUsername,

    avatar: flip.creatorAvatar,

    petName: flip.petName,

    petValue: flip.petValue,

    variant: flip.petVariant || "",

    petVariant: flip.petVariant || "",

    side: flip.side,

    image: petImage(flip.petName),

    status: flip.status,

    joinerId: flip.joinerId || null,

    joinerUsername:
      flip.joinerUsername || null,

    joinerAvatar:
      flip.joinerAvatar || null
  };
}

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg|discord\.com\/invite|\.com\b|\.net\b|\.gg\b|\.org\b)/i
    .test(text);
}

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ADMFLIP backend is online"
  });
});

// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "connecting"
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
        settings.announcement
    });

  } catch (error) {
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

app.get("/pets", (req, res) => {
  res.json({
    success: true,

    pets: pets.map((pet) => ({
      id:
        pet.name
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
        return res.status(502).json({
          success: false,
          message:
            "Roblox lookup failed"
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
            "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
            `?userIds=${robloxUser.id}` +
            "&size=150x150" +
            "&format=Png"
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
      console.error(
        "Roblox lookup:",
        error.message
      );

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
    success: true,
    phrase: generatePhrase()
  });
});

// =====================================================
// VERIFY ROBLOX BIO
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

      const description =
        String(
          profile.description || ""
        );

      if (
        !description.includes(
          String(phrase)
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
            "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
            `?userIds=${id}` +
            "&size=150x150" +
            "&format=Png"
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
      console.error(
        "Verification:",
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

      if (!Number.isSafeInteger(id)) {
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
          id: user.robloxId,

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
              .map(
                serializeInventoryItem
              )
        }
      });

    } catch (error) {
      console.error(
        "Account:",
        error.message
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

      if (!Number.isSafeInteger(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user"
        });
      }

      const user =
        await User.findOne({
          robloxId: id
        });

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
          user.inventory.map(
            serializeInventoryItem
          )
      });

    } catch (error) {
      console.error(
        "Inventory:",
        error.message
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
// CHAT GET
// Supports both /chat and /chat/messages
// =====================================================

async function getChat(req, res) {
  try {
    const messages =
      await ChatMessage.find()
        .sort({
          createdAt: -1
        })
        .limit(100)
        .lean();

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

      messages:
        messages.reverse()
    });

  } catch (error) {
    console.error(
      "Chat:",
      error.message
    );

    res.json({
      success: true,
      online: 37,
      messages: []
    });
  }
}

app.get("/chat", getChat);

app.get(
  "/chat/messages",
  getChat
);

// =====================================================
// CHAT POST
// Supports both /chat and /chat/messages
// =====================================================

async function postChat(req, res) {
  try {
    const {
      robloxId,
      userId,
      username,
      avatar,
      message
    } = req.body;

    const id =
      Number(
        robloxId ?? userId
      );

    if (
      !Number.isSafeInteger(id) ||
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
        .replace(/[<>]/g, "")
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
        username:
          String(username).slice(0, 30),

        robloxId: id,

        avatar:
          String(avatar || ""),

        message: clean,

        type: "message"
      });

    res.json({
      success: true,
      message: messageDoc
    });

  } catch (error) {
    console.error(
      "Send chat:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Could not send message"
    });
  }
}

app.post(
  "/chat",
  postChat
);

app.post(
  "/chat/messages",
  postChat
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
          flips.map(
            serializeCoinflip
          )
      });

    } catch (error) {
      console.error(
        "Coinflips:",
        error.message
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
      const {
        itemId,
        petId,
        side
      } = req.body;

      const userId =
        userIdFromBody(
          req.body
        );

      const actualItemId =
        itemId || petId;

      const actualSide =
        normalizeSide(side);

      if (
        !userId ||
        !mongoose.isValidObjectId(
          actualItemId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid request"
        });
      }

      if (!actualSide) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid side"
        });
      }

      const user =
        await User.findOne({
          robloxId: userId
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
          actualItemId
        );

      if (!item) {
        return res.status(400).json({
          success: false,
          message:
            "Pet is not in your inventory"
        });
      }

      // Remove the exact item from
      // the user's inventory.
      const locked =
        await User.findOneAndUpdate(
          {
            robloxId: userId,

            "inventory._id":
              actualItemId
          },

          {
            $pull: {
              inventory: {
                _id:
                  actualItemId
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
            userId,

          creatorUsername:
            user.username,

          creatorAvatar:
            user.avatar,

          itemId:
            actualItemId,

          petName:
            item.name,

          petValue:
            item.value,

          petVariant:
            item.variant || "",

          side:
            actualSide,

          status:
            "active"
        });

      res.json({
        success: true,

        coinflip:
          serializeCoinflip(
            flip
          )
      });

    } catch (error) {
      console.error(
        "Create coinflip:",
        error.message
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
      const userId =
        userIdFromBody(
          req.body
        );

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user"
        });
      }

      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid coinflip"
        });
      }

      const user =
        await User.findOne({
          robloxId: userId
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
          _id:
            req.params.id,

          status:
            "active"
        });

      if (!flip) {
        return res.status(404).json({
          success: false,
          message:
            "Coinflip is no longer active"
        });
      }

      if (
        flip.creatorId === userId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot join your own coinflip"
        });
      }

      if (!user.inventory.length) {
        return res.status(400).json({
          success: false,
          message:
            "You need a pet to join"
        });
      }

      // Take the first inventory item
      // for this simple version.
      const item =
        user.inventory[0];

      const locked =
        await User.findOneAndUpdate(
          {
            robloxId:
              userId,

            "inventory._id":
              item._id
          },

          {
            $pull: {
              inventory: {
                _id:
                  item._id
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

      const result =
        Math.random() < 0.5
          ? "heads"
          : "tails";

      const creatorWon =
        result === flip.side;

      const winnerId =
        creatorWon
          ? flip.creatorId
          : userId;

      flip.joinerId =
        userId;

      flip.joinerUsername =
        user.username;

      flip.joinerAvatar =
        user.avatar;

      flip.winnerId =
        winnerId;

      flip.result =
        result;

      flip.status =
        "completed";

      flip.completedAt =
        new Date();

      await flip.save();

      const creator =
        await User.findOne({
          robloxId:
            flip.creatorId
        });

      if (creator) {
        creator.wagered +=
          Number(
            flip.petValue || 0
          );

        await creator.save();
      }

      user.wagered +=
        Number(
          item.value || 0
        );

      await user.save();

      res.json({
        success: true,

        result,

        winnerId,

        coinflip:
          serializeCoinflip(
            flip
          )
      });

    } catch (error) {
      console.error(
        "Join coinflip:",
        error.message
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

      const players =
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
        );

      res.json({
        success: true,

        // New frontend
        players,

        // Compatibility
        users: players
      });

    } catch (error) {
      console.error(
        "Leaderboard:",
        error.message
      );

      res.json({
        success: true,
        players: [],
        users: []
      });
    }
  }
);

// =====================================================
// SERVE FRONTEND IF PRESENT
// =====================================================

const frontendPath =
  path.join(
    __dirname,
    "../frontend"
  );

if (
  fs.existsSync(
    frontendPath
  )
) {
  app.use(
    express.static(
      frontendPath
    )
  );

  console.log(
    "Frontend directory detected:",
    frontendPath
  );
}

// =====================================================
// 404
// =====================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "Endpoint not found"
    });
  }
);

// =====================================================
// START
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ADMFLIP backend running on port ${PORT}`
    );
  }
);
