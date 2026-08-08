const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

// =====================================================
// PATHS
// =====================================================

const frontendPath = path.join(__dirname, "..", "frontend");

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
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
// FRONTEND
// =====================================================

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

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

// =====================================================
// SETTINGS
// =====================================================

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
        default: 37
      }
    })
  );

// =====================================================
// CHAT
// =====================================================

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model(
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

// =====================================================
// PET VALUES
// =====================================================
//
// Your frontend can still use /pets.
// If you do not want values.txt on the backend,
// replace this array with your own database later.
//
// For now this safely loads values.txt if it exists.
// =====================================================

function loadPets() {
  const valuesPath = path.join(__dirname, "values.txt");

  if (!fs.existsSync(valuesPath)) {
    console.log("values.txt not found. /pets will return an empty list.");
    return [];
  }

  try {
    const text = fs.readFileSync(valuesPath, "utf8");

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
// ROBLOX API HELPERS
// =====================================================
//
// IMPORTANT:
// The browser should NOT call Roblox directly.
// Your server calls Roblox instead.
// This fixes the browser "Failed to fetch" problem.
// =====================================================

async function robloxRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    console.error(
      "Roblox network error:",
      error.message
    );

    throw new Error(
      "Could not connect to Roblox."
    );
  }

  const text = await response.text();

  let data = null;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error(
      "Roblox API error:",
      response.status,
      text
    );

    throw new Error(
      `Roblox API returned ${response.status}.`
    );
  }

  return data;
}

// =====================================================
// ROBLOX USERNAME LOOKUP
// =====================================================

async function findRobloxUser(username) {
  const clean = String(username || "").trim();

  if (!clean) {
    throw new Error(
      "Username required."
    );
  }

  // Server-side POST.
  // This avoids browser CORS/preflight problems.

  const data = await robloxRequest(
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        usernames: [clean],
        excludeBannedUsers: true
      })
    }
  );

  const users =
    Array.isArray(data?.data)
      ? data.data
      : [];

  if (!users.length) {
    return null;
  }

  const exact =
    users.find(
      user =>
        String(user.name || "")
          .toLowerCase() ===
        clean.toLowerCase()
    );

  return exact || users[0];
}

// =====================================================
// ROBLOX PROFILE
// =====================================================

async function getRobloxProfile(id) {
  if (!id) {
    throw new Error(
      "Roblox ID required."
    );
  }

  return await robloxRequest(
    `https://users.roblox.com/v1/users/${encodeURIComponent(id)}`
  );
}

// =====================================================
// ROBLOX AVATAR
// =====================================================

