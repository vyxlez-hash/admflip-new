const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const cheerio = require("cheerio");

const app = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.randomBytes(32).toString("hex");

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

console.log("Mongo URL exists:", !!MONGO_URL);

if (!MONGO_URL) {
  console.error("MONGO_URL is missing.");
}

mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(error => {
    console.error("MongoDB error:", error.message);
  });

/* =========================
   SCHEMAS
========================= */

const inventorySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },

  name: {
    type: String,
    required: true
  },

  value: {
    type: Number,
    default: 0
  },

  image: {
    type: String,
    default: ""
  },

  variant: {
    type: String,
    default: ""
  }
}, {
  _id: true
});

const userSchema = new mongoose.Schema({
  robloxId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  username: {
    type: String,
    required: true
  },

  avatar: {
    type: String,
    default: ""
  },

  balance: {
    type: Number,
    default: 0
  },

  inventory: {
    type: [inventorySchema],
    default: []
  },

  deposited: {
    type: [inventorySchema],
    default: []
  },

  wagered: {
    type: Number,
    default: 0
  },

  profit: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const User = mongoose.model("User", userSchema);

const chatSchema = new mongoose.Schema({
  username: String,
  robloxId: Number,
  avatar: String,
  message: String
}, {
  timestamps: true
});

const ChatMessage = mongoose.model("ChatMessage", chatSchema);

const settingsSchema = new mongoose.Schema({
  siteOnline: {
    type: Boolean,
    default: true
  },

  announcement: {
    type: String,
    default: ""
  }
});

const Settings = mongoose.model("Settings", settingsSchema);

const coinflipSchema = new mongoose.Schema({
  username: String,
  robloxId: Number,

  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  pet: {
    name: String,
    value: Number,
    image: String,
    variant: String
  },

  side: {
    type: String,
    enum: ["HEADS", "TAILS"]
  },

  status: {
    type: String,
    enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
    default: "ACTIVE"
  },

  opponent: {
    username: String,
    robloxId: Number
  },

  result: String
}, {
  timestamps: true
});

const Coinflip = mongoose.model(
  "Coinflip",
  coinflipSchema
);

/* =========================
   PET VALUES
========================= */

function cleanNumber(value) {
  if (value === undefined || value === null) {
    return 0;
  }

  const cleaned = String(value)
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function loadPets() {
  try {
    const file = path.join(__dirname, "values.txt");

    if (!fs.existsSync(file)) {
      console.log("values.txt not found");
      return [];
    }

    const text = fs.readFileSync(file, "utf8");

    const lines = text
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);

    const result = [];

    /*
      Supports:

      Pet Name
      123

      OR:

      Pet Name
      123
      image-url

      OR:

      Pet Name
      123
      variant
      image-url
    */

    for (let i = 0; i < lines.length;) {
      const name = lines[i];

      if (!name) {
        i++;
        continue;
      }

      const value = lines[i + 1];

      if (!value) {
        break;
      }

      let image = "";
      let variant = "";

      let next = lines[i + 2] || "";
      let next2 = lines[i + 3] || "";

      if (
        next.startsWith("http://") ||
        next.startsWith("https://")
      ) {
        image = next;
        i += 3;
      } else {
        variant = next;

        if (
          next2.startsWith("http://") ||
          next2.startsWith("https://")
        ) {
          image = next2;
          i += 4;
        } else {
          i += 2;
        }
      }

      result.push({
        name,
        value: cleanNumber(value),
        image,
        variant
      });
    }

    console.log("Loaded pets:", result.length);

    return result;

  } catch (error) {
    console.error(
      "Pet loading error:",
      error.message
    );

    return [];
  }
}

let pets = loadPets();

setInterval(() => {
  pets = loadPets();
}, 5 * 60 * 1000);

/* =========================
   PET IMAGE RESOLVER
========================= */

const imageCache = new Map();

function normalizePetName(name) {
  return String(name)
    .toLowerCase()
    .replace(/mega neon/g, "")
    .replace(/neon/g, "")
    .replace(/ride/g, "")
    .replace(/fly/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findPetImage(name) {
  const key = normalizePetName(name);

  if (imageCache.has(key)) {
    return imageCache.get(key);
  }

  /*
    First use values.txt image if supplied.
  */

  const localPet = pets.find(
    pet =>
      normalizePetName(pet.name) === key &&
      pet.image
  );

  if (localPet?.image) {
    imageCache.set(key, localPet.image);
    return localPet.image;
  }

  /*
    Try Adopt Me Wiki / Fandom search.

    This is only a best-effort fallback. If the external
    site changes, values still work without images.
  */

  try {
    const url =
      "https://adoptme.fandom.com/api.php" +
      "?action=query" +
      "&generator=search" +
      "&gsrsearch=" +
      encodeURIComponent(name) +
      "&gsrnamespace=6" +
      "&prop=imageinfo" +
      "&iiprop=url" +
      "&format=json";

    const response = await fetch(url);

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    const pages = data?.query?.pages || {};

    const first = Object.values(pages)[0];

    const image =
      first?.imageinfo?.[0]?.url || "";

    if (image) {
      imageCache.set(key, image);
    }

    return image;

  } catch {
    return "";
  }
}

/*
  Resolve missing images once when the server starts.
*/

async function resolveImages() {
  for (const pet of pets) {
    if (!pet.image) {
      pet.image = await findPetImage(pet.name);
    }
  }
}

resolveImages();

/* =========================
   AUTH
========================= */

function createToken(user) {
  return jwt.sign(
    {
      id: String(user._id),
      robloxId: user.robloxId,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function getToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

async function auth(req, res, next) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please sign in first."
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const user = await User.findOne({
      robloxId: decoded.robloxId
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists."
      });
    }

    req.user = user;
    next();

  } catch {
    return res.status(401).json({
      success: false,
      message: "Your session expired. Please sign in again."
    });
  }
}

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.send("ADMFLIP backend is online");
});

/* =========================
   STATUS
========================= */

app.get("/status", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    /*
      Stable-ish count instead of changing every refresh.
    */

    const minute = Math.floor(Date.now() / 60000);

    const variation =
      Math.abs(
        Math.sin(minute / 3)
      ) * 8;

    const onlineCount =
      Math.round(38 + variation);

    res.json({
      online: settings.siteOnline,
      announcement: settings.announcement,
      onlineCount
    });

  } catch {
    res.json({
      online: true,
      announcement: "",
      onlineCount: 42
    });
  }
});

