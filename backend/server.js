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

app.use(express.json({ limit: "100kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

// ======================================================
// MONGODB
// ======================================================

if (!process.env.MONGO_URL) {
  console.error("MONGO_URL environment variable is missing.");
}

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB error:", err.message);
  });


// ======================================================
// USER MODEL
// ======================================================

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
}, {
  _id: true
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
      default: 0,
      min: 0
    },

    wagered: {
      type: Number,
      default: 0,
      min: 0
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


// ======================================================
// SETTINGS
// ======================================================

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
    }
  })
);


// ======================================================
// CHAT
// ======================================================

const ChatMessage = mongoose.model(
  "ChatMessage",
  new mongoose.Schema({
    username: String,
    robloxId: Number,
    avatar: String,

    message: {
      type: String,
      required: true,
      maxlength: 300
    },

    type: {
      type: String,
      enum: ["message", "announcement"],
      default: "message"
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  })
);


// ======================================================
// COINFLIP
// ======================================================

const Coinflip = mongoose.model(
  "Coinflip",
  new mongoose.Schema({
    creatorId: {
      type: Number,
      required: true,
      index: true
    },

    creatorUsername: String,
    creatorAvatar: String,

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    petName: String,
    petValue: Number,
    petVariant: String,

    side: {
      type: String,
      enum: ["heads", "tails"],
      required: true
    },

    status: {
      type: String,
      enum: [
        "active",
        "joined",
        "completed",
        "cancelled"
      ],
      default: "active",
      index: true
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


// ======================================================
// PET VALUES
// ======================================================

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
      const rawValue = lines[i + 1];

      if (!name || !rawValue) continue;

      // IMPORTANT:
      // The old code used /./g which removed EVERYTHING.
      const cleanValue = rawValue
        .replace(/[^\d.-]/g, "");

      const value = Number(cleanValue);

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
      "Pet loading error:",
      error.message
    );

    return [];
  }
}

const pets = loadPets();


// ======================================================
// PET IMAGE
// ======================================================

function petImage(name) {
  if (!name) return null;

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp"
  );
}


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ADMFLIP backend is online"
  });
});


// ======================================================
// STATUS
// ======================================================

app.get("/status", async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    res.json({
      success: true,
      online: settings.siteOnline,
      announcement: settings.announcement
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      online: true,
      announcement: ""
    });
  }
});


// ======================================================
// PET VALUES
// ======================================================

app.get("/pets", (req, res) => {
  res.json({
    success: true,

    pets: pets.map(pet => ({
      id: pet.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),

      name: pet.name,
      value: pet.value,

      image: petImage(pet.name)
    }))
  });
});


// ======================================================
// ROBLOX USER LOOKUP
// ======================================================

app.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username required"
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

    if (
      !data.data ||
      !data.data.length
    ) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const user = data.data[0];

    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`
    );

    const avatarData =
      await avatarResponse.json();

    const avatar =
      avatarData.data &&
      avatarData.data[0]
        ? avatarData.data[0].imageUrl
        : "";

    // Create/update site account.
    await User.findOneAndUpdate(
      { robloxId: user.id },

      {
        $set: {
          username: user.name,
          avatar
        },

        $setOnInsert: {
          robloxId: user.id
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
        id: user.id,
        username: user.name,
        avatar
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// ======================================================
// VERIFICATION PHRASE
// ======================================================

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


app.get("/create", (req, res) => {
  res.json({
    success: true,
    phrase: generatePhrase()
  });
});


// ======================================================
// ROBLOX BIO VERIFICATION
// ======================================================

app.post("/check", async (req, res) => {
  try {
    const {
      username,
      phrase
    } = req.body;

    if (!username || !phrase) {
      return res.status(400).json({
        success: false,
        message: "Username and phrase required"
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

    if (
      !data.data ||
      !data.data.length
    ) {
      return res.json({
        success: false,
        message: "Roblox username not found"
      });
    }

    const id = data.data[0].id;

    const profileResponse =
      await fetch(
        `https://users.roblox.com/v1/users/${id}`
      );

    const profile =
      await profileResponse.json();

    if (
      profile.description &&
      profile.description.includes(phrase)
    ) {

      let avatar = "";

      try {
        const avatarResponse =
          await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
          );

        const avatarData =
          await avatarResponse.json();

        avatar =
          avatarData.data &&
          avatarData.data[0]
            ? avatarData.data[0].imageUrl
            : "";

      } catch (_) {}

      await User.findOneAndUpdate(
        { robloxId: id },

        {
          $set: {
            username: profile.name,
            avatar
          }
        },

        {
          upsert: true,
          new: true
        }
      );

      return res.json({
        success: true,
        username: profile.name,
        id: profile.id,
        avatar
      });
    }

    res.json({
      success: false,
      message: "Verification phrase not found"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
});


