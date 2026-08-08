const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");

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
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));


/* =========================
   ENV
========================= */

const MONGO_URL =
  process.env.MONGO_URL;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "CHANGE_ME_JWT_SECRET";

const ADMIN_SECRET =
  process.env.ADMIN_SECRET ||
  "CHANGE_ME_ADMIN_SECRET";


if (!MONGO_URL) {
  console.error("MONGO_URL is missing.");
}


/* =========================
   DATABASE
========================= */

mongoose.set(
  "strictQuery",
  true
);

mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(error => {
    console.error(
      "MongoDB error:",
      error.message
    );
  });


/* =========================
   PET VALUES
========================= */

function loadPets() {

  try {

    const text =
      fs.readFileSync(
        "./values.txt",
        "utf8"
      );

    const lines =
      text
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

    const pets = [];

    for (
      let i = 0;
      i < lines.length;
      i += 2
    ) {

      const name = lines[i];
      let value = lines[i + 1];

      if (!name || !value) {
        continue;
      }

      value = value
        .replace(/[$,\s]/g, "")
        .replace(/[^\d.-]/g, "");

      const numericValue =
        Number(value);

      if (!Number.isFinite(numericValue)) {
        continue;
      }

      pets.push({
        id: crypto
          .createHash("sha1")
          .update(name.toLowerCase())
          .digest("hex")
          .slice(0, 16),

        name,

        value: numericValue,

        rarity: "",

        image:
          `https://amvgg.com/items/${encodeURIComponent(
            name
          )}.webp`
      });
    }

    console.log(
      "Loaded pets:",
      pets.length
    );

    return pets;

  } catch (error) {

    console.error(
      "Pet loading error:",
      error.message
    );

    return [];
  }
}

const pets = loadPets();


function getPetByName(name) {

  return pets.find(
    pet =>
      pet.name.toLowerCase() ===
      String(name).toLowerCase()
  );
}


/* =========================
   SCHEMAS
========================= */

const inventorySchema =
  new mongoose.Schema({

    itemId: {
      type: String,
      required: true
    },

    petId: String,

    name: String,

    value: {
      type: Number,
      default: 0
    },

    rarity: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: ""
    },

    variants: {
      type: [String],
      default: []
    },

    locked: {
      type: Boolean,
      default: false
    }

  }, {
    _id: false
  });


const User =
  mongoose.model(
    "User",
    new mongoose.Schema({

      robloxId: {
        type: Number,
        unique: true,
        index: true
      },

      username: String,

      avatar: String,

      balance: {
        type: Number,
        default: 0
      },

      inventory: {
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
      },

      createdAt: {
        type: Date,
        default: Date.now
      }

    })
  );


const ChatMessage =
  mongoose.model(
    "ChatMessage",
    new mongoose.Schema({

      robloxId: Number,

      username: String,

      avatar: String,

      text: String,

      createdAt: {
        type: Date,
        default: Date.now,
        index: true
      }

    })
  );


const Coinflip =
  mongoose.model(
    "Coinflip",
    new mongoose.Schema({

      creatorRobloxId: Number,

      creatorUsername: String,

      creatorAvatar: String,

      creatorItemId: String,

      creatorPet: Object,

      creatorSide: {
        type: String,
        enum: ["H", "T"]
      },

      joinerRobloxId: {
        type: Number,
        default: null
      },

      joinerUsername: {
        type: String,
        default: null
      },

      joinerAvatar: {
        type: String,
        default: null
      },

      joinerItemId: {
        type: String,
        default: null
      },

      joinerPet: {
        type: Object,
        default: null
      },

      result: {
        type: String,
        default: null
      },

      winnerRobloxId: {
        type: Number,
        default: null
      },

      status: {
        type: String,
        enum: [
          "active",
          "flipping",
          "completed",
          "cancelled"
        ],
        default: "active",
        index: true
      },

      createdAt: {
        type: Date,
        default: Date.now
      },

      completedAt: Date

    })
  );


/* =========================
   SETTINGS
========================= */

const Settings =
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
      }

    })
  );