/* =========================
   ROBLOX USER
========================= */

app.get("/user/:username", async (req, res) => {
  try {
    const username =
      String(req.params.username).trim();

    if (!username) {
      return res.json({
        success: false,
        message: "Username required."
      });
    }

    const response = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: true
        })
      }
    );

    if (!response.ok) {
      throw new Error("Roblox request failed");
    }

    const data = await response.json();

    if (!data.data?.length) {
      return res.json({
        success: false,
        message: "Roblox username not found."
      });
    }

    const user = data.data[0];

    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`
    );

    const avatarData =
      await avatarResponse.json();

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.name,
        avatar:
          avatarData.data?.[0]?.imageUrl || ""
      }
    });

  } catch (error) {
    console.error("Roblox user error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to contact Roblox right now."
    });
  }
});

/* =========================
   PHRASE
========================= */

function generatePhrase() {
  const words = [
    "BlueTiger",
    "FastCloud",
    "LuckyWave",
    "SilverMoon",
    "GoldenLeaf"
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

app.get("/create", (req, res) => {
  res.json({
    phrase: generatePhrase()
  });
});

/* =========================
   VERIFY BIO
========================= */

app.post("/check", async (req, res) => {
  try {
    const {
      username,
      phrase
    } = req.body;

    if (!username || !phrase) {
      return res.status(400).json({
        success: false,
        message: "Username and phrase are required."
      });
    }

    const response = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: true
        })
      }
    );

    const data = await response.json();

    if (!data.data?.length) {
      return res.json({
        success: false,
        message: "Roblox username not found."
      });
    }

    const id = data.data[0].id;

    const profileResponse = await fetch(
      `https://users.roblox.com/v1/users/${id}`
    );

    const profile =
      await profileResponse.json();

    if (
      !profile.description ||
      !profile.description.includes(phrase)
    ) {
      return res.json({
        success: false,
        message:
          "Verification phrase not found in your Roblox bio."
      });
    }

    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );

    const avatarData =
      await avatarResponse.json();

    let user = await User.findOne({
      robloxId: id
    });

    if (!user) {
      user = await User.create({
        robloxId: id,
        username: profile.name,
        avatar:
          avatarData.data?.[0]?.imageUrl || ""
      });
    } else {
      user.username = profile.name;

      if (avatarData.data?.[0]?.imageUrl) {
        user.avatar =
          avatarData.data[0].imageUrl;
      }

      await user.save();
    }

    const token = createToken(user);

    res.json({
      success: true,
      username: user.username,
      id: user.robloxId,
      token
    });

  } catch (error) {
    console.error("Verification error:", error.message);

    res.status(500).json({
      success: false,
      message: "Verification failed. Try again."
    });
  }
});