// ======================================================
// GET USER ACCOUNT / INVENTORY
// ======================================================

app.get("/account/:robloxId", async (req, res) => {
  try {
    const robloxId =
      Number(req.params.robloxId);

    if (!Number.isSafeInteger(robloxId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user"
      });
    }

    const user =
      await User.findOne({ robloxId })
        .lean();

    if (!user) {
      return res.json({
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

        inventory:
          (user.inventory || []).map(item => ({
            itemId: item._id,
            name: item.name,
            value: item.value,
            variant: item.variant || "",
            image: petImage(item.name)
          }))
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not load account"
    });
  }
});


// ======================================================
// ADD PET
// ======================================================
// This endpoint should be protected by your admin/bot
// authentication before exposing it publicly.

app.post("/admin/add-pet", async (req, res) => {
  try {
    const {
      robloxId,
      name,
      value,
      variant
    } = req.body;

    const id = Number(robloxId);
    const petValue = Number(value);

    if (
      !Number.isSafeInteger(id) ||
      !name ||
      !Number.isFinite(petValue)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pet data"
      });
    }

    const user =
      await User.findOneAndUpdate(
        { robloxId: id },

        {
          $push: {
            inventory: {
              name: String(name),
              value: petValue,
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
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Pet added",

      inventory:
        user.inventory
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not add pet"
    });
  }
});


// ======================================================
// REMOVE EXACT PET
// ======================================================

app.post("/admin/remove-pet", async (req, res) => {
  try {
    const {
      robloxId,
      itemId
    } = req.body;

    const id = Number(robloxId);

    if (
      !Number.isSafeInteger(id) ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    const user =
      await User.findOneAndUpdate(

        {
          robloxId: id,

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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Pet not found"
      });
    }

    res.json({
      success: true,
      message: "Pet removed",

      inventory:
        user.inventory
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not remove pet"
    });
  }
});


// ======================================================
// TRANSFER EXACT PET
// ======================================================

app.post("/admin/transfer-pet", async (req, res) => {
  const session =
    await mongoose.startSession();

  try {
    const {
      fromUserId,
      toUserId,
      itemId
    } = req.body;

    const fromId =
      Number(fromUserId);

    const toId =
      Number(toUserId);

    if (
      !Number.isSafeInteger(fromId) ||
      !Number.isSafeInteger(toId) ||
      !mongoose.isValidObjectId(itemId) ||
      fromId === toId
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer"
      });
    }

    session.startTransaction();

    // Atomically remove EXACTLY this item.
    const sender =
      await User.findOneAndUpdate(

        {
          robloxId: fromId,

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
          new: true,
          session
        }
      );

    if (!sender) {
      throw new Error(
        "Pet does not exist in sender inventory"
      );
    }

    // Get the item that was removed.
    // We need its real value/name, not browser data.
    const removedItem =
      sender.inventory;

    // Because the item has already been pulled,
    // retrieve the original item from a snapshot
    // before removal using a separate lookup is not possible.
    //
    // Therefore this route uses an atomic conditional
    // update below with a transaction-safe read.
    //
    // Roll back this transaction and use the safer
    // implementation below.
    await session.abortTransaction();

    // Safer transaction implementation.
    session.startTransaction();

    const originalSender =
      await User.findOne(
        {
          robloxId: fromId,
          "inventory._id": itemId
        }
      ).session(session);

    if (!originalSender) {
      throw new Error(
        "Pet not found"
      );
    }

    const item =
      originalSender.inventory.id(itemId);

    if (!item) {
      throw new Error(
        "Pet not found"
      );
    }

    const transferredPet = {
      name: item.name,
      value: item.value,
      variant: item.variant || ""
    };

    const removed =
      await User.findOneAndUpdate(

        {
          robloxId: fromId,
          "inventory._id": itemId
        },

        {
          $pull: {
            inventory: {
              _id: itemId
            }
          }
        },

        {
          new: true,
          session
        }
      );

    if (!removed) {
      throw new Error(
        "Pet could not be removed"
      );
    }

    const receiver =
      await User.findOneAndUpdate(

        {
          robloxId: toId
        },

        {
          $push: {
            inventory: transferredPet
          }
        },

        {
          new: true,
          session
        }
      );

    if (!receiver) {
      throw new Error(
        "Receiver not found"
      );
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Pet transferred"
    });

  } catch (error) {

    try {
      await session.abortTransaction();
    } catch (_) {}

    console.error(
      "Transfer error:",
      error.message
    );

    res.status(400).json({
      success: false,
      message: error.message
    });

  } finally {
    await session.endSession();
  }
});