/* =========================
   AUTH
========================= */

function makeToken(user) {

  return jwt.sign(
    {
      robloxId: user.robloxId
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}


async function requireAuth(
  req,
  res,
  next
) {

  try {

    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {

      return res.status(401).json({
        success: false,
        message: "Please sign in first."
      });
    }

    const token =
      header.slice(7);

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    const user =
      await User.findOne({
        robloxId:
          decoded.robloxId
      });

    if (!user) {

      return res.status(401).json({
        success: false,
        message: "Account not found."
      });
    }

    req.user = user;

    next();

  } catch {

    return res.status(401).json({
      success: false,
      message: "Session expired. Sign in again."
    });
  }
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

  res.send(
    "ADMFLIP backend is online"
  );
});


/* =========================
   STATUS
========================= */

app.get(
  "/status",
  async (req, res) => {

    try {

      let settings =
        await Settings.findOne();

      if (!settings) {
        settings =
          await Settings.create({});
      }

      res.json({
        online:
          settings.siteOnline,

        announcement:
          settings.announcement
      });

    } catch {

      res.json({
        online: true,
        announcement: ""
      });
    }
  }
);


/* =========================
   PETS
========================= */

app.get(
  "/pets",
  (req, res) => {

    res.json({
      success: true,
      pets
    });
  }
);


/* =========================
   ROBLOX USER
========================= */

app.get(
  "/user/:username",
  async (req, res) => {

    try {

      const username =
        req.params.username;

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

      const user =
        data.data[0];

      const avatarResponse =
        await fetch(
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
            avatarData?.data?.[0]?.imageUrl ||
            "roblox.png"
        }

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
);


/* =========================
   CREATE PHRASE
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


app.get(
  "/create",
  (req, res) => {

    res.json({
      phrase:
        generatePhrase()
    });
  }
);


/* =========================
   VERIFY BIO
========================= */

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
            "Username and phrase are required."
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

      if (
        !profile.description ||
        !profile.description.includes(
          phrase
        )
      ) {

        return res.json({
          success: false,
          message:
            "Verification phrase not found"
        });
      }

      const avatarResponse =
        await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
        );

      const avatarData =
        await avatarResponse.json();

      const avatar =
        avatarData?.data?.[0]?.imageUrl ||
        "roblox.png";

      const user =
        await User.findOneAndUpdate(

          {
            robloxId: id
          },

          {
            $set: {
              username:
                profile.name,

              avatar
            }
          },

          {
            new: true,
            upsert: true
          }
        );

      const token =
        makeToken(user);

      res.json({

        success: true,

        token,

        user: {

          id: user.robloxId,

          username:
            user.username,

          avatar:
            user.avatar
        }

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Verification failed"
      });
    }
  }
);


/* =========================
   ME
========================= */

app.get(
  "/me",
  requireAuth,
  async (req, res) => {

    res.json({
      success: true,

      user: {
        id:
          req.user.robloxId,

        username:
          req.user.username,

        avatar:
          req.user.avatar,

        balance:
          req.user.balance,

        wagered:
          req.user.wagered,

        profit:
          req.user.profit
      }
    });
  }
);


/* =========================
   INVENTORY
========================= */

function normalizeInventoryItem(item) {

  const pet =
    getPetByName(item.name);

  return {

    itemId:
      item.itemId ||
      crypto.randomUUID(),

    petId:
      item.petId ||
      pet?.id ||
      "",

    name:
      item.name,

    value:
      Number(
        item.value ??
        pet?.value ??
        0
      ),

    rarity:
      item.rarity ||
      pet?.rarity ||
      "",

    image:
      item.image ||
      pet?.image ||
      `https://amvgg.com/items/${encodeURIComponent(
        item.name
      )}.webp`,

    variants:
      Array.isArray(item.variants)
        ? item.variants
        : [],

    locked:
      Boolean(item.locked)
  };
}


