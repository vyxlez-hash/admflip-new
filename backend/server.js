const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT =
  process.env.PORT || 3000;


app.set(
  "trust proxy",
  1
);


app.use(cors());


app.use(
  express.json({
    limit: "100kb"
  })
);


app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100
  })
);


// =====================================================
// MONGODB
// =====================================================

console.log(
  "Mongo URL exists:",
  Boolean(process.env.MONGO_URL)
);


if (!process.env.MONGO_URL) {

  console.error(
    "MONGO_URL is missing"
  );

}


mongoose
  .connect(
    process.env.MONGO_URL
  )

  .then(() => {

    console.log(
      "MongoDB connected"
    );

  })

  .catch(error => {

    console.error(
      "MongoDB error:",
      error.message
    );

  });


// =====================================================
// USER
// =====================================================

const userSchema =
  new mongoose.Schema({

    robloxId: {
      type: Number,
      unique: true,
      index: true
    },

    username: String,

    avatar: String,

    inventory: [

      {

        name: String,

        value: Number,

        uid: {
          type: String,
          default: null
        }

      }

    ],

    deposited: [

      {

        name: String,

        value: Number,

        uid: {
          type: String,
          default: null
        }

      }

    ],

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


const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );


// =====================================================
// SETTINGS
// =====================================================

const settingsSchema =
  new mongoose.Schema({

    siteOnline: {
      type: Boolean,
      default: true
    },

    announcement: {
      type: String,
      default: ""
    }

  });


const Settings =
  mongoose.models.Settings ||
  mongoose.model(
    "Settings",
    settingsSchema
  );


// =====================================================
// CHAT
// =====================================================

const chatSchema =
  new mongoose.Schema({

    username: String,

    robloxId: Number,

    avatar: String,

    message: String,

    announcement: {
      type: Boolean,
      default: false
    }

  }, {
    timestamps: true
  });


const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model(
    "ChatMessage",
    chatSchema
  );


// =====================================================
// COINFLIP
// =====================================================

const coinflipSchema =
  new mongoose.Schema({

    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    creatorRobloxId: Number,

    creatorUsername: String,

    creatorAvatar: String,

    petName: String,

    petValue: Number,

    side: {
      type: String,

      enum: [
        "heads",
        "tails"
      ]
    },

    status: {
      type: String,

      enum: [
        "active",
        "completed",
        "cancelled"
      ],

      default: "active"
    },

    opponentId: {
      type:
        mongoose.Schema.Types.ObjectId,

      ref: "User",

      default: null
    }

  }, {
    timestamps: true
  });


const Coinflip =
  mongoose.models.Coinflip ||
  mongoose.model(
    "Coinflip",
    coinflipSchema
  );


// =====================================================
// PET VALUES
// =====================================================

function loadPets() {

  try {

    const file =
      path.join(
        __dirname,
        "values.txt"
      );


    const text =
      fs.readFileSync(
        file,
        "utf8"
      );


    const lines =
      text
        .split(/\r?\n/)
        .map(
          x => x.trim()
        )
        .filter(Boolean);


    const result = [];


    for (
      let i = 0;
      i < lines.length;
      i += 2
    ) {

      const name =
        lines[i];


      let value =
        lines[i + 1];


      if (
        !name ||
        !value
      ) {
        continue;
      }


      value =
        value
          .replace(
            /[$,]/g,
            ""
          )
          .replace(
            /[^\d.]/g,
            ""
          );


      const number =
        Number(value);


      result.push({

        name,

        value:
          Number.isFinite(number)
            ? number
            : 0

      });

    }


    console.log(
      "Loaded pets:",
      result.length
    );


    return result;

  } catch (error) {

    console.error(
      "Pet loading error:",
      error.message
    );


    return [];

  }

}


const pets =
  loadPets();


// =====================================================
// PET IMAGE CANDIDATES
// =====================================================

function cleanPetName(name) {

  return String(name || "")
    .replace(
      /\b(ride|fly|neon|mega neon)\b/gi,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function petImages(name) {

  const clean =
    cleanPetName(name);


  const encoded =
    encodeURIComponent(
      clean
    );


  return [

    `https://elvebredd.com/images/${encoded}.png`,

    `https://amvgg.com/images/${encoded}.png`

  ];

}


// =====================================================
// HOME
// =====================================================

app.get(
  "/",
  (req, res) => {

    res.send(
      "ADMFLIP backend is online"
    );

  }
);


// =====================================================
// STATUS
// =====================================================

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


// =====================================================
// PET VALUES
// =====================================================

app.get(
  "/pets",
  (req, res) => {

    res.json({

      success: true,

      pets:
        pets.map(pet => ({

          name:
            pet.name,

          value:
            pet.value,

          images:
            petImages(
              pet.name
            )

        }))

    });

  }
);


// =====================================================
// ROBLOX USER
// =====================================================

app.get(
  "/user/:username",
  async (req, res) => {

    try {

      const username =
        req.params.username.trim();


      const response =
        await fetch(
          "https://users.roblox.com/v1/usernames/users",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                usernames:
                  [username],

                excludeBannedUsers:
                  true

              })

          }
        );


      if (!response.ok) {

        return res.status(502).json({

          success: false,

          message:
            "Roblox service unavailable"

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


      const user =
        data.data[0];


      let avatar = "";


      try {

        const avatarResponse =
          await fetch(

            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png`

          );


        const avatarData =
          await avatarResponse.json();


        avatar =
          avatarData
            ?.data
            ?. [0]
            ?.imageUrl ||
          "";

      } catch {}


      res.json({

        success: true,

        user: {

          id:
            user.id,

          username:
            user.name,

          avatar

        }

      });

    } catch (error) {

      console.error(
        error
      );


      res.status(500).json({

        success: false,

        message:
          "Unable to contact Roblox"

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

    "GoldenLeaf"

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
      Math.random() *
      9000
    );


  return `${word}-${number}`;

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


      if (
        !username ||
        !phrase
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Username and phrase are required"

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

            body:
              JSON.stringify({

                usernames:
                  [username],

                excludeBannedUsers:
                  true

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


      let avatar = "";


      try {

        const avatarResponse =
          await fetch(

            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`

          );


        const avatarData =
          await avatarResponse.json();


        avatar =
          avatarData
            ?.data
            ?. [0]
            ?.imageUrl ||
          "";

      } catch {}


      await User.findOneAndUpdate(

        {
          robloxId:
            id
        },

        {
          $set: {

            robloxId:
              id,

            username:
              profile.name,

            avatar

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
        "Verification error:",
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
// USER DATA
// =====================================================

app.get(
  "/user-data/:robloxId",
  async (req, res) => {

    try {

      const robloxId =
        Number(
          req.params.robloxId
        );


      if (
        !Number.isFinite(
          robloxId
        )
      ) {

        return res.status(400).json({

          success: false

        });

      }


      const user =
        await User.findOne({

          robloxId

        }).lean();


      res.json({

        success: true,

        user:
          user || {

            inventory: [],

            wagered: 0,

            profit: 0

          }

      });

    } catch {

      res.status(500).json({

        success: false

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
        await User.find({})

          .sort({
            wagered: -1
          })

          .limit(10)

          .select(
            "username avatar wagered profit"
          )

          .lean();


      res.json({

        success: true,

        users

      });

    } catch {

      res.status(500).json({

        success: false,

        users: []

      });

    }

  }
);


// =====================================================
// ACTIVE COINFLIPS
// =====================================================

app.get(
  "/coinflips",
  async (req, res) => {

    try {

      const flips =
        await Coinflip.find({

          status:
            "active"

        })

        .sort({
          createdAt: -1
        })

        .limit(100)

        .lean();


      res.json({

        success: true,

        coinflips:
          flips

      });

    } catch {

      res.status(500).json({

        success: false,

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
        petName,
        side
      } = req.body;


      if (
        !robloxId ||
        !petName ||
        ![
          "heads",
          "tails"
        ].includes(side)
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid coinflip"

        });

      }


      const user =
        await User.findOne({

          robloxId:
            Number(
              robloxId
            )

        });


      if (!user) {

        return res.status(401).json({

          success: false,

          message:
            "Please sign in first"

        });

      }


      /*
       * Never trust the value sent
       * by the browser.
       *
       * The server gets the item
       * directly from MongoDB.
       */

      const index =
        user.inventory.findIndex(

          item =>
            item.name ===
            petName

        );


      if (index === -1) {

        return res.status(400).json({

          success: false,

          message:
            "Pet is not in your inventory"

        });

      }


      const item =
        user.inventory[index];


      const flip =
        await Coinflip.create({

          creatorId:
            user._id,

          creatorRobloxId:
            user.robloxId,

          creatorUsername:
            user.username,

          creatorAvatar:
            user.avatar,

          petName:
            item.name,

          petValue:
            item.value,

          side

        });


      /*
       * Remove exactly the item
       * that was used.
       */

      user.inventory.splice(
        index,
        1
      );


      await user.save();


      res.json({

        success: true,

        coinflip:
          flip

      });


    } catch (error) {

      console.error(
        "Coinflip error:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "Unable to create coinflip"

      });

    }

  }
);


// =====================================================
// CHAT
// =====================================================

app.get(
  "/chat",
  async (req, res) => {

    try {

      const messages =
        await ChatMessage.find({})

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

    } catch {

      res.status(500).json({

        success: false,

        messages: []

      });

    }

  }
);


app.post(
  "/chat",
  async (req, res) => {

    try {

      const {
        robloxId,
        message
      } = req.body;


      if (
        !robloxId ||
        !message
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Please sign in first"

        });

      }


      const clean =
        String(message)
          .trim()
          .slice(
            0,
            300
          );


      if (!clean) {

        return res.status(400).json({

          success: false

        });

      }


      const linkPattern =
        /(https?:\/\/|www\.|discord\.gg|t\.me|[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|tv|ly)(\/|\b))/i;


      if (
        linkPattern.test(
          clean
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Links are not allowed in chat."

        });

      }


      const user =
        await User.findOne({

          robloxId:
            Number(
              robloxId
            )

        });


      if (!user) {

        return res.status(401).json({

          success: false,

          message:
            "Please verify your Roblox account first."

        });

      }


      const chat =
        await ChatMessage.create({

          username:
            user.username,

          robloxId:
            user.robloxId,

          avatar:
            user.avatar,

          message:
            clean

        });


      res.json({

        success: true,

        message:
          chat

      });


    } catch {

      res.status(500).json({

        success: false,

        message:
          "Unable to send message"

      });

    }

  }
);


// =====================================================
// FRONTEND
// =====================================================

app.use(
  express.static(
    __dirname
  )
);


// =====================================================
// TELEGRAM
// =====================================================

try {

  if (
    process.env.TELEGRAM_TOKEN
  ) {

    require(
      "./telegram"
    );

    console.log(
      "Telegram module loaded"
    );

  } else {

    console.log(
      "Telegram disabled: TELEGRAM_TOKEN missing"
    );

  }

} catch (error) {

  console.error(
    "Telegram startup error:",
    error.message
  );

}


// =====================================================
// START
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `ADMFLIP backend running on port ${PORT}`
    );

  }
);
