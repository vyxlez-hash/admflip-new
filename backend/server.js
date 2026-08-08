
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

/*
============================================================
YOUR FILE STRUCTURE
============================================================

/
├── index.html
├── style.css
├── script.js
│
└── backend/
    ├── server.js
    └── values.txt

server.js is inside /backend
Frontend files are in the repository root.
values.txt is inside /backend.
*/

const ROOT_DIR = path.join(__dirname, "..");
const BACKEND_DIR = __dirname;

const INDEX_FILE =
  path.join(ROOT_DIR, "index.html");

const VALUES_FILE =
  path.join(BACKEND_DIR, "values.txt");

/*
============================================================
MIDDLEWARE
============================================================
*/

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/*
============================================================
FRONTEND
============================================================

Serve:

/
├── index.html
├── style.css
└── script.js

from the repository root.
*/

app.use(
  express.static(ROOT_DIR)
);

app.get("/", (req, res) => {
  res.sendFile(INDEX_FILE);
});

/*
============================================================
ROBLOX USER LOOKUP
============================================================
*/

app.get(
  "/user/:username",
  async (req, res) => {
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

    try {
      const response =
        await fetch(
          "https://users.roblox.com/v1/usernames/users",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              "User-Agent":
                "ADMFLIP/1.0"
            },

            body: JSON.stringify({
              usernames: [username],
              excludeBannedUsers: false
            })
          }
        );

      if (!response.ok) {
        const text =
          await response.text();

        console.error(
          "Roblox lookup failed:",
          response.status,
          text
        );

        return res.status(502).json({
          success: false,
          message:
            "Roblox could not be reached by the server."
        });
      }

      const data =
        await response.json();

      const user =
        data?.data?.[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "Roblox username was not found."
        });
      }

      return res.json({
        success: true,

        user: {
          id: user.id,

          username:
            user.name ||
            username,

          displayName:
            user.displayName ||
            user.name ||
            username
        }
      });

    } catch (error) {
      console.error(
        "Roblox lookup error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to contact Roblox."
      });
    }
  }
);

/*
============================================================
ROBLOX AVATAR
============================================================
*/

