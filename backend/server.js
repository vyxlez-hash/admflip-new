const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("MONGO_URL is missing.");
}

mongoose.connect(MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err.message));

const User = mongoose.model("User", new mongoose.Schema({
  robloxId: { type: Number, unique: true, index: true },
  username: String,
  avatar: String,

  inventory: [{
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    name: String,
    value: Number,
    image: String
  }],

  wagered: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 }
}));

const ChatMessage = mongoose.model("ChatMessage", new mongoose.Schema({
  robloxId: Number,
  username: String,
  avatar: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
}));

const Coinflip = mongoose.model("Coinflip", new mongoose.Schema({
  creatorId: Number,
  username: String,
  avatar: String,

  petId: String,
  petName: String,
  petValue: Number,
  petImage: String,

  side: String,

  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active"
  },

  opponentId: Number,
  winnerId: Number,
  winnerUsername: String,

  createdAt: { type: Date, default: Date.now }
}));

const Settings = mongoose.model("Settings", new mongoose.Schema({
  siteOnline: { type: Boolean, default: true },
  announcement: { type: String, default: "" }
}));

function loadPets() {
  try {
    const text = fs.readFileSync("./values.txt", "utf8");

    const lines = text
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);

    const result = [];

    for (let i = 0; i < lines.length; i += 2) {
      const name = lines[i];
      const raw = lines[i + 1];

      if (!name || !raw) continue;

      const value = Number(
        raw.replace(/[^0-9.-]/g, "")
      );

      result.push({
        name,
        value: Number.isFinite(value) ? value : 0,
        image: ""
      });
    }

    console.log("Loaded pets:", result.length);
    return result;
  } catch (err) {
    console.log("values.txt unavailable:", err.message);
    return [];
  }
}

const pets = loadPets();

function containsLink(text) {
  return /(https?:\/\/|www\.|discord\.gg|t\.me\/|\.com\b|\.net\b|\.org\b|\.gg\b)/i
    .test(text);
}

async function getUser(id) {
  return User.findOne({ robloxId: Number(id) });
}

app.get("/", (req, res) => {
  res.send("ADMFLIP backend is online");
});

app.get("/status", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    res.json({
      online: settings.siteOnline,
      announcement: settings.announcement
    });
  } catch {
    res.json({
      online: true,
      announcement: ""
    });
  }
});

app.get("/pets", (req, res) => {
  res.json({
    success: true,
    pets
  });
});

app.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username;

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

    if (!data.data || !data.data.length) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const robloxUser = data.data[0];

    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
    );

    const avatarData = await avatarResponse.json();

    const avatar =
      avatarData.data?.[0]?.imageUrl || "";

    let user = await User.findOne({
      robloxId: robloxUser.id
    });

    if (!user) {
      user = await User.create({
        robloxId: robloxUser.id,
        username: robloxUser.name,
        avatar,
        inventory: []
      });
    } else {
      user.username = robloxUser.name;
      user.avatar = avatar;
      await user.save();
    }

    res.json({
      success: true,
      user: {
        id: user.robloxId,
        username: user.username,
        avatar: user.avatar,
        inventory: user.inventory,
        wagered: user.wagered,
        profit: user.profit
      }
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

function generatePhrase() {
  const words = [
    "BlueTiger",
    "FastCloud",
    "LuckyWave",
    "SilverMoon",
    "GoldenLeaf"
  ];

  return `${words[Math.floor(Math.random() * words.length)]}-${1000 + Math.floor(Math.random() * 9000)}`;
}

app.get("/create", (req, res) => {
  res.json({
    phrase: generatePhrase()
  });
});

app.post("/check", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const phrase = String(req.body.phrase || "").trim();

    if (!username || !phrase) {
      return res.json({
        success: false,
        message: "Missing verification information"
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
        message: "Roblox username not found"
      });
    }

    const id = data.data[0].id;

    const profileResponse = await fetch(
      `https://users.roblox.com/v1/users/${id}`
    );

    const profile = await profileResponse.json();

    if (
      profile.description &&
      profile.description.includes(phrase)
    ) {
      return res.json({
        success: true,
        username: profile.name,
        id: profile.id
      });
    }

    res.json({
      success: false,
      message: "Verification phrase not found"
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
});

app.get("/inventory/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);

    if (!user) {
      return res.json({
        success: true,
        inventory: []
      });
    }

    res.json({
      success: true,
      inventory: user.inventory || []
    });
  } catch {
    res.status(500).json({
      success: false,
      inventory: []
    });
  }
});

app.get("/chat", async (req, res) => {
  try {
    const messages = await ChatMessage
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      messages: messages.reverse()
    });
  } catch {
    res.json({
      success: true,
      messages: []
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const message = String(req.body.message || "").trim();

    if (!username || !message) {
      return res.json({
        success: false,
        message: "Missing message"
      });
    }

    if (message.length > 250) {
      return res.json({
        success: false,
        message: "Message too long"
      });
    }

    if (containsLink(message)) {
      return res.json({
        success: false,
        message: "Links are not allowed."
      });
    }

    await ChatMessage.create({
      robloxId: Number(req.body.robloxId),
      username: username.slice(0, 30),
      avatar: String(req.body.avatar || ""),
      message
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({
      success: false,
      message: "Chat failed"
    });
  }
});

app.get("/user-stats/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);

    if (!user) {
      return res.json({
        username: "User",
        avatar: "",
        wagered: 0,
        profit: 0
      });
    }

    res.json({
      username: user.username,
      avatar: user.avatar,
      wagered: user.wagered || 0,
      profit: user.profit || 0
    });
  } catch {
    res.status(500).json({});
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find()
      .sort({ wagered: -1 })
      .limit(10)
      .select("username avatar wagered")
      .lean();

    res.json({
      success: true,
      users
    });
  } catch {
    res.json({
      success: true,
      users: []
    });
  }
});

app.get("/coinflips", async (req, res) => {
  try {
    const coinflips = await Coinflip
      .find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      coinflips
    });
  } catch {
    res.json({
      success: true,
      coinflips: []
    });
  }
});

