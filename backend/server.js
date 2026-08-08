const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const frontendPath = path.resolve(__dirname, "..", "frontend");
const valuesPath = path.resolve(__dirname, "values.txt");

console.log("=================================");
console.log("ADMFLIP SERVER STARTING");
console.log("Frontend:", frontendPath);
console.log("Values:", valuesPath);
console.log("=================================");

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100kb"
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* =========================================================
   DATABASE
========================================================= */

if (!process.env.MONGO_URL) {
  console.error("WARNING: MONGO_URL is missing");
}

let mongoReady = false;

if (process.env.MONGO_URL) {
  mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
      mongoReady = true;
      console.log("MongoDB connected");
    })
    .catch((error) => {
      console.error("MongoDB error:", error.message);
    });
}

/* =========================================================
   MODELS
========================================================= */

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

const User =
  mongoose.models.User ||
  mongoose.model(
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
    )
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

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model(
    "ChatMessage",
    new mongoose.Schema({
      username: {
        type: String,
        default: "User"
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

const Coinflip =
  mongoose.models.Coinflip ||
  mongoose.model(
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

      createdAt: {
        type: Date,
        default: Date.now
      },

      completedAt: Date
    })
  );

/* =========================================================
   PET VALUES
========================================================= */

function loadPets() {
  try {
    if (!fs.existsSync(valuesPath)) {
      console.error("values.txt was not found:", valuesPath);
      return [];
    }

    const text = fs.readFileSync(valuesPath, "utf8");

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

    console.log("Loaded pets:", result.length);

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
    encodeURIComponent(name) +
    ".webp"
  );
}

/* =========================================================
   ROBLOX API
========================================================= */

async function getRobloxUser(username) {
  const cleanUsername = String(username || "").trim();

  if (!cleanUsername) {
    return null;
  }

  const response = await fetch(
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        usernames: [cleanUsername],
        excludeBannedUsers: false
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Roblox users API returned ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.data || !data.data.length) {
    return null;
  }

  return data.data[0];
}

async function getRobloxProfile(id) {
  const response = await fetch(
    `https://users.roblox.com/v1/users/${id}`
  );

  if (!response.ok) {
    throw new Error(
      `Roblox profile API returned ${response.status}`
    );
  }

  return response.json();
}

async function getAvatar(id) {
  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    return data.data?.[0]?.imageUrl || "";
  } catch {
    return "";
  }
}

/* =========================================================
   HEALTH / STATUS
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    success: true,
    online: true,
    mongo: mongoReady,
    server: "ADMFLIP"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    online: true,
    mongo: mongoReady,
    server: "ADMFLIP"
  });
});

/* =========================================================
   STATUS
========================================================= */

async function statusHandler(req, res) {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        siteOnline: true,
        onlineCount: 0
      });
    }

    const active = await Coinflip.countDocuments({
      status: "active"
    });

    const activeFlips = await Coinflip.find({
      status: "active"
    })
      .select("petValue")
      .lean();

    const totalValue = activeFlips.reduce(
      (sum, flip) =>
        sum + (Number(flip.petValue) || 0),
      0
    );

    res.json({
      success: true,
      online: settings.siteOnline,
      announcement: settings.announcement,
      activeCoinflips: active,
      totalCoinflipValue: totalValue
    });
  } catch (error) {
    console.error(
      "Status error:",
      error.message
    );

    res.json({
      success: true,
      online: true,
      announcement: "",
      activeCoinflips: 0,
      totalCoinflipValue: 0
    });
  }
}

app.get("/status", statusHandler);
app.get("/api/status", statusHandler);

/* =========================================================
   ONLINE
========================================================= */

async function onlineHandler(req, res) {
  try {
    const settings = await Settings.findOne();

    res.json({
      success: true,
      online: settings?.onlineCount || 0
    });
  } catch {
    res.json({
      success: true,
      online: 0
    });
  }
}

app.get("/chat/online", onlineHandler);
app.get("/api/chat/online", onlineHandler);

/* =========================================================
   PETS
========================================================= */

function petsHandler(req, res) {
  res.json({
    success: true,

    pets: pets.map((pet) => ({
      id: pet.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),

      name: pet.name,

      value: pet.value,

      image: petImage(pet.name)
    }))
  });
}

app.get("/pets", petsHandler);
app.get("/api/pets", petsHandler);

/* =========================================================
   ROBLOX USER LOOKUP
========================================================= */

async function userHandler(req, res) {
  try {
    const username = String(
      req.params.username || ""
    ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username required"
      });
    }

    const robloxUser =
      await getRobloxUser(username);

    if (!robloxUser) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const avatar =
      await getAvatar(robloxUser.id);

    if (mongoReady) {
      await User.findOneAndUpdate(
        {
          robloxId: robloxUser.id
        },

        {
          $set: {
            username: robloxUser.name,
            avatar
          },

          $setOnInsert: {
            robloxId: robloxUser.id
          }
        },

        {
          upsert: true,
          new: true
        }
      );
    }

    return res.json({
      success: true,

      user: {
        id: robloxUser.id,
        username: robloxUser.name,
        avatar
      }
    });
  } catch (error) {
    console.error(
      "User lookup:",
      error.message
    );

    return res.status(502).json({
      success: false,
      message: "Roblox could not be reached"
    });
  }
}