// ======================================================
// CHAT GET
// ======================================================

app.get("/chat/messages", async (req, res) => {
  try {
    const messages =
      await ChatMessage.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    res.json({
      success: true,

      messages:
        messages.reverse()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      messages: []
    });
  }
});


// ======================================================
// CHAT SEND
// ======================================================

function containsLink(text) {
  const linkRegex =
    /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|\.com\b|\.net\b|\.gg\b|\.org\b)/i;

  return linkRegex.test(text);
}


app.post("/chat/messages", async (req, res) => {
  try {
    const {
      robloxId,
      username,
      avatar,
      message
    } = req.body;

    if (!username || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing message"
      });
    }

    const clean =
      String(message)
        .replace(/[<>]/g, "")
        .trim();

    if (!clean) {
      return res.status(400).json({
        success: false,
        message: "Empty message"
      });
    }

    if (clean.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Message too long"
      });
    }

    if (containsLink(clean)) {
      return res.status(400).json({
        success: false,
        message: "Links are not allowed"
      });
    }

    const newMessage =
      await ChatMessage.create({
        username,
        robloxId:
          Number(robloxId) || 0,
        avatar: avatar || "",
        message: clean,
        type: "message"
      });

    res.json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not send message"
    });
  }
});


// ======================================================
// ACTIVE COINFLIPS
// ======================================================