async function removePet(user, petId, petName) {
  const index = user.inventory.findIndex(p =>
    (petId && String(p._id) === String(petId)) ||
    (!petId && p.name === petName)
  );

  if (index === -1) return null;

  const pet = user.inventory[index];

  user.inventory.splice(index, 1);

  return pet;
}

app.post("/coinflips", async (req, res) => {
  try {
    const user = await getUser(req.body.robloxId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    const pet = await removePet(
      user,
      req.body.petId,
      req.body.petName
    );

    if (!pet) {
      return res.json({
        success: false,
        message: "Pet is not in your inventory."
      });
    }

    const side =
      req.body.side === "tails"
        ? "tails"
        : "heads";

    await user.save();

    const flip = await Coinflip.create({
      creatorId: user.robloxId,
      username: user.username,
      avatar: user.avatar,
      petId: String(pet._id),
      petName: pet.name,
      petValue: pet.value || 0,
      petImage: pet.image || "",
      side
    });

    res.json({
      success: true,
      coinflip: flip
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Could not create coinflip"
    });
  }
});

app.post("/coinflips/:id/join", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const flip = await Coinflip.findOne({
      _id: req.params.id,
      status: "active"
    }).session(session);

    if (!flip) {
      throw new Error("Flip unavailable");
    }

    const joiner = await User.findOne({
      robloxId: Number(req.body.robloxId)
    }).session(session);

    if (!joiner) {
      throw new Error("User not found");
    }

    if (flip.creatorId === joiner.robloxId) {
      throw new Error("You cannot join your own flip");
    }

    /*
      This implementation uses the same-value pet from the joiner.
      The inventory update and flip completion happen inside one
      MongoDB transaction to prevent a normal double-spend/dupe.
    */

    const petIndex = joiner.inventory.findIndex(
      p => Number(p.value) === Number(flip.petValue)
    );

    if (petIndex === -1) {
      throw new Error("You need a pet of the same value to join.");
    }

    const joinerPet = joiner.inventory[petIndex];

    joiner.inventory.splice(petIndex, 1);

    const creator = await User.findOne({
      robloxId: flip.creatorId
    }).session(session);

    if (!creator) {
      throw new Error("Creator not found");
    }

    const winnerIsCreator = Math.random() < 0.5;

    const winner =
      winnerIsCreator ? creator : joiner;

    const loser =
      winnerIsCreator ? joiner : creator;

    const winnerPet =
      winnerIsCreator
        ? joinerPet
        : {
            _id: new mongoose.Types.ObjectId(),
            name: flip.petName,
            value: flip.petValue,
            image: flip.petImage || ""
          };

    const loserPet =
      winnerIsCreator
        ? {
            _id: new mongoose.Types.ObjectId(),
            name: joinerPet.name,
            value: joinerPet.value,
            image: joinerPet.image || ""
          }
        : {
            _id: new mongoose.Types.ObjectId(),
            name: flip.petName,
            value: flip.petValue,
            image: flip.petImage || ""
          };

    /*
      The winner receives BOTH stakes.
    */
    winner.inventory.push(winnerPet, loserPet);

    const wager = Number(flip.petValue) || 0;

    creator.wagered += wager;
    joiner.wagered += wager;

    if (winnerIsCreator) {
      creator.profit += wager;
      joiner.profit -= wager;
    } else {
      joiner.profit += wager;
      creator.profit -= wager;
    }

    flip.status = "completed";
    flip.opponentId = joiner.robloxId;
    flip.winnerId = winner.robloxId;
    flip.winnerUsername = winner.username;

    await creator.save({ session });
    await joiner.save({ session });
    await flip.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      result: {
        winnerId: winner.robloxId,
        winnerUsername: winner.username
      }
    });
  } catch (err) {
    await session.abortTransaction();

    res.json({
      success: false,
      message: err.message || "Unable to join flip"
    });
  } finally {
    session.endSession();
  }
});