app.get(
  "/inventory",
  requireAuth,
  async (req, res) => {

    let changed = false;

    const inventory =
      req.user.inventory.map(item => {

        const normalized =
          normalizeInventoryItem(item);

        if (!item.itemId) {
          changed = true;
        }

        return normalized;
      });

    if (changed) {

      req.user.inventory =
        inventory;

      await req.user.save();
    }

    const totalValue =
      inventory.reduce(
        (sum, item) =>
          sum + Number(item.value || 0),
        0
      );

    res.json({
      success: true,
      inventory,
      totalValue
    });
  }
);


/* =========================
   CHAT
========================= */

const LINK_REGEX =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|gg|io|xyz|co|me|tv|dev|site|app)\b)/i;


app.get(
  "/chat",
  async (req, res) => {

    const messages =
      await ChatMessage
        .find()
        .sort({
          createdAt: -1
        })
        .limit(100)
        .lean();

    messages.reverse();

    res.json({
      success: true,
      messages
    });
  }
);


app.post(
  "/chat",
  requireAuth,
  async (req, res) => {

    const text =
      String(
        req.body.text || ""
      ).trim();

    if (!text) {

      return res.status(400).json({
        message:
          "Message cannot be empty."
      });
    }

    if (text.length > 300) {

      return res.status(400).json({
        message:
          "Message is too long."
      });
    }

    if (LINK_REGEX.test(text)) {

      return res.status(400).json({
        message:
          "Links are not allowed in chat."
      });
    }

    const message =
      await ChatMessage.create({

        robloxId:
          req.user.robloxId,

        username:
          req.user.username,

        avatar:
          req.user.avatar,

        text
      });

    res.json({
      success: true,
      message
    });
  }
);


/* =========================
   LEADERBOARD
========================= */

app.get(
  "/leaderboard",
  async (req, res) => {

    const players =
      await User.find()
        .sort({
          wagered: -1
        })
        .limit(10)
        .select(
          "robloxId username avatar wagered"
        )
        .lean();

    res.json({
      success: true,
      players
    });
  }
);


/* =========================
   USER PROFILE
========================= */

app.get(
  "/users/:robloxId",
  async (req, res) => {

    const id =
      Number(
        req.params.robloxId
      );

    if (!Number.isFinite(id)) {

      return res.status(400).json({
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
        message:
          "User not found."
      });
    }

    res.json({

      success: true,

      user: {

        robloxId:
          user.robloxId,

        username:
          user.username,

        avatar:
          user.avatar,

        wagered:
          user.wagered || 0,

        profit:
          user.profit || 0
      }
    });
  }
);


/* =========================
   COINFLIPS
========================= */

app.get(
  "/coinflips",
  async (req, res) => {

    const coinflips =
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
      coinflips
    });
  }
);


/* =========================
   CREATE COINFLIP
========================= */

app.post(
  "/coinflips",
  requireAuth,
  async (req, res) => {

    const {
      itemId,
      side
    } = req.body;

    if (
      !itemId ||
      !["H", "T"].includes(side)
    ) {

      return res.status(400).json({
        message:
          "Pet and side are required."
      });
    }

    /*
      Atomic inventory update.

      The item is removed from the user's
      available inventory BEFORE the coinflip
      is created.

      This means refreshing or sending the
      request twice cannot create two wagers
      from the same pet.
    */

    const user =
      await User.findOneAndUpdate(

        {
          _id: req.user._id,

          inventory: {
            $elemMatch: {
              itemId,
              locked: {
                $ne: true
              }
            }
          }
        },

        {
          $set: {
            "inventory.$.locked": true
          }
        },

        {
          new: true
        }
      );

    if (!user) {

      return res.status(409).json({
        message:
          "That pet is unavailable or already being used."
      });
    }

    const item =
      user.inventory.find(
        x =>
          x.itemId === itemId
      );

    if (!item) {

      return res.status(409).json({
        message:
          "Pet no longer exists."
      });
    }

    try {

      const coinflip =
        await Coinflip.create({

          creatorRobloxId:
            user.robloxId,

          creatorUsername:
            user.username,

          creatorAvatar:
            user.avatar,

          creatorItemId:
            item.itemId,

          creatorPet:
            normalizeInventoryItem(
              item
            ),

          creatorSide:
            side,

          status:
            "active"
        });

      res.json({
        success: true,
        coinflip
      });

    } catch (error) {

      /*
        If creating the coinflip failed,
        unlock the item.
      */

      await User.updateOne(
        {
          _id: user._id,

          "inventory.itemId":
            itemId
        },

        {
          $set: {
            "inventory.$.locked":
              false
          }
        }
      );

      throw error;
    }
  }
);