/* =========================
   PET VALUES
========================= */

app.get("/pets", async (req, res) => {
  const output = [];

  for (const pet of pets) {
    let image = pet.image;

    if (!image) {
      image = await findPetImage(pet.name);
    }

    output.push({
      name: pet.name,
      value: pet.value,
      image: image || "",
      variant: pet.variant || ""
    });
  }

  res.json({
    success: true,
    pets: output
  });
});

/* =========================
   CURRENT USER
========================= */

app.get("/me", auth, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/* =========================
   CHAT
========================= */

const LINK_PATTERN =
  /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|bit\.ly\/|tinyurl\.com\/)/i;

app.get("/chat", async (req, res) => {
  try {
    const [settings, messages] =
      await Promise.all([
        Settings.findOne(),
        ChatMessage
          .find()
          .sort({ createdAt: -1 })
          .limit(80)
          .lean()
      ]);

    res.json({
      announcement:
        settings?.announcement || "",
      messages: messages.reverse()
    });

  } catch (error) {
    res.status(500).json({
      message: "Unable to load chat."
    });
  }
});

app.post("/chat", auth, async (req, res) => {
  try {
    const message =
      String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        message: "Message cannot be empty."
      });
    }

    if (message.length > 300) {
      return res.status(400).json({
        message: "Message is too long."
      });
    }

    if (LINK_PATTERN.test(message)) {
      return res.status(400).json({
        message: "Advertising and links are not allowed."
      });
    }

    await ChatMessage.create({
      username: req.user.username,
      robloxId: req.user.robloxId,
      avatar: req.user.avatar,
      message
    });

    res.json({
      success: true
    });

  } catch {
    res.status(500).json({
      message: "Unable to send message."
    });
  }
});

/* =========================
   LEADERBOARD
========================= */

app.get("/leaderboard", async (req, res) => {
  try {
    const players = await User.find()
      .sort({ wagered: -1 })
      .limit(10)
      .select(
        "username avatar wagered profit"
      )
      .lean();

    res.json({
      success: true,
      players
    });

  } catch {
    res.status(500).json({
      message: "Unable to load leaderboard."
    });
  }
});

/* =========================
   ACTIVE COINFLIPS
========================= */

app.get("/coinflips", async (req, res) => {
  try {
    const coinflips = await Coinflip.find({
      status: "ACTIVE"
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      coinflips
    });

  } catch {
    res.status(500).json({
      message: "Unable to load coinflips."
    });
  }
});

/* =========================
   CREATE COINFLIP
========================= */

app.post("/coinflips", auth, async (req, res) => {
  const session =
    await mongoose.startSession();

  try {
    const {
      itemId,
      side
    } = req.body;

    if (
      !itemId ||
      !["HEADS", "TAILS"].includes(side)
    ) {
      return res.status(400).json({
        message: "Invalid coinflip."
      });
    }

    session.startTransaction();

    const user = await User.findOne({
      _id: req.user._id,
      "inventory._id": itemId
    }).session(session);

    if (!user) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "That pet is not in your inventory."
      });
    }

    const item =
      user.inventory.find(
        x => String(x._id) === String(itemId)
      );

    if (!item) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "Pet not found."
      });
    }

    /*
      Remove the exact inventory item first.
      This prevents the same item being used twice.
    */

    user.inventory.pull({
      _id: item._id
    });

    await user.save({
      session
    });

    await Coinflip.create([{
      username: user.username,
      robloxId: user.robloxId,

      itemId: item._id,

      pet: {
        name: item.name,
        value: item.value,
        image: item.image,
        variant: item.variant
      },

      side,

      status: "ACTIVE"
    }], {
      session
    });

    await session.commitTransaction();

    res.json({
      success: true
    });

  } catch (error) {
    await session.abortTransaction();

    console.error(
      "Create coinflip:",
      error.message
    );

    res.status(500).json({
      message:
        "Coinflip creation failed. Your pet was not consumed."
    });

  } finally {
    session.endSession();
  }
});

/* =========================
   JOIN COINFLIP
========================= */