app.post("/coinflips/bot", async (req, res) => {
  /*
    Temporary bot mode.

    It completes an active flip atomically through the same
    inventory-removal logic. It does NOT create unlimited pets.
  */

  try {
    const flip = await Coinflip.findOne({
      creatorId: Number(req.body.robloxId),
      status: "active"
    });

    if (!flip) {
      return res.json({
        success: false,
        message: "No active flip found."
      });
    }

    const user = await getUser(flip.creatorId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found."
      });
    }

    const winnerIsUser = Math.random() < 0.5;

    const botPet = {
      _id: new mongoose.Types.ObjectId(),
      name: flip.petName,
      value: flip.petValue,
      image: flip.petImage || ""
    };

    if (winnerIsUser) {
      user.inventory.push(botPet);

      user.wagered += flip.petValue;
      user.profit += flip.petValue;

      flip.winnerId = user.robloxId;
      flip.winnerUsername = user.username;
    } else {
      const removed = await removePet(
        user,
        flip.petId,
        flip.petName
      );

      if (!removed) {
        return res.json({
          success: false,
          message: "Your staked pet is no longer available."
        });
      }

      user.wagered += flip.petValue;
      user.profit -= flip.petValue;

      flip.winnerId = 0;
      flip.winnerUsername = "ADMFLIP Bot";
    }

    flip.status = "completed";

    await user.save();
    await flip.save();

    res.json({
      success: true,
      result: {
        winnerUsername: flip.winnerUsername
      }
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message || "Bot failed"
    });
  }
});

app.post("/tip", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const sender = await User.findOne({
      robloxId: Number(req.body.fromId)
    }).session(session);

    const receiver = await User.findOne({
      robloxId: Number(req.body.toId)
    }).session(session);

    if (!sender || !receiver) {
      throw new Error("User not found");
    }

    if (sender.robloxId === receiver.robloxId) {
      throw new Error("You cannot tip yourself.");
    }

    const pet = await removePet(
      sender,
      req.body.petId,
      req.body.petName
    );

    if (!pet) {
      throw new Error("Pet is no longer in your inventory.");
    }

    receiver.inventory.push({
      _id: new mongoose.Types.ObjectId(),
      name: pet.name,
      value: pet.value,
      image: pet.image || ""
    });

    await sender.save({ session });
    await receiver.save({ session });

    await session.commitTransaction();

    res.json({
      success: true
    });
  } catch (err) {
    await session.abortTransaction();

    res.json({
      success: false,
      message: err.message || "Tip failed"
    });
  } finally {
    session.endSession();
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `ADMFLIP backend running on port ${process.env.PORT || 3000}`
  );
});

/*
  Keep your Telegram bot in telegram.js if you already have it.

  IMPORTANT:
  Do not hard-code TELEGRAM_TOKEN in this file.
  Use Render environment variables instead.
*/
try {
  if (fs.existsSync("./telegram.js")) {
    require("./telegram");
    console.log("Telegram module loaded");
  }
} catch (err) {
  console.log("Telegram module error:", err.message);
}
