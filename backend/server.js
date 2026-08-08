const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const frontendPath = path.join(__dirname, "..", "frontend");
const valuesPath = path.join(__dirname, "values.txt");

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "100kb" }));

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
  console.warn("MONGO_URL is missing");
} else {
  mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
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
      console.warn("values.txt not found:", valuesPath);
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

      if (!name || !raw) continue;

      const value = Number(
        raw.replace(/[^\d.-]/g, "")
      );

      if (!Number.isFinite(value)) continue;

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
  if (!name) return "";

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp"
  );
}

/* =========================================================
   ROBLOX API
   IMPORTANT:
   Browser NEVER contacts Roblox directly.
   Render server does it.
========================================================= */

async function robloxRequest(url, options = {}) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(url, {
      ...options,

      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ADMFLIP/1.0",
        ...(options.headers || {})
      },

      signal: controller.signal
    });

    clearTimeout(timeout);

    return response;
  } catch (error) {
    console.error(
      "Roblox request failed:",
      error.message
    );

    throw error;
  }
}

async function getRobloxUser(username) {
  const cleanUsername = String(
    username || ""
  ).trim();

  if (!cleanUsername) {
    return null;
  }

  const response = await robloxRequest(
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",

      body: JSON.stringify({
        usernames: [cleanUsername],
        excludeBannedUsers: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Roblox username API returned ${response.status}`
    );
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.data) ||
    data.data.length === 0
  ) {
    return null;
  }

  return data.data[0];
}

async function getRobloxProfile(id) {
  const response = await robloxRequest(
    `https://users.roblox.com/v1/users/${encodeURIComponent(id)}`
  );

  if (!response.ok) {
    throw new Error(
      `Roblox profile API returned ${response.status}`
    );
  }

  return await response.json();
}

async function getAvatar(id) {
  try {
    const response = await robloxRequest(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(
        id
      )}&size=150x150&format=Png`
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    return data?.data?.[0]?.imageUrl || "";
  } catch {
    return "";
  }
}

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

    const activeFlips = await Coinflip
      .find({ status: "active" })
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

    console.log(
      "Roblox lookup:",
      username
    );

    const robloxUser =
      await getRobloxUser(username);

    if (!robloxUser) {
      return res.status(404).json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const avatar =
      await getAvatar(robloxUser.id);

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
      "Roblox user lookup error:",
      error
    );

    return res.status(502).json({
      success: false,

      message:
        "The server could not reach Roblox. Try again in a few seconds."
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

function phraseHandler(req, res) {
  res.json({
    success: true,
    phrase: generatePhrase()
  });
}

app.get("/create", phraseHandler);
app.post("/create", phraseHandler);

app.get("/api/create", phraseHandler);
app.post("/api/create", phraseHandler);

/* =========================================================
   VERIFY ROBLOX BIO
========================================================= */

async function checkHandler(req, res) {
  try {
    const username = String(
      req.body.username || ""
    ).trim();

    const phrase = String(
      req.body.phrase || ""
    ).trim();

    if (!username || !phrase) {
      return res.status(400).json({
        success: false,
        message:
          "Username and phrase required"
      });
    }

    console.log(
      "Checking Roblox bio:",
      username,
      phrase
    );

    const robloxUser =
      await getRobloxUser(username);

    if (!robloxUser) {
      return res.status(404).json({
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
          "Verification phrase not found in your Roblox bio."
      });
    }

    const avatar =
      await getAvatar(
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
            profile.name ||
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

    return res.json({
      success: true,

      username:
        profile.name ||
        robloxUser.name,

      id:
        robloxUser.id,

      avatar
    });
  } catch (error) {
    console.error(
      "Roblox verification error:",
      error
    );

    return res.status(502).json({
      success: false,

      message:
        "The server could not reach Roblox right now."
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

        balance:
          user.balance || 0,

        wagered:
          user.wagered || 0,

        profit:
          user.profit || 0,

        inventory:
          (user.inventory || []).map(
            (item) => ({
              itemId: item._id,
              name: item.name,
              value: item.value,
              variant:
                item.variant || "",
              image:
                petImage(item.name)
            })
          )
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
  return /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(
    text
  );
}

async function chatMessagesHandler(req, res) {
  try {
    const messages =
      await ChatMessage
        .find()
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
      req.body.robloxId ??
      req.body.userId
    );

    const username = String(
      req.body.username || ""
    ).trim();

    const avatar = String(
      req.body.avatar || ""
    );

    const message = String(
      req.body.message || ""
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
    const flips =
      await Coinflip
        .find({
          status: "active"
        })
        .sort({
          createdAt: -1
        })
        .limit(50)
        .lean();

    return res.json({
      success: true,

      coinflips:
        flips.map((flip) => ({
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
        }))
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

/* =========================================================
   LEADERBOARD
========================================================= */

async function leaderboardHandler(req, res) {
  try {
    const users =
      await User
        .find()
        .sort({
          wagered: -1
        })
        .limit(10)
        .lean();

    return res.json({
      success: true,

      users:
        users.map(
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
   FRONTEND
========================================================= */

if (fs.existsSync(frontendPath)) {
  app.use(
    express.static(frontendPath)
  );

  app.get(
    "/*splat",
    (req, res) => {
      if (
        req.path.startsWith("/api/")
      ) {
        return res.status(404).json({
          success: false,
          message:
            "API endpoint not found"
        });
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

      return res.sendFile(
        indexPath
      );
    }
  );
} else {
  console.warn(
    "Frontend directory not found:",
    frontendPath
  );

  app.get(
    "/",
    (req, res) => {
      res.status(500).send(
        "Frontend index.html not found"
      );
    }
  );
}

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ADMFLIP running on port ${PORT}`
    );

    console.log(
      "Frontend:",
      frontendPath
    );

    console.log(
      "Roblox verification:",
      "SERVER SIDE"
    );
  }
);