async function getRobloxAvatar(id) {
  if (!id) {
    return "";
  }

  try {
    const data = await robloxRequest(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(id)}&size=150x150&format=Png`
    );

    return (
      data?.data?.[0]?.imageUrl ||
      ""
    );
  } catch {
    return "";
  }
}

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  const indexPath =
    path.join(
      frontendPath,
      "index.html"
    );

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send(
      "ADMFLIP frontend not found."
    );
  }

  res.sendFile(indexPath);
});

// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "ADMFLIP",
    status: "online",
    time: new Date().toISOString()
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

      online:
        settings.siteOnline,

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
// SITE STATS
// =====================================================
//
// ACTIVE COINFLIPS
// TOTAL VALUE currently being coinflipped
// COINFLIPPING NOW
//
// These values are recalculated every request.
// =====================================================

app.get(
  "/stats",
  async (req, res) => {
    try {
      const active =
        await Coinflip.find({
          status: "active"
        })
        .select(
          "creatorId petValue"
        )
        .lean();

      const activeCount =
        active.length;

      const totalValue =
        active.reduce(
          (sum, flip) =>
            sum +
            (Number(
              flip.petValue
            ) || 0),
          0
        );

      const uniqueUsers =
        new Set(
          active
            .map(
              flip =>
                String(
                  flip.creatorId
                )
            )
            .filter(Boolean)
        );

      res.json({
        success: true,

        activeCoinflips:
          activeCount,

        totalValue,

        coinflippingNow:
          uniqueUsers.size
      });
    } catch (error) {
      console.error(
        "Stats error:",
        error.message
      );

      res.json({
        success: true,
        activeCoinflips: 0,
        totalValue: 0,
        coinflippingNow: 0
      });
    }
  }
);

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
// ROBLOX USER LOOKUP
// =====================================================
//
// Frontend calls:
// GET /user/Username
//
// Server calls Roblox.
// Browser never directly calls Roblox.
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
            "Username required."
        });
      }

      const robloxUser =
        await findRobloxUser(
          username
        );

      if (!robloxUser) {
        return res.json({
          success: false,
          message:
            "Roblox username not found."
        });
      }

      const avatar =
        await getRobloxAvatar(
          robloxUser.id
        );

      res.json({
        success: true,

        user: {
          id:
            robloxUser.id,

          username:
            robloxUser.name,

          displayName:
            robloxUser.displayName ||
            robloxUser.name,

          avatar
        }
      });
    } catch (error) {
      console.error(
        "Roblox user lookup:",
        error
      );

      res.status(502).json({
        success: false,
        message:
          error.message ||
          "Could not reach Roblox."
      });
    }
  }
);

// =====================================================
// VERIFICATION PHRASE
// =====================================================

function generatePhrase() {
  const words = [
    "silver",
    "tiger",
    "nova",
    "pixel",
    "shadow",
    "comet",
    "ember",
    "frost",
    "orbit",
    "neon",
    "rocket",
    "storm",
    "velvet",
    "lunar",
    "maple",
    "swift",
    "cosmic",
    "prism",
    "thunder",
    "cobalt",
    "sunset",
    "raven",
    "mint",
    "blaze"
  ];

  const pick =
    () =>
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

  return `admflip-${pick()}-${pick()}-${number}`;
}

// =====================================================
// CREATE VERIFICATION
// =====================================================

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
// VERIFY ROBLOX BIO
// =====================================================
//
// Frontend sends:
//
// {
//   username: "RobloxUsername",
//   phrase: "admflip-something-something-1234"
// }
//
// Server:
// 1. Finds the Roblox account
// 2. Loads the public profile
// 3. Checks description/bio
// 4. Saves verified account to MongoDB
//
// NO password.
// NO cookie.
// NO roblosecurity.
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
            "Username and phrase required."
        });
      }

      if (
        !/^admflip-[a-z]+-[a-z]+-\d{4}$/i.test(
          phrase
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid verification phrase."
        });
      }

      // Find Roblox account

      const robloxUser =
        await findRobloxUser(
          username
        );

      if (!robloxUser) {
        return res.json({
          success: false,
          message:
            "Roblox username not found."
        });
      }

      // Get latest profile

      const profile =
        await getRobloxProfile(
          robloxUser.id
        );

      const description =
        String(
          profile?.description || ""
        );

      // Case-insensitive verification

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
            "Verification phrase was not found in your Roblox bio. Add the exact phrase to your Roblox profile About/Bio, save it, then try again."
        });
      }

      // Get Roblox avatar

      const avatar =
        await getRobloxAvatar(
          robloxUser.id
        );

      // Save account

      const user =
        await User.findOneAndUpdate(
          {
            robloxId:
              Number(
                robloxUser.id
              )
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
                Number(
                  robloxUser.id
                )
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
            Number(
              robloxUser.id
            ),

          username:
            profile.name ||
            robloxUser.name,

          displayName:
            profile.displayName ||
            profile.name ||
            robloxUser.name,

          avatar,

          balance:
            user.balance || 0,

          wagered:
            user.wagered || 0,

          profit:
            user.profit || 0,

          verified: true
        }
      });
    } catch (error) {
      console.error(
        "Verification error:",
        error
      );

      res.status(502).json({
        success: false,

        message:
          error.message ||
          "Verification failed."
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
            "Invalid user."
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
            "User not found."
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
            (
              user.inventory || []
            ).map(item => ({
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
      console.error(
        "Account error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not load account."
      });
    }
  }
);

// =====================================================
// CHAT LINK FILTER
// =====================================================

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg|discord\.com\/invite|(?:[a-z0-9-]+\.)+(?:com|net|gg|org)\b)/i
    .test(text);
}

// =====================================================
// GET CHAT
// =====================================================

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
    } catch (error) {
      console.error(
        "Chat messages:",
        error.message
      );

      res.json({
        success: true,
        messages: []
      });
    }
  }
);

// =====================================================
// SEND CHAT
// =====================================================

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
            "Sign in to chat."
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
            "Message is empty."
        });
      }

      if (clean.length > 300) {
        return res.status(400).json({
          success: false,
          message:
            "Message is too long."
        });
      }

      if (containsLink(clean)) {
        return res.status(400).json({
          success: false,
          message:
            "Links are not allowed."
        });
      }

      const messageDoc =
        await ChatMessage.create({
          username:
            String(username)
              .slice(0, 30),

          robloxId:
            Number(robloxId),

          avatar:
            String(avatar || ""),

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
      console.error(
        "Send chat:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Could not send message."
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
              Number(
                flip.petValue
              ) || 0,

            variant:
              flip.petVariant ||
              "",

            side:
              flip.side,

            image:
              petImage(
                flip.petName
              ),

            createdAt:
              flip.createdAt
          }))
      });
    } catch (error) {
      console.error(
        "Coinflips error:",
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
            "Invalid request."
        });
      }

      const normalizedSide =
        String(
          side || ""
        ).toLowerCase();

      if (
        normalizedSide !==
          "heads" &&
        normalizedSide !==
          "tails"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid side."
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
            "User not found."
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
            "Pet is not in your inventory."
        });
      }

      // Remove pet from inventory
      // before creating flip.

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

          side:
            normalizedSide,

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
          "Could not create coinflip."
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
    } catch (error) {
      console.error(
        "Leaderboard error:",
        error.message
      );

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
//
// Keep your existing telegram.js as a separate file.
// =====================================================

try {
  require("./telegram");

  console.log(
    "Telegram module loaded."
  );
} catch (error) {
  console.log(
    "Telegram module error:",
    error.message
  );
}

// =====================================================
// 404 API
// =====================================================

app.use(
  (req, res, next) => {
    if (
      req.path.startsWith("/api/")
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Not found."
      });
    }

    next();
  }
);

// =====================================================
// FRONTEND FALLBACK
// =====================================================

app.get(
  "*",
  (req, res, next) => {
    if (
      req.path.startsWith("/user/") ||
      req.path.startsWith("/account/") ||
      req.path.startsWith("/chat/") ||
      req.path.startsWith("/coinflips") ||
      req.path.startsWith("/pets") ||
      req.path.startsWith("/leaderboard") ||
      req.path.startsWith("/stats") ||
      req.path.startsWith("/status") ||
      req.path.startsWith("/check") ||
      req.path.startsWith("/create") ||
      req.path.startsWith("/health")
    ) {
      return next();
    }

    const indexPath =
      path.join(
        frontendPath,
        "index.html"
      );

    if (
      fs.existsSync(indexPath)
    ) {
      return res.sendFile(
        indexPath
      );
    }

    next();
  }
);

// =====================================================
// START
// =====================================================

const PORT =
  Number(
    process.env.PORT
  ) || 3000;

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
  }
);