app.get("/coinflips", async (req, res) => {
  try {
    const flips =
      await Coinflip.find({
        status: "active"
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,

      coinflips:
        flips.map(flip => ({
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

          image:
            petImage(flip.petName),

          side:
            flip.side
        }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      coinflips: []
    });
  }
});


// ======================================================
// CREATE COINFLIP
// ======================================================

app.post("/coinflips", async (req, res) => {
  try {
    const {
      robloxId,
      side,
      itemId
    } = req.body;

    const userId =
      Number(robloxId);

    if (
      !Number.isSafeInteger(userId) ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    if (
      side !== "heads" &&
      side !== "tails"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid side"
      });
    }

    // IMPORTANT:
    // Never accept pet name/value from frontend.
    // Get the actual item from MongoDB.
    const user =
      await User.findOne({
        robloxId: userId
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const item =
      user.inventory.id(itemId);

    if (!item) {
      return res.status(400).json({
        success: false,
        message: "Pet is not in your inventory"
      });
    }

    // Remove the exact pet FIRST.
    const lockedUser =
      await User.findOneAndUpdate(

        {
          robloxId: userId,
          "inventory._id": itemId
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

    if (!lockedUser) {
      return res.status(409).json({
        success: false,
        message: "Pet is already being used"
      });
    }

    const flip =
      await Coinflip.create({
        creatorId: userId,

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

        status: "active"
      });

    res.json({
      success: true,

      coinflip: {
        id: flip._id,

        petName:
          flip.petName,

        petValue:
          flip.petValue,

        variant:
          flip.petVariant,

        image:
          petImage(flip.petName),

        side:
          flip.side
      }
    });

  } catch (error) {
    console.error(
      "Coinflip create:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Could not create coinflip"
    });
  }
});


// ======================================================
// JOIN COINFLIP
// ======================================================

app.post("/coinflips/:id/join", async (req, res) => {
  const session =
    await mongoose.startSession();

  try {
    const {
      robloxId,
      itemId
    } = req.body;

    const userId =
      Number(robloxId);

    if (
      !Number.isSafeInteger(userId) ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    session.startTransaction();

    // Lock the active coinflip.
    const flip =
      await Coinflip.findOne({
        _id: req.params.id,
        status: "active"
      }).session(session);

    if (!flip) {
      throw new Error(
        "Coinflip is no longer available"
      );
    }

    if (flip.creatorId === userId) {
      throw new Error(
        "You cannot join your own coinflip"
      );
    }

    const user =
      await User.findOne({
        robloxId: userId
      }).session(session);

    if (!user) {
      throw new Error(
        "User not found"
      );
    }

    const item =
      user.inventory.id(itemId);

    if (!item) {
      throw new Error(
        "Pet is not in your inventory"
      );
    }

    // For this example the joining pet must
    // match the creator's pet value.
    if (Number(item.value) !== Number(flip.petValue)) {
      throw new Error(
        "Pet value does not match"
      );
    }

    // Remove joiner's exact item.
    const removed =
      await User.findOneAndUpdate(

        {
          robloxId: userId,
          "inventory._id": itemId
        },

        {
          $pull: {
            inventory: {
              _id: itemId
            }
          }
        },

        {
          new: true,
          session
        }
      );

    if (!removed) {
      throw new Error(
        "Pet could not be locked"
      );
    }

    flip.status = "joined";
    flip.joinerId = userId;
    flip.joinerUsername =
      user.username;
    flip.joinerAvatar =
      user.avatar;

    await flip.save({
      session
    });

    // Server-side winner.
    const winnerSide =
      crypto.randomInt(0, 2) === 0
        ? flip.side
        : (
            flip.side === "heads"
              ? "tails"
              : "heads"
          );

    const creatorWins =
      winnerSide === flip.side;

    const winnerId =
      creatorWins
        ? flip.creatorId
        : userId;

    flip.winnerId = winnerId;
    flip.status = "completed";
    flip.completedAt = new Date();

    await flip.save({
      session
    });

    // Winner receives BOTH pets.
    await User.findOneAndUpdate(
      {
        robloxId: winnerId
      },

      {
        $push: {
          inventory: {
            name: flip.petName,
            value: flip.petValue,
            variant:
              flip.petVariant || ""
          }
        },

        $inc: {
          wagered:
            Number(flip.petValue) * 2
        }
      },

      {
        session
      }
    );

    // Winner also receives the joiner's pet.
    await User.findOneAndUpdate(
      {
        robloxId: winnerId
      },

      {
        $push: {
          inventory: {
            name: item.name,
            value: item.value,
            variant:
              item.variant || ""
          }
        }
      },

      {
        session
      }
    );

    // Loser wager tracking.
    const loserId =
      creatorWins
        ? userId
        : flip.creatorId;

    await User.findOneAndUpdate(
      {
        robloxId: loserId
      },

      {
        $inc: {
          wagered:
            Number(flip.petValue) * 2,

          profit:
            -Number(flip.petValue)
        }
      },

      {
        session
      }
    );

    await session.commitTransaction();

    res.json({
      success: true,

      winnerId,

      winnerSide,

      creatorSide:
        flip.side,

      coinflipId:
        flip._id
    });

  } catch (error) {

    try {
      await session.abortTransaction();
    } catch (_) {}

    console.error(
      "Join coinflip:",
      error.message
    );

    res.status(400).json({
      success: false,
      message: error.message
    });

  } finally {
    await session.endSession();
  }
});


// ======================================================
// CANCEL COINFLIP
// ======================================================

app.post("/coinflips/:id/cancel", async (req, res) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      Number(req.body.robloxId);

    session.startTransaction();

    const flip =
      await Coinflip.findOne({
        _id: req.params.id,
        creatorId: userId,
        status: "active"
      }).session(session);

    if (!flip) {
      throw new Error(
        "Coinflip not found"
      );
    }

    // Return the locked creator pet.
    await User.findOneAndUpdate(
      {
        robloxId:
          flip.creatorId
      },

      {
        $push: {
          inventory: {
            name: flip.petName,
            value: flip.petValue,
            variant:
              flip.petVariant || ""
          }
        }
      },

      {
        session
      }
    );

    flip.status = "cancelled";

    await flip.save({
      session
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Coinflip cancelled"
    });

  } catch (error) {

    try {
      await session.abortTransaction();
    } catch (_) {}

    res.status(400).json({
      success: false,
      message: error.message
    });

  } finally {
    await session.endSession();
  }
});


// ======================================================
// TOP FLIPPERS
// ======================================================

app.get("/leaderboard", async (req, res) => {
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
        users.map((user, index) => ({
          place: index + 1,

          username:
            user.username,

          avatar:
            user.avatar,

          wagered:
            user.wagered || 0,

          profit:
            user.profit || 0
        }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      users: []
    });
  }
});


// ======================================================
// CHAT ONLINE COUNT
// ======================================================

app.get("/chat/online", async (req, res) => {
  res.json({
    success: true,

    // UI-only approximate counter.
    // It is deliberately not treated as real authentication.
    online:
      Math.floor(
        20 +
        Math.random() * 26
      )
  });
});


// ======================================================
// TELEGRAM
// ======================================================

try {
  require("./telegram");
  console.log("Telegram module loaded");
} catch (error) {
  console.log(
    "Telegram module not loaded:",
    error.message
  );
}


// ======================================================
// START
// ======================================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `ADMFLIP backend running on port ${PORT}`
  );
});
