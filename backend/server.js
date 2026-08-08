const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();
app.set("trust proxy", 1);

const frontendPath = path.join(__dirname, "..", "frontend");
const valuesPath = path.join(__dirname, "values.txt");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.static(frontendPath));

if (!process.env.MONGO_URL) console.error("MONGO_URL is missing");

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(error => console.error("MongoDB error:", error.message));

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true, min: 0 },
  variant: { type: String, default: "" },
  addedAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", new mongoose.Schema({
  robloxId: { type: Number, unique: true, index: true },
  username: { type: String, index: true },
  avatar: String,
  balance: { type: Number, default: 0 },
  wagered: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  inventory: { type: [inventoryItemSchema], default: [] },
  deposited: { type: [inventoryItemSchema], default: [] }
}, { timestamps: true }));

const Settings = mongoose.model("Settings", new mongoose.Schema({
  siteOnline: { type: Boolean, default: true },
  announcement: { type: String, default: "" },
  onlineCount: { type: Number, default: 0 }
}));

const ChatMessage = mongoose.model("ChatMessage", new mongoose.Schema({
  username: String,
  robloxId: Number,
  avatar: String,
  message: { type: String, maxlength: 300, required: true },
  type: { type: String, default: "message" },
  createdAt: { type: Date, default: Date.now }
}));

const Coinflip = mongoose.model("Coinflip", new mongoose.Schema({
  creatorId: Number,
  creatorUsername: String,
  creatorAvatar: String,
  itemId: mongoose.Schema.Types.ObjectId,
  petName: String,
  petValue: Number,
  petVariant: String,
  side: { type: String, enum: ["heads", "tails"] },
  status: {
    type: String,
    enum: ["active", "joined", "completed", "cancelled"],
    default: "active"
  },
  joinerId: Number,
  joinerUsername: String,
  joinerAvatar: String,
  winnerId: Number,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
}));

function loadPets() {
  try {
    const text = fs.readFileSync(valuesPath, "utf8");
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const result = [];

    for (let i = 0; i < lines.length; i += 2) {
      const name = lines[i];
      const raw = lines[i + 1];
      if (!name || !raw) continue;

      const value = Number(raw.replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(value)) continue;

      result.push({ name, value });
    }

    console.log("Loaded pets:", result.length);
    return result;
  } catch (error) {
    console.error("values.txt error:", error.message);
    return [];
  }
}

const pets = loadPets();

function petImage(name) {
  if (!name) return "";
  return "https://amvgg.com/items/" + encodeURIComponent(name) + ".webp";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getRobloxUser(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [String(username).trim()],
      excludeBannedUsers: true
    })
  });

  if (!response.ok) {
    throw new Error(`Roblox users API returned ${response.status}`);
  }

  const data = await response.json();

  if (!data.data || !data.data.length) return null;

  return data.data[0];
}

async function getAvatar(id) {
  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );

    if (!response.ok) return "";

    const data = await response.json();
    return data.data?.[0]?.imageUrl || "";
  } catch {
    return "";
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/status", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        siteOnline: true,
        onlineCount: 0
      });
    }

    const active = await Coinflip.countDocuments({ status: "active" });
    const activeFlips = await Coinflip.find({ status: "active" })
      .select("petValue")
      .lean();

    const totalValue = activeFlips.reduce(
      (sum, flip) => sum + (Number(flip.petValue) || 0),
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
    console.error("Status error:", error.message);
    res.json({
      success: true,
      online: true,
      announcement: "",
      activeCoinflips: 0,
      totalCoinflipValue: 0
    });
  }
});

app.get("/chat/online", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        siteOnline: true,
        onlineCount: 0
      });
    }

    res.json({
      success: true,
      online: settings.onlineCount || 0
    });
  } catch (error) {
    console.error("Online count error:", error.message);
    res.json({ success: true, online: 0 });
  }
});

app.get("/pets", (req, res) => {
  res.json({
    success: true,
    pets: pets.map(pet => ({
      id: pet.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: pet.name,
      value: pet.value,
      image: petImage(pet.name)
    }))
  });
});

app.get("/user/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username required"
      });
    }

    const robloxUser = await getRobloxUser(username);

    if (!robloxUser) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const avatar = await getAvatar(robloxUser.id);

    await User.findOneAndUpdate(
      { robloxId: robloxUser.id },
      {
        $set: {
          username: robloxUser.name,
          avatar
        },
        $setOnInsert: {
          robloxId: robloxUser.id
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      user: {
        id: robloxUser.id,
        username: robloxUser.name,
        avatar
      }
    });
  } catch (error) {
    console.error("User lookup:", error.message);
    res.status(502).json({
      success: false,
      message: "Roblox could not be reached"
    });
  }
});

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

  return words[Math.floor(Math.random() * words.length)] +
    "-" +
    Math.floor(1000 + Math.random() * 9000);
}

function sendVerificationPhrase(res) {
  res.json({
    success: true,
    phrase: generatePhrase()
  });
}

app.get("/create", (req, res) => {
  sendVerificationPhrase(res);
});

app.post("/create", (req, res) => {
  sendVerificationPhrase(res);
});