app.get(
  "/roblox-avatar/:id",
  async (req, res) => {
    const id =
      String(
        req.params.id || ""
      ).trim();

    if (!/^\d+$/.test(id)) {
      return res.status(400).end();
    }

    try {
      const response =
        await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(
            id
          )}&size=150x150&format=Png&isCircular=false`,
          {
            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "ADMFLIP/1.0"
            }
          }
        );

      if (!response.ok) {
        return res.status(404).end();
      }

      const data =
        await response.json();

      const imageUrl =
        data?.data?.[0]?.imageUrl;

      if (!imageUrl) {
        return res.status(404).end();
      }

      const imageResponse =
        await fetch(
          imageUrl,
          {
            headers: {
              "User-Agent":
                "ADMFLIP/1.0"
            }
          }
        );

      if (!imageResponse.ok) {
        return res.status(404).end();
      }

      const buffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        );

      res.set(
        "Content-Type",
        imageResponse.headers.get(
          "content-type"
        ) || "image/png"
      );

      res.set(
        "Cache-Control",
        "public, max-age=3600"
      );

      return res.send(buffer);

    } catch (error) {
      console.error(
        "Avatar error:",
        error
      );

      return res.status(404).end();
    }
  }
);

/*
============================================================
LOAD VALUES.TXT
============================================================

values.txt is in:

backend/values.txt
*/

function loadPets() {
  try {
    if (
      !fs.existsSync(
        VALUES_FILE
      )
    ) {
      console.error(
        "values.txt NOT FOUND:"
      );

      console.error(
        VALUES_FILE
      );

      return [];
    }

    const text =
      fs.readFileSync(
        VALUES_FILE,
        "utf8"
      );

    const lines =
      text.split(/\r?\n/);

    const pets = [];

    for (
      const line of lines
    ) {
      const trimmed =
        line.trim();

      if (!trimmed) {
        continue;
      }

      if (
        trimmed.startsWith("#") ||
        trimmed.startsWith("//")
      ) {
        continue;
      }

      let match = null;

      /*
      Name: 123
      */

      match =
        trimmed.match(
          /^(.+?)\s*:\s*([\d,.]+)\s*$/
        );

      /*
      Name | 123
      */

      if (!match) {
        match =
          trimmed.match(
            /^(.+?)\s*\|\s*([\d,.]+)\s*$/
          );
      }

      /*
      Name = 123
      */

      if (!match) {
        match =
          trimmed.match(
            /^(.+?)\s*=\s*([\d,.]+)\s*$/
          );
      }

      /*
      Name - 123
      */

      if (!match) {
        match =
          trimmed.match(
            /^(.+?)\s+-\s+([\d,.]+)\s*$/
          );
      }

      if (!match) {
        continue;
      }

      const name =
        match[1].trim();

      const value =
        Number(
          match[2].replace(
            /,/g,
            ""
          )
        );

      if (!name) {
        continue;
      }

      pets.push({
        name,

        value:
          Number.isFinite(value)
            ? value
            : 0
      });
    }

    console.log(
      `Loaded ${pets.length} pets from values.txt`
    );

    return pets;

  } catch (error) {
    console.error(
      "Error reading values.txt:",
      error
    );

    return [];
  }
}

/*
============================================================
PETS API
============================================================
*/

app.get(
  "/pets",
  (req, res) => {
    const pets =
      loadPets();

    res.set(
      "Cache-Control",
      "no-store"
    );

    return res.json({
      success: true,

      pets:
        pets.map(
          pet => ({
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
              `/pet-image/${encodeURIComponent(
                pet.name
              )}`
          })
        )
    });
  }
);

app.get(
  "/api/pets",
  (req, res) => {
    const pets =
      loadPets();

    return res.json({
      success: true,

      pets:
        pets.map(
          pet => ({
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
              `/pet-image/${encodeURIComponent(
                pet.name
              )}`
          })
        )
    });
  }
);

/*
============================================================
PET IMAGE PROXY
============================================================
*/

app.get(
  "/pet-image/:name",
  async (req, res) => {
    const name =
      String(
        req.params.name || ""
      ).trim();

    if (!name) {
      return res.status(400).end();
    }

    const encodedName =
      encodeURIComponent(name);

    const imageUrls = [
      `https://amvgg.com/items/${encodedName}.webp`,
      `https://amvgg.com/items/${encodedName}.png`
    ];

    for (
      const imageUrl of imageUrls
    ) {
      try {
        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            () =>
              controller.abort(),
            10000
          );

        let response;

        try {
          response =
            await fetch(
              imageUrl,
              {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0",

                  Accept:
                    "image/avif,image/webp,image/png,image/*,*/*;q=0.8"
                },

                signal:
                  controller.signal
              }
            );
        } finally {
          clearTimeout(
            timeout
          );
        }

        if (!response.ok) {
          continue;
        }

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.startsWith(
            "image/"
          )
        ) {
          continue;
        }

        const buffer =
          Buffer.from(
            await response.arrayBuffer()
          );

        if (!buffer.length) {
          continue;
        }

        res.set(
          "Content-Type",
          contentType
        );

        res.set(
          "Cache-Control",
          "public, max-age=86400"
        );

        return res.send(
          buffer
        );

      } catch (error) {
        console.error(
          "Pet image error:",
          name,
          error.message
        );
      }
    }

    return res.status(404).end();
  }
);

/*
============================================================
VERIFICATION
============================================================
*/

app.post(
  "/check",
  async (req, res) => {
    const username =
      String(
        req.body?.username || ""
      ).trim();

    const userId =
      String(
        req.body?.userId || ""
      ).trim();

    const phrase =
      String(
        req.body?.phrase || ""
      ).trim();

    if (
      !username ||
      !userId ||
      !phrase
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username, userId and phrase are required."
      });
    }

    if (
      !/^\d+$/.test(userId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Roblox user ID."
      });
    }

    try {
      const response =
        await fetch(
          `https://users.roblox.com/v1/users/${encodeURIComponent(
            userId
          )}`,
          {
            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "ADMFLIP/1.0"
            }
          }
        );

      if (!response.ok) {
        return res.status(404).json({
          success: false,
          message:
            "Roblox account could not be found."
        });
      }

      const user =
        await response.json();

      /*
      Roblox's public user endpoint may expose
      description/about information depending
      on the current API response.

      */

      const profileText = [
        user?.description,
        user?.about,
        user?.bio
      ]
        .filter(Boolean)
        .join(" ");

      const verified =
        profileText
          .toLowerCase()
          .includes(
            phrase.toLowerCase()
          );

      if (!verified) {
        return res.status(403).json({
          success: false,

          verified: false,

          message:
            "Verification phrase was not found on the Roblox profile."
        });
      }

      return res.json({
        success: true,

        verified: true,

        username:
          user.name ||
          username,

        id:
          user.id ||
          userId,

        displayName:
          user.displayName ||
          user.name ||
          username
      });

    } catch (error) {
      console.error(
        "Verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Verification could not be completed."
      });
    }
  }
);

/*
============================================================
HEALTH CHECK
============================================================
*/

app.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      status: "online"
    });
  }
);

/*
============================================================
START
============================================================
*/

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
      `Frontend: ${INDEX_FILE}`
    );

    console.log(
      `Values: ${VALUES_FILE}`
    );

    console.log(
      "================================="
    );
  }
);