/* =========================
   JOIN COINFLIP
========================= */

app.post(
  "/coinflips/:id/join",
  requireAuth,
  async (req, res) => {

    const session =
      await mongoose.startSession();

    try {

      let result = null;

      await session.withTransaction(
        async () => {

          const coinflip =
            await Coinflip.findOneAndUpdate(

              {
                _id:
                  req.params.id,

                status:
                  "active",

                creatorRobloxId: {
                  $ne:
                    req.user.robloxId
                }
              },

              {
                $set: {
                  status:
                    "flipping",

                  joinerRobloxId:
                    req.user.robloxId,

                  joinerUsername:
                    req.user.username,

                  joinerAvatar:
                    req.user.avatar
                }
              },

              {
                new: true,
                session
              }
            );

          if (!coinflip) {

            throw new Error(
              "Coinflip is no longer available."
            );
          }

          /*
            Choose a pet from the joining user's
            inventory.

            The joiner can only join with one
            unlocked pet of theirs.

            For this endpoint we use the first
            available pet. The production UI can
            be expanded into a join-pet selector.
          */

          const joiner =
            await User.findOne(
              {
                robloxId:
                  req.user.robloxId
              }
            ).session(session);

          const joinerPet =
            joiner.inventory.find(
              x =>
                x.locked !== true
            );

          if (!joinerPet) {

            throw new Error(
              "You need an available pet to join."
            );
          }

          joinerPet.locked = true;

          coinflip.joinerItemId =
            joinerPet.itemId;

          coinflip.joinerPet =
            normalizeInventoryItem(
              joinerPet
            );

          /*
            Crypto randomness is generated on
            the server, not in the browser.
          */

          const random =
            crypto.randomInt(0, 2);

          const resultSide =
            random === 0
              ? "H"
              : "T";

          coinflip.result =
            resultSide;

          const creatorWon =
            coinflip.creatorSide ===
            resultSide;

          const winnerId =
            creatorWon
              ? coinflip.creatorRobloxId
              : coinflip.joinerRobloxId;

          const loserId =
            creatorWon
              ? coinflip.joinerRobloxId
              : coinflip.creatorRobloxId;

          const winnerPet =
            creatorWon
              ? coinflip.creatorPet
              : coinflip.joinerPet;

          const loserPet =
            creatorWon
              ? coinflip.joinerPet
              : coinflip.creatorPet;

          /*
            Remove both locked wager items.

            itemId is matched exactly so another
            pet cannot accidentally be removed.
          */

          const loserUpdate =
            await User.updateOne(

              {
                robloxId:
                  loserId,

                inventory: {
                  $elemMatch: {
                    itemId:
                      loserPet.itemId,

                    locked: true
                  }
                }
              },

              {
                $pull: {
                  inventory: {
                    itemId:
                      loserPet.itemId
                  }
                },

                $inc: {
                  wagered:
                    Number(
                      loserPet.value || 0
                    )
                }
              },

              {
                session
              }
            );

          if (
            loserUpdate.modifiedCount !==
            1
          ) {

            throw new Error(
              "Loser's pet could not be locked."
            );
          }

          const winnerUpdate =
            await User.updateOne(

              {
                robloxId:
                  winnerId,

                inventory: {
                  $elemMatch: {
                    itemId:
                      winnerPet.itemId,

                    locked: true
                  }
                }
              },

              {
                $pull: {
                  inventory: {
                    itemId:
                      winnerPet.itemId
                  }
                },

                $inc: {
                  wagered:
                    Number(
                      winnerPet.value || 0
                    ),

                  profit:
                    Number(
                      loserPet.value || 0
                    )
                }
              },

              {
                session
              }
            );

          if (
            winnerUpdate.modifiedCount !==
            1
          ) {

            throw new Error(
              "Winner's pet could not be transferred."
            );
          }

          /*
            Winner receives the loser's pet.
          */

          const winner =
            await User.findOne({
              robloxId:
                winnerId
            }).session(session);

          const wonPet =
            normalizeInventoryItem(
              loserPet
            );

          wonPet.itemId =
            crypto.randomUUID();

          wonPet.locked =
            false;

          winner.inventory.push(
            wonPet
          );

          await winner.save({
            session
          });

          coinflip.winnerRobloxId =
            winnerId;

          coinflip.status =
            "completed";

          coinflip.completedAt =
            new Date();

          await coinflip.save({
            session
          });

          result = {

            result:
              resultSide,

            winnerRobloxId:
              winnerId,

            winnerUsername:
              creatorWon
                ? coinflip.creatorUsername
                : coinflip.joinerUsername,

            petName:
              loserPet.name
          };
        }
      );

      res.json({
        success: true,
        result
      });

    } catch (error) {

      res.status(409).json({
        success: false,
        message:
          error.message
      });

    } finally {

      await session.endSession();
    }
  }
);


