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
        }
      },
      {
        timestamps: true
      }
    )
  );

const Coinflip =
  mongoose.models.Coinflip ||
  mongoose.model(
    "Coinflip",
    new mongoose.Schema(
      {
        creatorId: Number,
        creatorUsername: String,
        creatorAvatar: String,

        opponentId: {
          type: Number,
          default: null
        },

        opponentUsername: {
          type: String,
          default: ""
        },

        opponentAvatar: {
          type: String,
          default: ""
        },

        petName: String,

        petValue: {
          type: Number,
          default: 0
        },

        petImage: {
          type: String,
          default: ""
        },

        side: {
          type: String,
          enum: ["heads", "tails"],
          default: "heads"
        },

        status: {
          type: String,
          enum: [
            "active",
            "flipping",
            "completed",
            "cancelled"
          ],
          default: "active"
        },

        winnerId: {
          type: Number,
          default: null
        }
      },
      {
        timestamps: true
      }
    )
  );

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model(
    "ChatMessage",
    new mongoose.Schema(
      {
        robloxId: Number,
        username: String,
        avatar: String,

        message: {
          type: String,
          required: true
        },

        pinned: {
          type: Boolean,
          default: false
        },

        type: {
          type: String,
          default: "message"
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
    new mongoose.Schema(
      {
        siteOnline: {
          type: Boolean,
          default: true
        },

        onlineCount: {
          type: Number,
          default: 0
        }
      },
      {
        timestamps: true
      }
    )
  );

/* =========================================================
   PET VALUES
========================================================= */

/*
  values.txt format:

  Pet Name
  768.000
  Pet Name
  572.000

  The dot in values.txt is treated as a THOUSANDS
  separator, not a decimal point.

  Therefore:

    768.000  -> 768000
    135.523  -> 135523
    1.500.000 -> 1500000

  The parser also supports:
    768,000
    768000
    768.000
    768.5
*/

function parsePetValue(raw) {
  if (raw === undefined || raw === null) {
    return 0;
  }

  let value = String(raw).trim();

  if (!value) {
    return 0;
  }

  value = value.replace(/\s+/g, "");

  /*
    Values such as:

      768.000
      135.523
      1.500.000

    are thousands-separated values.
  */

  if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) {
    return Number(value.replace(/\./g, ""));
  }

  if (/^\d{1,3}(?:,\d{3})+$/.test(value)) {
    return Number(value.replace(/,/g, ""));
  }

  /*
    Normal numeric values.
  */

  const number = Number(value.replace(/,/g, ""));

  if (Number.isFinite(number)) {
    return number;
  }

  return 0;
}

function loadPets() {
  try {
    if (!fs.existsSync(valuesPath)) {
      console.warn(
        `values.txt not found at: ${valuesPath}`
      );

      return [];
    }

    const text = fs.readFileSync(
      valuesPath,
      "utf8"
    );

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const result = [];

    for (let i = 0; i < lines.length; i += 2) {
      const name = lines[i];
      const rawValue = lines[i + 1];

      if (!name) {
        continue;
      }

      const value = parsePetValue(rawValue);

      result.push({
        id: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),

        name,

        value,

        image: petImage(name)
      });
    }

    console.log(
      `Loaded ${result.length} pets from values.txt`
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

/* =========================================================
   PET IMAGES
========================================================= */

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

/*
  Proxy pet images through our backend.

  This prevents the browser from having to deal with
  image-host restrictions/CORS and also gives us a
  reliable fallback.
*/

app.get(
  "/pet-image/:name",
  async (req, res) => {
    try {
      const name = decodeURIComponent(
        req.params.name || ""
      ).trim();

      if (!name) {
        return res.status(400).end();
      }

      const imageUrl = petImage(name);

      const response = await fetch(
        imageUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 ADMFLIP/1.0",
            Accept:
              "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
          }
        }
      );

      if (!response.ok) {
        return res.status(404).end();
      }

      const contentType =
        response.headers.get("content-type") ||
        "image/webp";

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=86400"
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        "Pet image error:",
        error.message
      );

      return res.status(404).end();
    }
  }
);

/* =========================================================
   ROBLOX API
========================================================= */

/*
  IMPORTANT:

  The browser NEVER contacts Roblox directly.

  Browser
      |
      v
  our Express server
      |
      v
  Roblox API
*/

async function robloxRequest(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(
      url,
      {
        ...options,

        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "Mozilla/5.0 ADMFLIP/1.0",
          ...(options.headers || {})
        },

        signal: controller.signal
      }
    );

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/*
  Resolve username -> Roblox user.

  This uses Roblox's username endpoint rather than
  the browser search endpoint.
*/

async function getRobloxUser(username) {
  const cleanUsername = String(
    username || ""
  ).trim();

  if (!cleanUsername) {
    return null;
  }

  const response =
    await robloxRequest(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          usernames: [
            cleanUsername
          ],

          excludeBannedUsers: true
        })
      }
    );

  if (!response.ok) {
    throw new Error(
      `Roblox username API returned ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    !data ||
    !Array.isArray(data.data) ||
    data.data.length === 0
  ) {
    return null;
  }

  return data.data[0];
}

/*
  Get Roblox profile / bio.
*/

async function getRobloxProfile(id) {
  const response =
    await robloxRequest(
      `https://users.roblox.com/v1/users/${encodeURIComponent(
        id
      )}`
    );

  if (!response.ok) {
    throw new Error(
      `Roblox profile API returned ${response.status}`
    );
  }

  return response.json();
}

/*
  Get Roblox avatar.
*/

async function getAvatar(id) {
  try {
    const response =
      await robloxRequest(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(
          id
        )}&size=150x150&format=Png`
      );

    if (!response.ok) {
      return "";
    }

    const data =
      await response.json();

    return (
      data?.data?.[0]?.imageUrl ||
      ""
    );
  } catch {
    return "";
  }
}