app.get(
  "/user/:username",
  userHandler
);

app.get(
  "/api/user/:username",
  userHandler
);

/* =========================================================
   VERIFICATION PHRASE
========================================================= */

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
        Math.random() * words.length
      )
    ] +
    "-" +
    Math.floor(
      1000 + Math.random() * 9000
    )
  );
}

function createHandler(req, res) {
  res.json({
    success: true,
    phrase: generatePhrase()
  });
}

app.get("/create", createHandler);
app.post("/create", createHandler);

app.get("/api/create", createHandler);
app.post("/api/create", createHandler);

/* =========================================================
   ROBLOX BIO VERIFICATION
========================================================= */

async function checkHandler(req, res) {
  try {
    const username = String(
      req.body?.username || ""
    ).trim();

    const phrase = String(
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
      await getRobloxUser(username);

    if (!robloxUser) {
      return res.json({
        success: false,
        message:
          "Roblox username not found"
      });
    }

    const profile =
      await getRobloxProfile(
        robloxUser.id
      );

    const description = String(
      profile.description || ""
    );

    if (
      !description
        .toLowerCase()
        .includes(
          phrase.toLowerCase()
        )
    ) {
      return res.json({
        success: false,
        message:
          "Verification phrase not found in Roblox bio"
      });
    }

    const avatar =
      await getAvatar(
        robloxUser.id
      );

    if (mongoReady) {
      await User.findOneAndUpdate(
        {
          robloxId: robloxUser.id
        },

        {
          $set: {
            username: profile.name,
            avatar
          },

          $setOnInsert: {
            robloxId: robloxUser.id
          }
        },

        {
          upsert: true,
          new: true
        }
      );
    }

    return res.json({
      success: true,

      username: profile.name,

      id: robloxUser.id,

      avatar
    });
  } catch (error) {
    console.error(
      "Verification:",
      error.message
    );

    return res.status(502).json({
      success: false,
      message:
        "Verification failed"
    });
  }
}

app.post("/check", checkHandler);
app.post("/api/check", checkHandler);

/* =========================================================
   ACCOUNT
========================================================= */

async function accountHandler(req, res) {
  try {
    const id = Number(
      req.params.robloxId
    );

    if (!Number.isSafeInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user"
      });
    }

    if (!mongoReady) {
      return res.status(503).json({
        success: false,
        message:
          "Database is currently unavailable"
      });
    }

    const user =
      await User.findOne({
        robloxId: id
      }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,

      user: {
        id: user.robloxId,

        username: user.username,

        avatar: user.avatar,

        balance: user.balance || 0,

        wagered: user.wagered || 0,

        profit: user.profit || 0,

        inventory: (
          user.inventory || []
        ).map((item) => ({
          itemId: item._id,
          name: item.name,
          value: item.value,
          variant: item.variant || "",
          image: petImage(item.name)
        }))
      }
    });
  } catch (error) {
    console.error(
      "Account:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not load account"
    });
  }
}

app.get(
  "/account/:robloxId",
  accountHandler
);

app.get(
  "/api/account/:robloxId",
  accountHandler
);

/* =========================================================
   CHAT
========================================================= */

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg|discord\.com\/invite|(?:[a-z0-9-]+\.)+(?:com|net|gg|org)\b)/i.test(
    text
  );
}

async function chatMessagesHandler(req, res) {
  try {
    if (!mongoReady) {
      return res.json({
        success: true,
        messages: []
      });
    }

    const messages =
      await ChatMessage.find()
        .sort({
          pinned: -1,
          createdAt: -1
        })
        .limit(100)
        .lean();

    return res.json({
      success: true,
      messages: messages.reverse()
    });
  } catch (error) {
    console.error(
      "Chat messages:",
      error.message
    );

    return res.json({
      success: true,
      messages: []
    });
  }
}

app.get(
  "/chat/messages",
  chatMessagesHandler
);

app.get(
  "/api/chat/messages",
  chatMessagesHandler
);