app.post(
  "/coinflips/:id/join",
  auth,
  async (req, res) => {

    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const flip =
        await Coinflip.findOne({
          _id: req.params.id,
          status: "ACTIVE"
        }).session(session);

      if (!flip) {
        await session.abortTransaction();

        return res.status(404).json({
          message:
            "That coinflip is no longer active."
        });
      }

      if (
        flip.robloxId === req.user.robloxId
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          message:
            "You cannot join your own coinflip."
        });
      }

      const opponent =
        await User.findById(
          req.user._id
        ).session(session);

      if (!opponent.inventory.length) {
        await session.abortTransaction();

        return res.status(400).json({
          message:
            "You don't have a pet to wager."
        });
      }

      /*
        For now use the first inventory pet.
        Later the UI can allow selecting the
        opponent's exact pet.
      */

      const item =
        opponent.inventory[0];

      opponent.inventory.pull({
        _id: item._id
      });

      await opponent.save({
        session
      });

      const winnerSide =
        Math.random() < 0.5
          ? "HEADS"
          : "TAILS";

      const creatorWins =
        winnerSide === flip.side;

      const winnerRobloxId =
        creatorWins
          ? flip.robloxId
          : opponent.robloxId;

      /*
        The two staked pets are awarded to the winner.
      */

      const creator =
        await User.findOne({
          robloxId: flip.robloxId
        }).session(session);

      if (!creator) {
        throw new Error(
          "Creator account missing"
        );
      }

      const winner =
        winnerRobloxId === creator.robloxId
          ? creator
          : opponent;

      winner.inventory.push(
        {
          name: flip.pet.name,
          value: flip.pet.value,
          image: flip.pet.image,
          variant: flip.pet.variant
        },
        {
          name: item.name,
          value: item.value,
          image: item.image,
          variant: item.variant
        }
      );

      const totalValue =
        Number(flip.pet.value || 0) +
        Number(item.value || 0);

      creator.wagered +=
        Number(flip.pet.value || 0);

      opponent.wagered +=
        Number(item.value || 0);

      winner.profit += totalValue;

      await creator.save({
        session
      });

      if (
        String(winner._id) !==
        String(opponent._id)
      ) {
        await opponent.save({
          session
        });
      }

      flip.status = "COMPLETED";

      flip.opponent = {
        username: opponent.username,
        robloxId: opponent.robloxId
      };

      flip.result = winnerSide;

      await flip.save({
        session
      });

      await session.commitTransaction();

      res.json({
        success: true,
        result: winnerSide,
        winner: winner.username
      });

    } catch (error) {
      await session.abortTransaction();

      console.error(
        "Join coinflip:",
        error.message
      );

      res.status(500).json({
        message:
          "Coinflip failed. No pet should be consumed."
      });

    } finally {
      session.endSession();
    }
  }
);

/* =========================
   HISTORY
========================= */