/* =========================
   CALL BOT
========================= */

app.post(
  "/coinflips/:id/bot",
  requireAuth,
  async (req, res) => {

    const session =
      await mongoose.startSession();

    try {

      let result = null;

      await session.withTransaction(
        async () => {

          const coinflip =
            await Coinflip.findOne({
              _id:
                req.params.id,

              creatorRobloxId:
                req.user.robloxId,

              status:
                "active"
            }).session(session);

          if (!coinflip) {

            throw new Error(
              "Coinflip is no longer active."
            );
          }

          const creator =
            await User.findOne({
              robloxId:
                req.user.robloxId
            }).session(session);

          const creatorPet =
            creator.inventory.find(
              x =>
                x.itemId ===
                coinflip.creatorItemId &&
                x.locked === true
            );

          if (!creatorPet) {

            throw new Error(
              "Wagered pet is unavailable."
            );
          }

          const botPet = {
            itemId:
              crypto.randomUUID(),

            petId:
              "admflip-bot",

            name:
              "ADMFLIP Bot Pet",

            value:
              Number(
                creatorPet.value || 0
              ),

            rarity:
              "Bot",

            image:
              creatorPet.image,

            variants:
              creatorPet.variants || [],

            locked:
              true
          };

          coinflip.joinerRobloxId =
            0;

          coinflip.joinerUsername =
            "ADMFLIP Bot";

          coinflip.joinerAvatar =
            "logo.png";

          coinflip.joinerItemId =
            botPet.itemId;

          coinflip.joinerPet =
            botPet;

          coinflip.status =
            "flipping";

          coinflip.result =
            crypto.randomInt(0, 2) === 0
              ? "H"
              : "T";

          const creatorWon =
            coinflip.creatorSide ===
            coinflip.result;

          if (!creatorWon) {

            /*
              Bot wins. In this temporary mode,
              the bot's matching pet is effectively
              replaced by the creator's wagered pet,
              then the creator's wager is removed.
            */

            await User.updateOne(

              {
                robloxId:
                  creator.robloxId,

                inventory: {
                  $elemMatch: {
                    itemId:
                      creatorPet.itemId,

                    locked: true
                  }
                }
              },

              {
                $pull: {
                  inventory: {
                    itemId:
                      creatorPet.itemId
                  }
                },

                $inc: {
                  wagered:
                    Number(
                      creatorPet.value
                    )
                }
              },

              {
                session
              }
            );

          }

          if (creatorWon) {

            /*
              The bot loses its matching virtual
              wager and creator keeps their pet.
              No duplicate pet is created.
            */

            await User.updateOne(

              {
                robloxId:
                  creator.robloxId
              },

              {
                $set: {
                  "inventory.$[item].locked":
                    false
                },

                $inc: {
                  wagered:
                    Number(
                      creatorPet.value
                    ),

                  profit:
                    Number(
                      creatorPet.value
                    )
                }
              },

              {
                arrayFilters: [
                  {
                    "item.itemId":
                      creatorPet.itemId
                  }
                ],

                session
              }
            );
          }

          coinflip.winnerRobloxId =
            creatorWon
              ? creator.robloxId
              : 0;

          coinflip.status =
            "completed";

          coinflip.completedAt =
            new Date();

          await coinflip.save({
            session
          });

          result = {

            result:
              coinflip.result,

            winnerUsername:
              creatorWon
                ? creator.username
                : "ADMFLIP Bot",

            petName:
              creatorPet.name
          };
        }
      );

      res.json({
        success: true,
        result
      });

    } catch (error) {

      res.status(409).json({
        success: false,
        message:
          error.message
      });

    } finally {

      await session.endSession();
    }
  }
);