/* =========================================================
   ROBLOX AVATAR PROXY
========================================================= */

app.get(
  "/roblox-avatar/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (!Number.isSafeInteger(id)) {
        return res.status(400).end();
      }

      const avatar =
        await getAvatar(id);

      if (!avatar) {
        return res.status(404).end();
      }

      const response =
        await fetch(avatar);

      if (!response.ok) {
        return res.status(404).end();
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "image/png";

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        "Roblox avatar proxy error:",
        error.message
      );

      return res.status(404).end();
    }
  }
);

/* =========================================================
   STATUS
========================================================= */

async function statusHandler(
  req,
  res
) {
  try {
    let settings =
      await Settings.findOne();

    if (!settings) {
      settings =
        await Settings.create({
          siteOnline: true,
          onlineCount: 0
        });
    }

    let active = 0;
    let totalValue = 0;

    try {
      active =
        await Coinflip.countDocuments({
          status: "active"
        });

      const activeFlips =
        await Coinflip
          .find({
            status: "active"
          })
          .select("petValue")
          .lean();

      totalValue =
        activeFlips.reduce(
          (sum, flip) =>
            sum +
            (Number(
              flip.petValue
            ) || 0),
          0
        );
    } catch {
      active = 0;
      totalValue = 0;
    }

    return res.json({
      success: true,

      online:
        settings.onlineCount || 0,

      onlineCount:
        settings.onlineCount || 0,

      siteOnline:
        settings.siteOnline !== false,

      activeCount:
        active,

      totalValue
    });
  } catch (error) {
    console.error(
      "Status:",
      error.message
    );

    return res.json({
      success: true,
      online: 0,
      onlineCount: 0,
      siteOnline: true,
      activeCount: 0,
      totalValue: 0
    });
  }
}

app.get(
  "/status",
  statusHandler
);

app.get(
  "/api/status",
  statusHandler
);

/* =========================================================
   USER LOOKUP
========================================================= */