async function sendChatHandler(req, res) {
  try {
    const robloxId = Number(
      req.body?.robloxId ??
      req.body?.userId
    );

    const username = String(
      req.body?.username || ""
    ).trim();

    const avatar = String(
      req.body?.avatar || ""
    );

    const message = String(
      req.body?.message || ""
    );

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

    const clean = message
      .replace(/[<>]/g, "")
      .trim();

    if (!clean) {
      return res.status(400).json({
        success: false,
        message: "Message is empty"
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

    if (!mongoReady) {
      return res.status(503).json({
        success: false,
        message:
          "Chat database unavailable"
      });
    }

    const messageDoc =
      await ChatMessage.create({
        username,
        robloxId,
        avatar,
        message: clean,
        type: "message",
        pinned: false
      });

    return res.json({
      success: true,
      message: messageDoc
    });
  } catch (error) {
    console.error(
      "Send chat:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not send message"
    });
  }
}

app.post(
  "/chat/messages",
  sendChatHandler
);

app.post(
  "/api/chat/messages",
  sendChatHandler
);

/* =========================================================
   COINFLIPS
========================================================= */

async function coinflipsHandler(req, res) {
  try {
    if (!mongoReady) {
      return res.json({
        success: true,
        coinflips: []
      });
    }

    const flips =
      await Coinflip.find({
        status: "active"
      })
        .sort({
          createdAt: -1
        })
        .limit(50)
        .lean();

    return res.json({
      success: true,

      coinflips: flips.map(
        (flip) => ({
          id: flip._id,

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
        })
      )
    });
  } catch (error) {
    console.error(
      "Coinflips:",
      error.message
    );

    return res.json({
      success: true,
      coinflips: []
    });
  }
}

app.get(
  "/coinflips",
  coinflipsHandler
);

app.get(
  "/api/coinflips",
  coinflipsHandler
);

async function createCoinflipHandler(
  req,
  res
) {
  try {
    const userId = Number(
      req.body?.robloxId ??
      req.body?.userId
    );

    const itemId =
      req.body?.itemId ||
      req.body?.pet?.itemId ||
      req.body?.pet?._id ||
      null;

    const normalizedSide =
      String(
        req.body?.side || ""
      ).toLowerCase();

    if (
      !Number.isSafeInteger(
        userId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Roblox user"
      });
    }

    if (
      !["heads", "tails"].includes(
        normalizedSide
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid side"
      });
    }

    if (!mongoReady) {
      return res.status(503).json({
        success: false,
        message:
          "Database unavailable"
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

    let itemIndex = -1;

    if (
      itemId &&
      mongoose.isValidObjectId(
        itemId
      )
    ) {
      itemIndex =
        user.inventory.findIndex(
          (item) =>
            String(item._id) ===
            String(itemId)
        );
    }

    if (itemIndex === -1) {
      const requestedName =
        String(
          req.body?.petName ||
          req.body?.pet?.name ||
          ""
        )
          .trim()
          .toLowerCase();

      if (requestedName) {
        itemIndex =
          user.inventory.findIndex(
            (item) =>
              String(
                item.name || ""
              )
                .trim()
                .toLowerCase() ===
              requestedName
          );
      }
    }

    if (itemIndex === -1) {
      return res.status(409).json({
        success: false,
        message:
          "That pet is not in your inventory."
      });
    }

    const item =
      user.inventory[itemIndex];

    const flip =
      await Coinflip.create({
        creatorId:
          user.robloxId,

        creatorUsername:
          user.username,

        creatorAvatar:
          user.avatar || "",

        itemId:
          item._id,

        petName:
          item.name,

        petValue:
          Number(item.value) || 0,

        petVariant:
          item.variant || "",

        side:
          normalizedSide,

        status: "active"
      });

    user.inventory.splice(
      itemIndex,
      1
    );

    user.wagered =
      Number(
        user.wagered || 0
      ) +
      (Number(item.value) || 0);

    await user.save();

    return res.json({
      success: true,

      coinflip: {
        id: flip._id,

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
      }
    });
  } catch (error) {
    console.error(
      "Create coinflip:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not create coinflip"
    });
  }
}

app.post(
  "/coinflips",
  createCoinflipHandler
);

app.post(
  "/api/coinflips",
  createCoinflipHandler
);

/* =========================================================
   LEADERBOARD
========================================================= */

async function leaderboardHandler(
  req,
  res
) {
  try {
    if (!mongoReady) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users =
      await User.find()
        .sort({
          wagered: -1
        })
        .limit(10)
        .lean();

    return res.json({
      success: true,

      users: users.map(
        (user, index) => ({
          place: index + 1,

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
  } catch (error) {
    console.error(
      "Leaderboard:",
      error.message
    );

    return res.json({
      success: true,
      users: []
    });
  }
}

app.get(
  "/leaderboard",
  leaderboardHandler
);

app.get(
  "/api/leaderboard",
  leaderboardHandler
);

/* =========================================================
   TELEGRAM
========================================================= */

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

/* =========================================================
   STATIC FRONTEND
========================================================= */

if (fs.existsSync(frontendPath)) {
  app.use(
    express.static(frontendPath)
  );

  console.log(
    "Frontend directory found"
  );
} else {
  console.error(
    "WARNING: frontend directory does not exist:",
    frontendPath
  );
}

/* =========================================================
   API 404
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message:
      "API endpoint not found",
    path: req.originalUrl
  });
});

/* =========================================================
   FRONTEND FALLBACK
========================================================= */

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/user/") ||
    req.path.startsWith("/account/")
  ) {
    return next();
  }

  const indexPath =
    path.join(
      frontendPath,
      "index.html"
    );

  if (!fs.existsSync(indexPath)) {
    return res.status(500).send(
      "Frontend index.html not found"
    );
  }

  return res.sendFile(indexPath);
});

/* =========================================================
   FINAL 404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Not found",
    path: req.originalUrl
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      message:
        "Internal server error"
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================="
    );

    console.log(
      `ADMFLIP running on port ${PORT}`
    );

    console.log(
      "API routes support /api/* and /*"
    );

    console.log(
      "================================="
    );
  }
);