/* =========================
   SINGLE COINFLIP
========================= */

app.get(
  "/coinflips/:id",
  async (req, res) => {

    const coinflip =
      await Coinflip.findById(
        req.params.id
      ).lean();

    if (!coinflip) {

      return res.status(404).json({
        message:
          "Coinflip not found."
      });
    }

    res.json({
      success: true,
      coinflip
    });
  }
);


/* =========================
   TIP
========================= */

app.post(
  "/tip",
  requireAuth,
  async (req, res) => {

    const {
      recipientRobloxId,
      itemId
    } = req.body;

    if (
      !recipientRobloxId ||
      !itemId
    ) {

      return res.status(400).json({
        message:
          "Recipient and pet are required."
      });
    }

    if (
      Number(recipientRobloxId) ===
      Number(req.user.robloxId)
    ) {

      return res.status(400).json({
        message:
          "You cannot tip yourself."
      });
    }

    const session =
      await mongoose.startSession();

    try {

      await session.withTransaction(
        async () => {

          const sender =
            await User.findOneAndUpdate(

              {
                _id:
                  req.user._id,

                inventory: {
                  $elemMatch: {
                    itemId,

                    locked: {
                      $ne: true
                    }
                  }
                }
              },

              {
                $pull: {
                  inventory: {
                    itemId
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
              "Pet is unavailable."
            );
          }

          const receiver =
            await User.findOne({
              robloxId:
                Number(
                  recipientRobloxId
                )
            }).session(session);

          if (!receiver) {

            throw new Error(
              "Recipient not found."
            );
          }

          const pet =
            req.user.inventory.find(
              x =>
                x.itemId ===
                itemId
            );

          if (!pet) {

            throw new Error(
              "Pet could not be found."
            );
          }

          const newPet =
            normalizeInventoryItem(
              pet
            );

          newPet.itemId =
            crypto.randomUUID();

          newPet.locked =
            false;

          receiver.inventory.push(
            newPet
          );

          await receiver.save({
            session
          });
        }
      );

      res.json({
        success: true
      });

    } catch (error) {

      res.status(409).json({
        success: false,
        message:
          error.message
      });

    } finally {

      await session.endSession();
    }
  }
);


/* =========================
   ADMIN AUTH
========================= */

function requireAdmin(
  req,
  res,
  next
) {

  const secret =
    req.headers["x-admin-secret"];

  if (
    !secret ||
    secret !== ADMIN_SECRET
  ) {

    return res.status(403).json({
      message:
        "Admin access denied."
    });
  }

  next();
}


/* =========================
   ADMIN: BALANCE
========================= */

app.post(
  "/admin/balance",
  requireAdmin,
  async (req, res) => {

    const {
      robloxId,
      amount
    } = req.body;

    const user =
      await User.findOneAndUpdate(

        {
          robloxId:
            Number(robloxId)
        },

        {
          $inc: {
            balance:
              Number(amount)
          }
        },

        {
          new: true
        }
      );

    if (!user) {

      return res.status(404).json({
        message:
          "User not found."
      });
    }

    res.json({
      success: true,
      balance:
        user.balance
    });
  }
);


/* =========================
   ADMIN: ADD PET
========================= */

app.post(
  "/admin/pet/add",
  requireAdmin,
  async (req, res) => {

    const {
      robloxId,
      name,
      variants = []
    } = req.body;

    const pet =
      getPetByName(name);

    if (!pet) {

      return res.status(404).json({
        message:
          "Pet does not exist in values.txt."
      });
    }

    const user =
      await User.findOne({
        robloxId:
          Number(robloxId)
      });

    if (!user) {

      return res.status(404).json({
        message:
          "User not found."
      });
    }

    user.inventory.push({

      itemId:
        crypto.randomUUID(),

      petId:
        pet.id,

      name:
        pet.name,

      value:
        pet.value,

      rarity:
        pet.rarity,

      image:
        pet.image,

      variants:
        Array.isArray(variants)
          ? variants
          : [],

      locked:
        false
    });

    await user.save();

    res.json({
      success: true
    });
  }
);


/* =========================
   ADMIN: REMOVE PET
========================= */

app.post(
  "/admin/pet/remove",
  requireAdmin,
  async (req, res) => {

    const {
      robloxId,
      itemId
    } = req.body;

    const result =
      await User.updateOne(

        {
          robloxId:
            Number(robloxId),

          inventory: {
            $elemMatch: {
              itemId,
              locked: {
                $ne: true
              }
            }
          }
        },

        {
          $pull: {
            inventory: {
              itemId
            }
          }
        }
      );

    if (
      result.modifiedCount !==
      1
    ) {

      return res.status(409).json({
        message:
          "Pet not found or locked."
      });
    }

    res.json({
      success: true
    });
  }
);


/* =========================
   ADMIN: TRANSFER PET
========================= */

app.post(
  "/admin/pet/transfer",
  requireAdmin,
  async (req, res) => {

    const {
      fromRobloxId,
      toRobloxId,
      itemId
    } = req.body;

    if (
      Number(fromRobloxId) ===
      Number(toRobloxId)
    ) {

      return res.status(400).json({
        message:
          "Sender and receiver must be different."
      });
    }

    const session =
      await mongoose.startSession();

    try {

      await session.withTransaction(
        async () => {

          const sender =
            await User.findOneAndUpdate(

              {
                robloxId:
                  Number(fromRobloxId),

                inventory: {
                  $elemMatch: {
                    itemId,

                    locked: {
                      $ne: true
                    }
                  }
                }
              },

              {
                $pull: {
                  inventory: {
                    itemId
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
              "Sender does not own that available pet."
            );
          }

          const receiver =
            await User.findOne({
              robloxId:
                Number(toRobloxId)
            }).session(session);

          if (!receiver) {

            throw new Error(
              "Receiver not found."
            );
          }

          /*
            Find the removed item from the
            original sender snapshot.
          */

          const pet =
            req.body.pet;

          if (!pet) {

            throw new Error(
              "Pet transfer payload missing."
            );
          }

          const transferred =
            normalizeInventoryItem(
              pet
            );

          transferred.itemId =
            crypto.randomUUID();

          transferred.locked =
            false;

          receiver.inventory.push(
            transferred
          );

          await receiver.save({
            session
          });
        }
      );

      res.json({
        success: true
      });

    } catch (error) {

      res.status(409).json({
        success: false,
        message:
          error.message
      });

    } finally {

      await session.endSession();
    }
  }
);


/* =========================
   ADMIN: SITE
========================= */

app.post(
  "/admin/site",
  requireAdmin,
  async (req, res) => {

    const {
      online,
      announcement
    } = req.body;

    const settings =
      await Settings.findOneAndUpdate(

        {},

        {
          $set: {
            siteOnline:
              Boolean(online),

            announcement:
              String(
                announcement || ""
              )
          }
        },

        {
          new: true,
          upsert: true
        }
      );

    res.json({
      success: true,
      settings
    });
  }
);


/* =========================
   ERROR HANDLER
========================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "Unhandled error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Internal server error"
    });
  }
);


/* =========================
   START
========================= */

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      `ADMFLIP backend running on port ${PORT}`
    );

  }
);