app.post("/check", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const phrase = String(req.body.phrase || "").trim();

    if (!username || !phrase) {
      return res.status(400).json({
        success: false,
        message: "Username and phrase required"
      });
    }

    const robloxUser = await getRobloxUser(username);

    if (!robloxUser) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const profileResponse = await fetch(
      `https://users.roblox.com/v1/users/${robloxUser.id}`
    );

    if (!profileResponse.ok) {
      return res.status(502).json({
        success: false,
        message: "Could not read Roblox profile"
      });
    }

    const profile = await profileResponse.json();
    const description = String(profile.description || "").trim();

    if (!description.toLowerCase().includes(phrase.toLowerCase())) {
      return res.json({
        success: false,
        message: "Verification phrase not found in Roblox bio"
      });
    }

    const avatar = await getAvatar(robloxUser.id);

    await User.findOneAndUpdate(
      { robloxId: robloxUser.id },
      {
        $set: {
          username: profile.name,
          avatar
        },
        $setOnInsert: {
          robloxId: robloxUser.id
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      username: profile.name,
      id: robloxUser.id,
      avatar
    });
  } catch (error) {
    console.error("Verification:", error.message);
    res.status(502).json({
      success: false,
      message: "Verification failed"
    });
  }
});

app.get("/account/:robloxId", async (req, res) => {
  try {
    const id = Number(req.params.robloxId);

    if (!Number.isSafeInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user"
      });
    }

    const user = await User.findOne({ robloxId: id }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.robloxId,
        username: user.username,
        avatar: user.avatar,
        balance: user.balance || 0,
        wagered: user.wagered || 0,
        profit: user.profit || 0,
        inventory: (user.inventory || []).map(item => ({
          itemId: item._id,
          name: item.name,
          value: item.value,
          variant: item.variant || "",
          image: petImage(item.name)
        }))
      }
    });
  } catch (error) {
    console.error("Account:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not load account"
    });
  }
});

function containsLink(text) {
  return /(?:https?:\/\/|www\.|discord\.gg|discord\.com\/invite|[a-z0-9-]+\.(?:com|net|gg|org)\b)/i.test(text);
}

app.get("/chat/messages", async (req, res) => {
  try {
    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      messages: messages.reverse()
    });
  } catch (error) {
    console.error("Chat messages:", error.message);
    res.json({ success: true, messages: [] });
  }
});

app.post("/chat/messages", async (req, res) => {
  try {
    const robloxId = Number(req.body.robloxId);
    const username = String(req.body.username || "").trim();
    const avatar = String(req.body.avatar || "");
    const message = String(req.body.message || "");

    if (!Number.isSafeInteger(robloxId) || !username || !message) {
      return res.status(400).json({
        success: false,
        message: "Sign in to chat"
      });
    }

    const clean = message.replace(/[<>]/g, "").trim();

    if (!clean) {
      return res.status(400).json({
        success: false,
        message: "Message is empty"
      });
    }

    if (clean.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Message is too long"
      });
    }

    if (containsLink(clean)) {
      return res.status(400).json({
        success: false,
        message: "Links are not allowed"
      });
    }

    const messageDoc = await ChatMessage.create({
      username,
      robloxId,
      avatar,
      message: clean,
      type: "message"
    });

    res.json({
      success: true,
      message: messageDoc
    });
  } catch (error) {
    console.error("Send chat:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not send message"
    });
  }
});

app.get("/coinflips", async (req, res) => {
  try {
    const flips = await Coinflip.find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      coinflips: flips.map(flip => ({
        id: flip._id,
        username: flip.creatorUsername,
        avatar: flip.creatorAvatar,
        petName: flip.petName,
        petValue: flip.petValue,
        variant: flip.petVariant || "",
        side: flip.side,
        image: petImage(flip.petName)
      }))
    });
  } catch (error) {
    console.error("Coinflips:", error.message);
    res.json({ success: true, coinflips: [] });
  }
});

app.post("/coinflips", async (req, res) => {
  try {
    const userId = Number(req.body.robloxId);
    const itemId = req.body.itemId;
    const normalizedSide = String(req.body.side || "").toLowerCase();

    if (
      !Number.isSafeInteger(userId) ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    if (!["heads", "tails"].includes(normalizedSide)) {
      return res.status(400).json({
        success: false,
        message: "Invalid side"
      });
    }

    const locked = await User.findOneAndUpdate(
      {
        robloxId: userId,
        "inventory._id": itemId
      },
      {
        $pull: { inventory: { _id: itemId } }
      },
      { new: true }
    );

    if (!locked) {
      return res.status(409).json({
        success: false,
        message: "That pet is already being used."
      });
    }

    const item = locked.inventory.id(itemId);

    if (item) {
      return res.status(500).json({
        success: false,
        message: "Could not lock pet"
      });
    }

    const oldUser = await User.findOne({ robloxId: userId });

    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(500).json({
      success: false,
      message: "Coinflip creation requires the original inventory item data"
    });
  } catch (error) {
    console.error("Create coinflip:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not create coinflip"
    });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find()
      .sort({ wagered: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      users: users.map((user, index) => ({
        place: index + 1,
        username: user.username,
        avatar: user.avatar,
        wagered: user.wagered || 0,
        profit: user.profit || 0
      }))
    });
  } catch (error) {
    console.error("Leaderboard:", error.message);
    res.json({ success: true, users: [] });
  }
});

try {
  require("./telegram");
  console.log("Telegram module loaded");
} catch (error) {
  console.log("Telegram module error:", error.message);
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "Not found"
    });
  }
  next();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ADMFLIP running on port ${PORT}`);
  console.log("Frontend:", frontendPath);
});
