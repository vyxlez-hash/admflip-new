"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

/*
============================================================
FILE STRUCTURE
============================================================

/
├── index.html
├── style.css
├── script.js
│
└── backend/
    ├── server.js
    ├── package.json
    └── values.txt

server.js      = /backend/server.js
values.txt     = /backend/values.txt
index.html     = /index.html
style.css      = /style.css
script.js      = /script.js
============================================================
*/

const ROOT_DIR = path.join(__dirname, "..");

const VALUES_FILE = path.join(
  __dirname,
  "values.txt"
);

const INDEX_FILE = path.join(
  ROOT_DIR,
  "index.html"
);

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

The frontend files are in the repository root.

This serves:

https://admflip-new.onrender.com/
https://admflip-new.onrender.com/style.css
https://admflip-new.onrender.com/script.js
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
    const username = String(
      req.params.username || ""
    ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required."
      });
    }

    try {
      const response = await fetch(
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
          "Roblox username lookup failed:",
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
ROBLOX AVATAR PROXY
============================================================
*/

app.get(
  "/roblox-avatar/:id",
  async (req, res) => {
    const id = String(
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
        "Avatar proxy error:",
        error
      );

      return res.status(404).end();
    }
  }
);

/*
============================================================
LOAD PET VALUES
============================================================

IMPORTANT:

Your values.txt uses this format:

Bat Dragon
768.000

Shadow Dragon
572.000

Giraffe
384.000

Frost Dragon
262.000

So the pet name is on one line
and the value is on the following line.
============================================================
*/

function loadPets() {
  try {
    console.log(
      "Reading values from:",
      VALUES_FILE
    );

    if (
      !fs.existsSync(
        VALUES_FILE
      )
    ) {
      console.error(
        "values.txt NOT FOUND!"
      );

      console.error(
        "Expected location:",
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
      text
        .split(/\r?\n/)
        .map(
          line => line.trim()
        )
        .filter(
          line => line.length > 0
        );

    const pets = [];

    /*
    --------------------------------------------------------
    Detect two-line format
    --------------------------------------------------------

    Pet Name
    768.000

    Pet Name
    572.000
    --------------------------------------------------------
    */

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const name =
        lines[i];

      const nextLine =
        lines[i + 1];

      /*
      Skip comments.
      */

      if (
        name.startsWith("#") ||
        name.startsWith("//")
      ) {
        continue;
      }

      if (
        nextLine === undefined
      ) {
        continue;
      }

      /*
      Check if the next line
      is a number.
      */

      const value =
        Number(
          nextLine.replace(
            /,/g,
            ""
          )
        );

      if (
        Number.isFinite(value)
      ) {
        pets.push({
          name: name,
          value: value
        });

        /*
        Skip the value line.
        */

        i++;
      }
    }

    /*
    --------------------------------------------------------
    If the two-line format didn't work,
    also support:

    Bat Dragon: 768.000
    Bat Dragon | 768.000
    Bat Dragon = 768.000
    --------------------------------------------------------
    */

    if (
      pets.length === 0
    ) {
      console.log(
        "Two-line format found no pets. Trying alternate format..."
      );

      for (
        const line of lines
      ) {
        let match =
          line.match(
            /^(.+?)\s*:\s*([\d,.]+)\s*$/
          );

        if (!match) {
          match =
            line.match(
              /^(.+?)\s*\|\s*([\d,.]+)\s*$/
            );
        }

        if (!match) {
          match =
            line.match(
              /^(.+?)\s*=\s*([\d,.]+)\s*$/
            );
        }

        if (!match) {
          match =
            line.match(
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

        if (
          name &&
          Number.isFinite(value)
        ) {
          pets.push({
            name,
            value
          });
        }
      }
    }

    console.log(
      `Loaded ${pets.length} pets from values.txt`
    );

    /*
    Show first few pets in Render logs.
    */

    if (pets.length > 0) {
      console.log(
        "First pets:",
        pets
          .slice(0, 5)
          .map(
            pet =>
              `${pet.name}: ${pet.value}`
          )
      );
    } else {
      console.error(
        "WARNING: values.txt was found but no pets could be parsed."
      );
    }

    return pets;

  } catch (error) {
    console.error(
      "ERROR reading values.txt:",
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

function getPets() {
  const pets =
    loadPets();

  return pets.map(
    pet => ({
      id:
        pet.name
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-|-$/g,
            ""
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
  );
}

/*
Main endpoint:
GET /pets
*/

app.get(
  "/pets",
  (req, res) => {
    try {
      const pets =
        getPets();

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json({
        success: true,
        pets: pets
      });

    } catch (error) {
      console.error(
        "/pets error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load pet values.",
        pets: []
      });
    }
  }
);

/*
Compatibility endpoint:
GET /api/pets
*/

app.get(
  "/api/pets",
  (req, res) => {
    try {
      const pets =
        getPets();

      return res.json({
        success: true,
        pets: pets
      });

    } catch (error) {
      console.error(
        "/api/pets error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load pet values.",
        pets: []
      });
    }
  }
);

/*
============================================================
PET IMAGE PROXY
============================================================

Frontend receives:

/pet-image/Bat%20Dragon

and the server attempts to retrieve
the corresponding image.
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
      encodeURIComponent(
        name
      );

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
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

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

        if (
          !response.ok
        ) {
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

        if (
          !buffer.length
        ) {
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
          "Pet image request failed:",
          name,
          error.message
        );
      }
    }

    console.error(
      "Could not find pet image:",
      name
    );

    return res.status(404).end();
  }
);

/*
============================================================
ROBLOX VERIFICATION
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
      !/^\d+$/.test(
        userId
      )
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

      if (
        !response.ok
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Roblox account could not be found."
        });
      }

      const user =
        await response.json();

      const profileText =
        [
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
DEBUG ENDPOINT
============================================================

Visit:

/debug-values

This lets you confirm Render can actually
see values.txt and how many pets were loaded.
============================================================
*/

app.get(
  "/debug-values",
  (req, res) => {
    const exists =
      fs.existsSync(
        VALUES_FILE
      );

    let fileSize = 0;

    if (exists) {
      try {
        fileSize =
          fs.statSync(
            VALUES_FILE
          ).size;
      } catch (error) {
        fileSize = 0;
      }
    }

    const pets =
      exists
        ? loadPets()
        : [];

    return res.json({
      success: true,

      valuesFile:
        VALUES_FILE,

      exists:
        exists,

      fileSize:
        fileSize,

      petCount:
        pets.length,

      firstPets:
        pets.slice(0, 10)
    });
  }
);

/*
============================================================
START SERVER
============================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "=========================================="
    );

    console.log(
      "ADMFLIP SERVER STARTED"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Frontend: ${INDEX_FILE}`
    );

    console.log(
      `Values file: ${VALUES_FILE}`
    );

    console.log(
      `Values exists: ${fs.existsSync(
        VALUES_FILE
      )}`
    );

    console.log(
      "=========================================="
    );
  }
);