async function userHandler(
  req,
  res
) {
  try {
    const username =
      String(
        req.params.username || ""
      ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message:
          "Username is required."
      });
    }

    const robloxUser =
      await getRobloxUser(
        username
      );

    if (!robloxUser) {
      return res.status(404).json({
        success: false,
        message:
          `No Roblox user found for "${username}".`
      });
    }

    const avatar =
      await getAvatar(
        robloxUser.id
      );

    /*
      Store/update the user when MongoDB
      is available.
    */

    try {
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
    } catch (error) {
      console.warn(
        "Could not save Roblox user:",
        error.message
      );
    }

    return res.json({
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

function phraseHandler(
  req,
  res
) {
  return res.json({
    success: true,
    phrase:
      generatePhrase()
  });
}

app.get(
  "/create",
  phraseHandler
);

app.post(
  "/create",
  phraseHandler
);

app.get(
  "/api/create",
  phraseHandler
);

app.post(
  "/api/create",
  phraseHandler
);

/* =========================================================
   VERIFY ROBLOX BIO
========================================================= */

async function checkHandler(
  req,
  res
) {
  try {
    const username =
      String(
        req.body.username || ""
      ).trim();

    const phrase =
      String(
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
      await getRobloxUser(
        username
      );

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

    const description =
      String(
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

    try {
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
    } catch (error) {
      console.warn(
        "Could not save verified user:",
        error.message
      );
    }

    return res.json({
      success: true,

      user: {
        username:
          profile.name ||
          robloxUser.name,

        id:
          robloxUser.id,

        avatar
      }
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

app.post(
  "/check",
  checkHandler
);

app.post(
  "/api/check",
  checkHandler
);

/* =========================================================
   PET VALUES
========================================================= */

function petsHandler(
  req,
  res
) {
  try {
    /*
      Reload the file every request so changing
      values.txt does not require a server restart.
    */

    const currentPets =
      loadPets();

    return res.json({
      success: true,
      pets: currentPets,
      values: currentPets,
      count: currentPets.length
    });
  } catch (error) {
    console.error(
      "Pets:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not load pet values.",
      pets: []
    });
  }
}

app.get(
  "/pets",
  petsHandler
);

app.get(
  "/api/pets",
  petsHandler
);

app.get(
  "/values",
  petsHandler
);

app.get(
  "/api/values",
  petsHandler
);

/* =========================================================
   ACCOUNT
========================================================= */

async function accountHandler(
  req,
  res
) {
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

    return res.json({
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
   LEADERBOARD
========================================================= */

async function leaderboardHandler(
  req,
  res
) {
  try {
    const users =
      await User.find({})
        .sort({
          wagered: -1
        })
        .limit(100)
        .lean();

    return res.json({
      success: true,

      players:
        users.map(user => ({
          id:
            user.robloxId,

          username:
            user.username,

          wagered:
            user.wagered || 0,

          total:
            user.wagered || 0,

          value:
            user.wagered || 0,

          avatar:
            user.avatar ||
            ""
        }))
    });
  } catch (error) {
    console.error(
      "Leaderboard:",
      error.message
    );

    return res.json({
      success: true,
      players: []
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
   COINFLIPS
========================================================= */

async function coinflipsHandler(
  req,
  res
) {
  try {
    const flips =
      await Coinflip
        .find({
          status: "active"
        })
        .sort({
          createdAt: -1
        })
        .limit(100)
        .lean();

    return res.json({
      success: true,

      coinflips:
        flips.map(flip => ({
          ...flip,

          id:
            flip._id,

          username:
            flip.creatorUsername,

          avatar:
            flip.creatorAvatar,

          pet: {
            name:
              flip.petName,

            value:
              flip.petValue,

            image:
              flip.petImage ||
              petImage(
                flip.petName
              )
          }
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
   CHAT
========================================================= */

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(
    text
  );
}

async function chatMessagesHandler(
  req,
  res
) {
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
      messages:
        messages.reverse()
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

async function sendChatHandler(
  req,
  res
) {
  try {
    const robloxId =
      Number(
        req.body.robloxId ??
        req.body.userId
      );

    const username =
      String(
        req.body.username || ""
      ).trim();

    const avatar =
      String(
        req.body.avatar || ""
      );

    const message =
      String(
        req.body.message || ""
      ).trim();

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

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Message is too long."
      });
    }

    if (containsLink(message)) {
      return res.status(400).json({
        success: false,
        message:
          "Links are not allowed in chat."
      });
    }

    const chat =
      await ChatMessage.create({
        robloxId,
        username,
        avatar,
        message
      });

    return res.json({
      success: true,
      message: chat
    });
  } catch (error) {
    console.error(
      "Send chat:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not send message."
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

app.get(
  "/chat/online",
  async (req, res) => {
    try {
      const settings =
        await Settings.findOne();

      return res.json({
        success: true,

        online:
          settings?.onlineCount ||
          0
      });
    } catch {
      return res.json({
        success: true,
        online: 0
      });
    }
  }
);

app.get(
  "/api/chat/online",
  async (req, res) => {
    try {
      const settings =
        await Settings.findOne();

      return res.json({
        success: true,

        online:
          settings?.onlineCount ||
          0
      });
    } catch {
      return res.json({
        success: true,
        online: 0
      });
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      status: "ok",
      pets: loadPets().length
    });
  }
);

/* =========================================================
   FRONTEND
========================================================= */

/*
  Serve frontend files if the frontend folder exists.
*/

if (
  fs.existsSync(frontendPath)
) {
  app.use(
    express.static(
      frontendPath,
      {
        maxAge: "1h"
      }
    )
  );

  app.get(
    "*",
    (req, res, next) => {
      /*
        Do not turn API errors into index.html.
      */

      if (
        req.path.startsWith(
          "/api/"
        ) ||
        req.path === "/pets" ||
        req.path === "/user" ||
        req.path === "/check" ||
        req.path === "/status" ||
        req.path === "/leaderboard" ||
        req.path === "/coinflips"
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

      return next();
    }
  );
}

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
      "Unhandled error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error."
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `ADMFLIP server running on port ${PORT}`
    );

    console.log(
      `Loaded ${loadPets().length} pets`
    );
  }
);