app.get(
  "/coinflips/history",
  auth,
  async (req, res) => {
    try {
      const history =
        await Coinflip.find({
          $or: [
            {
              robloxId:
                req.user.robloxId
            },
            {
              "opponent.robloxId":
                req.user.robloxId
            }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

      res.json({
        success: true,
        history
      });

    } catch {
      res.status(500).json({
        message:
          "Unable to load history."
      });
    }
  }
);

/* =========================
   ADMIN AUTH
========================= */

function admin(req, res, next) {
  if (!ADMIN_SECRET) {
    return res.status(503).json({
      message:
        "ADMIN_SECRET is not configured."
    });
  }

  const supplied =
    req.headers["x-admin-secret"];

  if (
    !supplied ||
    supplied !== ADMIN_SECRET
  ) {
    return res.status(403).json({
      message: "Admin access denied."
    });
  }

  next();
}

/* =========================
   ADMIN: BALANCE
========================= */

app.post(
  "/admin/balance",
  admin,
  async (req, res) => {
    try {
      const {
        robloxId,
        amount
      } = req.body;

      const value =
        Number(amount);

      if (
        !robloxId ||
        !Number.isFinite(value)
      ) {
        return res.status(400).json({
          message:
            "robloxId and numeric amount required."
        });
      }

      const user =
        await User.findOneAndUpdate(
          {
            robloxId: Number(robloxId)
          },
          {
            $inc: {
              balance: value
            }
          },
          {
            new: true
          }
        );

      if (!user) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      res.json({
        success: true,
        balance: user.balance
      });

    } catch {
      res.status(500).json({
        message:
          "Unable to update balance."
      });
    }
  }
);

/* =========================
   ADMIN: ADD PET
========================= */

app.post(
  "/admin/pet/add",
  admin,
  async (req, res) => {
    try {
      const {
        robloxId,
        name,
        value,
        image,
        variant
      } = req.body;

      if (!robloxId || !name) {
        return res.status(400).json({
          message:
            "robloxId and name required."
        });
      }

      const user =
        await User.findOneAndUpdate(
          {
            robloxId: Number(robloxId)
          },
          {
            $push: {
              inventory: {
                name,
                value: cleanNumber(value),
                image: image || "",
                variant: variant || ""
              }
            }
          },
          {
            new: true
          }
        );

      if (!user) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      res.json({
        success: true,
        inventory: user.inventory
      });

    } catch {
      res.status(500).json({
        message: "Unable to add pet."
      });
    }
  }
);

/* =========================
   ADMIN: REMOVE PET
========================= */

app.post(
  "/admin/pet/remove",
  admin,
  async (req, res) => {
    try {
      const {
        robloxId,
        itemId
      } = req.body;

      const user =
        await User.findOne({
          robloxId: Number(robloxId)
        });

      if (!user) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const exists =
        user.inventory.some(
          x => String(x._id) ===
            String(itemId)
        );

      if (!exists) {
        return res.status(404).json({
          message:
            "Inventory item not found."
        });
      }

      user.inventory.pull({
        _id: itemId
      });

      await user.save();

      res.json({
        success: true
      });

    } catch {
      res.status(500).json({
        message:
          "Unable to remove pet."
      });
    }
  }
);

/* =========================
   ADMIN: TRANSFER PET
========================= */

app.post(
  "/admin/pet/transfer",
  admin,
  async (req, res) => {
    const session =
      await mongoose.startSession();

    try {
      const {
        fromRobloxId,
        toRobloxId,
        itemId
      } = req.body;

      session.startTransaction();

      const sender =
        await User.findOne({
          robloxId: Number(fromRobloxId),
          "inventory._id": itemId
        }).session(session);

      if (!sender) {
        await session.abortTransaction();

        return res.status(404).json({
          message:
            "Source user or pet not found."
        });
      }

      const receiver =
        await User.findOne({
          robloxId: Number(toRobloxId)
        }).session(session);

      if (!receiver) {
        await session.abortTransaction();

        return res.status(404).json({
          message:
            "Receiving user not found."
        });
      }

      const item =
        sender.inventory.find(
          x => String(x._id) ===
            String(itemId)
        );

      if (!item) {
        throw new Error(
          "Pet disappeared during transfer."
        );
      }

      sender.inventory.pull({
        _id: item._id
      });

      receiver.inventory.push({
        name: item.name,
        value: item.value,
        image: item.image,
        variant: item.variant
      });

      await sender.save({
        session
      });

      await receiver.save({
        session
      });

      await session.commitTransaction();

      res.json({
        success: true
      });

    } catch (error) {
      await session.abortTransaction();

      res.status(500).json({
        message:
          "Transfer failed. Transaction rolled back."
      });

    } finally {
      session.endSession();
    }
  }
);

/* =========================
   ADMIN: ANNOUNCEMENT
========================= */

app.post(
  "/admin/announcement",
  admin,
  async (req, res) => {
    try {
      const text =
        String(req.body.message || "")
          .trim();

      if (text.length > 500) {
        return res.status(400).json({
          message:
            "Announcement too long."
        });
      }

      let settings =
        await Settings.findOne();

      if (!settings) {
        settings =
          await Settings.create({});
      }

      settings.announcement = text;

      await settings.save();

      res.json({
        success: true
      });

    } catch {
      res.status(500).json({
        message:
          "Unable to update announcement."
      });
    }
  }
);

/* =========================
   ADMIN: SITE ON/OFF
========================= */

app.post(
  "/admin/site",
  admin,
  async (req, res) => {
    try {
      let settings =
        await Settings.findOne();

      if (!settings) {
        settings =
          await Settings.create({});
      }

      settings.siteOnline =
        Boolean(req.body.online);

      await settings.save();

      res.json({
        success: true,
        online:
          settings.siteOnline
      });

    } catch {
      res.status(500).json({
        message:
          "Unable to update site status."
      });
    }
  }
);

/* =========================
   TELEGRAM
========================= */

try {
  if (
    process.env.TELEGRAM_TOKEN
  ) {
    require("./telegram");
    console.log("Telegram module loaded");
  } else {
    console.log(
      "TELEGRAM_TOKEN not configured; Telegram disabled."
    );
  }
} catch (error) {
  console.error(
    "Telegram module error:",
    error.message
  );
}

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(
    `ADMFLIP backend running on port ${PORT}`
  );
});
