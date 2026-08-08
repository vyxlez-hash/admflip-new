const BACKEND = "https://admflip-new.onrender.com";

const state = {
  user: null,
  pets: [],
  selectedPet: null,
  selectedSide: null,
  currentPage: "coinflip",
  phrase: null
};

const $ = (id) => document.getElementById(id);

/* =====================================================
   HELPERS
===================================================== */

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

async function api(path, options = {}) {
  const response = await fetch(
    BACKEND + path,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Server error (${response.status})`
    );
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatValue(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 6
  });
}

function petImage(pet) {
  if (!pet) return "";

  if (typeof pet === "string") {
    return (
      "https://amvgg.com/items/" +
      encodeURIComponent(pet.trim()) +
      ".webp"
    );
  }

  if (pet.image) {
    return pet.image;
  }

  if (!pet.name) {
    return "";
  }

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(
      String(pet.name).trim()
    ) +
    ".webp"
  );
}

/* =====================================================
   LOGIN / USER
===================================================== */

function saveUser() {
  if (!state.user) return;

  localStorage.setItem(
    "admflipUser",
    JSON.stringify(state.user)
  );
}

function restoreUser() {
  const saved =
    localStorage.getItem("admflipUser");

  if (!saved) return;

  try {
    state.user = JSON.parse(saved);
    showLoggedIn();
  } catch {
    localStorage.removeItem("admflipUser");
  }
}

function showLoggedIn() {
  if (!state.user) return;

  const loginBtn = $("loginBtn");
  const accountBox = $("accountBox");

  if (loginBtn) {
    loginBtn.classList.add("hidden");
  }

  if (accountBox) {
    accountBox.classList.remove("hidden");
  }

  if ($("accountUsername")) {
    $("accountUsername").textContent =
      state.user.username || "User";
  }

  if ($("accountAvatar")) {
    $("accountAvatar").src =
      state.user.avatar || "/logo.png";
  }

  if ($("chatInput")) {
    $("chatInput").placeholder =
      "Message chat...";
  }

  loadAccount();
}

function logout() {
  state.user = null;

  localStorage.removeItem("admflipUser");

  if ($("loginBtn")) {
    $("loginBtn").classList.remove("hidden");
  }

  if ($("accountBox")) {
    $("accountBox").classList.add("hidden");
  }

  if ($("chatInput")) {
    $("chatInput").placeholder =
      "Sign in to chat...";
  }

  toast("Signed out");
}

if ($("loginBtn")) {
  $("loginBtn").onclick = () => {
    $("loginModal").classList.remove("hidden");
  };
}

if ($("closeLogin")) {
  $("closeLogin").onclick = () => {
    $("loginModal").classList.add("hidden");
  };
}

if ($("logoutBtn")) {
  $("logoutBtn").onclick = logout;
}

/* =====================================================
   ROBLOX VERIFICATION
===================================================== */

if ($("username")) {

  $("username").addEventListener(
    "change",
    async () => {

      const username =
        $("username").value.trim();

      if (!username) return;

      if ($("loginMessage")) {
        $("loginMessage").textContent =
          "Checking Roblox username...";
      }

      try {

        const data =
          await api(
            "/user/" +
            encodeURIComponent(username)
          );

        if (!data.success) {

          $("loginMessage").textContent =
            data.message ||
            "Roblox username not found.";

          return;
        }

        state.user = data.user;

        if ($("loginProfile")) {

          $("loginProfile")
            .classList.remove("hidden");

          $("loginProfile").innerHTML = `
            <img
              src="${escapeAttr(
                state.user.avatar || "/logo.png"
              )}"
              onerror="this.src='/logo.png'"
            >

            <div>
              <b>
                ${escapeHtml(
                  state.user.username
                )}
              </b>
            </div>
          `;
        }

        if ($("loginMessage")) {
          $("loginMessage").textContent =
            "Creating verification phrase...";
        }

        const phraseData =
          await api("/create");

        state.phrase =
          phraseData.phrase;

        if ($("phrase")) {

          $("phrase")
            .classList.remove("hidden");

          $("phrase").innerHTML = `
            Put this phrase in your Roblox bio:

            <br><br>

            <b>
              ${escapeHtml(
                state.phrase
              )}
            </b>
          `;
        }

        if ($("verify")) {
          $("verify").style.display =
            "block";
        }

        if ($("loginMessage")) {
          $("loginMessage").textContent =
            "";
        }

      } catch (error) {

        console.error(error);

        if ($("loginMessage")) {
          $("loginMessage").textContent =
            error.message ||
            "Server error.";
        }

      }

    }
  );

}

if ($("verify")) {

  $("verify").onclick =
    async () => {

      if (
        !state.user ||
        !state.phrase
      ) {
        return;
      }

      $("verify").disabled = true;
      $("verify").textContent =
        "Checking...";

      try {

        const data =
          await api(
            "/check",
            {
              method: "POST",

              body: JSON.stringify({
                username:
                  state.user.username,

                phrase:
                  state.phrase
              })
            }
          );

        if (!data.success) {

          toast(
            data.message ||
            "Verification failed."
          );

          $("verify").disabled = false;
          $("verify").textContent =
            "Verify";

          return;
        }

        state.user = {
          ...state.user,

          id: data.id,

          robloxId: data.id,

          username:
            data.username ||
            state.user.username,

          avatar:
            data.avatar ||
            state.user.avatar
        };

        saveUser();

        $("loginModal")
          .classList.add("hidden");

        if ($("username")) {
          $("username").value = "";
        }

        if ($("loginProfile")) {
          $("loginProfile")
            .classList.add("hidden");
        }

        if ($("phrase")) {
          $("phrase")
            .classList.add("hidden");
        }

        $("verify").style.display =
          "none";

        $("verify").disabled =
          false;

        $("verify").textContent =
          "Verify";

        showLoggedIn();

        toast(
          "Verified successfully"
        );

        loadChat();

      } catch (error) {

        console.error(error);

        toast(error.message);

        $("verify").disabled =
          false;

        $("verify").textContent =
          "Verify";
      }

    };

}

/* =====================================================
   ACCOUNT
===================================================== */

async function loadAccount() {

  if (!state.user) return;

  const id =
    state.user.id ||
    state.user.robloxId;

  if (!id) return;

  try {

    const data =
      await api(
        "/account/" +
        encodeURIComponent(id)
      );

    if (
      data.success &&
      data.user
    ) {

      state.user = {
        ...state.user,
        ...data.user,

        id:
          data.user.id,

        robloxId:
          data.user.id
      };

      saveUser();

      renderProfile();

      await loadInventory();
    }

  } catch (error) {

    console.error(
      "Account error:",
      error
    );

  }
}

/* =====================================================
   PAGES
===================================================== */

function showPage(page) {

  state.currentPage = page;

  document
    .querySelectorAll(".page")
    .forEach((el) => {
      el.classList.add("hidden");
    });

  const target =
    $(page + "Page");

  if (target) {
    target.classList.remove("hidden");
  }

  if (page === "coinflip") {
    loadCoinflips();
  }

  if (page === "values") {
    loadValues();
  }

  if (page === "leaderboard") {
    loadLeaderboard();
  }

  if (page === "profile") {
    renderProfile();
  }

  if (page === "chat") {
    openChat();
  }

  localStorage.setItem(
    "admflipPage",
    page
  );
}

document
  .querySelectorAll("[data-page]")
  .forEach((link) => {

    link.onclick = (event) => {

      event.preventDefault();

      const page =
        link.dataset.page;

      if (page === "chat") {
        openChat();
        return;
      }

      showPage(page);

      history.replaceState(
        null,
        "",
        "#" + page
      );
    };

  });

function restorePage() {

  const hash =
    location.hash.replace(
      "#",
      ""
    );

  const saved =
    localStorage.getItem(
      "admflipPage"
    );

  const page =
    hash ||
    saved ||
    "coinflip";

  const allowed = [
    "coinflip",
    "values",
    "leaderboard",
    "profile"
  ];

  if (
    !allowed.includes(page)
  ) {
    showPage("coinflip");
    return;
  }

  showPage(page);
}

/* =====================================================
   VALUES
===================================================== */

async function loadValues() {

  if (state.pets.length) {
    renderValues(state.pets);
    return;
  }

  try {

    const data =
      await api("/pets");

    state.pets =
      Array.isArray(data.pets)
        ? data.pets
        : [];

    renderValues(
      state.pets
    );

  } catch (error) {

    console.error(error);

    if ($("valuesGrid")) {

      $("valuesGrid").innerHTML = `
        <div class="loading">
          Unable to load pet values.

          <br>

          ${escapeHtml(
            error.message
          )}
        </div>
      `;

    }

  }

}

function makePetCard(
  pet,
  selectable = false
) {

  const image =
    petImage(pet);

  const card =
    document.createElement("div");

  card.className =
    "pet-card" +
    (
      pet._selected
        ? " selected"
        : ""
    );

  card.innerHTML = `
    ${
      image
        ? `
          <img
            class="pet-image"
            src="${escapeAttr(image)}"
            alt="${escapeAttr(
              pet.name || "Pet"
            )}"
            onerror="
              this.classList.add('missing');
              this.removeAttribute('src');
            "
          >
        `
        : ""
    }

    <div class="pet-name">
      ${escapeHtml(
        pet.name || "Unknown Pet"
      )}
    </div>

    <div class="pet-meta">

      <span>
        ${escapeHtml(
          pet.rarity || ""
        )}
      </span>

      <span class="pet-value">
        ${formatValue(
          pet.value
        )}
      </span>

    </div>

    ${
      pet.variant
        ? `
          <div class="pet-meta">
            ${escapeHtml(
              pet.variant
            )}
          </div>
        `
        : ""
    }

    ${
      pet.neon
        ? `
          <div class="pet-meta">
            Neon
          </div>
        `
        : ""
    }

    ${
      pet.mega
        ? `
          <div class="pet-meta">
            Mega Neon
          </div>
        `
        : ""
    }

    ${
      pet.fly || pet.ride
        ? `
          <div class="pet-meta">
            ${
              pet.fly
                ? "F"
                : ""
            }

            ${
              pet.ride
                ? " R"
                : ""
            }
          </div>
        `
        : ""
    }
  `;

  if (selectable) {

    card.onclick = () => {

      document
        .querySelectorAll(
          "#createInventory .pet-card"
        )
        .forEach((x) => {
          x.classList.remove(
            "selected"
          );
        });

      card.classList.add(
        "selected"
      );

      state.selectedPet =
        pet;

      if ($("sideArea")) {
        $("sideArea")
          .classList.remove(
            "hidden"
          );
      }

    };

  }

  return card;
}

function renderValues(pets) {

  const grid =
    $("valuesGrid");

  if (!grid) return;

  grid.innerHTML = "";

  if (!pets.length) {

    grid.innerHTML = `
      <div class="loading">
        No values found.
      </div>
    `;

    return;
  }

  pets.forEach((pet) => {

    grid.appendChild(
      makePetCard(pet)
    );

  });

}

if ($("valueSearch")) {

  $("valueSearch").addEventListener(
    "input",
    () => {

      const query =
        $("valueSearch")
          .value
          .toLowerCase()
          .trim();

      const filtered =
        state.pets.filter(
          (pet) =>
            String(
              pet.name || ""
            )
              .toLowerCase()
              .includes(query)
        );

      renderValues(
        filtered
      );

    }
  );

}

/* =====================================================
   INVENTORY
===================================================== */

async function loadInventory() {

  if (!state.user) return;

  const id =
    state.user.id ||
    state.user.robloxId;

  if (!id) return;

  try {

    const data =
      await api(
        "/inventory/" +
        encodeURIComponent(id)
      );

    state.user.inventory =
      data.inventory || [];

  } catch (error) {

    /*
     * If the backend doesn't have the
     * inventory route yet, don't destroy
     * locally available inventory.
     */

    console.error(
      "Inventory error:",
      error
    );

    state.user.inventory =
      state.user.inventory || [];
  }

}

if ($("inventoryBtn")) {

  $("inventoryBtn").onclick =
    async () => {

      if (!state.user) {

        $("loginModal")
          .classList.remove(
            "hidden"
          );

        return;
      }

      $("inventoryModal")
        .classList.remove(
          "hidden"
        );

      await loadInventory();

      renderInventory();

    };

}

if ($("closeInventory")) {

  $("closeInventory").onclick =
    () => {

      $("inventoryModal")
        .classList.add(
          "hidden"
        );

    };

}

function renderInventory() {

  const grid =
    $("inventoryGrid");

  if (!grid) return;

  grid.innerHTML = "";

  const inventory =
    state.user?.inventory || [];

  if (!inventory.length) {

    grid.innerHTML = `
      <div class="loading">
        Your inventory is empty.
      </div>
    `;

    return;
  }

  inventory.forEach((pet) => {

    grid.appendChild(
      makePetCard(pet)
    );

  });

}

/* =====================================================
   CREATE COINFLIP
===================================================== */

if ($("createCoinflipBtn")) {

  $("createCoinflipBtn").onclick =
    async () => {

      if (!state.user) {

        $("loginModal")
          .classList.remove(
            "hidden"
          );

        toast(
          "Sign in first"
        );

        return;
      }

      $("createModal")
        .classList.remove(
          "hidden"
        );

      if ($("sideArea")) {
        $("sideArea")
          .classList.add(
            "hidden"
          );
      }

      state.selectedPet =
        null;

      state.selectedSide =
        null;

      document
        .querySelectorAll(
          ".side-btn"
        )
        .forEach((button) => {
          button.classList.remove(
            "selected"
          );
        });

      await loadInventory();

      const grid =
        $("createInventory");

      if (!grid) return;

      grid.innerHTML = "";

      const inventory =
        state.user.inventory || [];

      if (!inventory.length) {

        grid.innerHTML = `
          <div class="loading">

            No pets in your inventory.

            <br><br>

            Your backend currently
            requires pets to be added
            to your MongoDB inventory.

          </div>
        `;

        return;
      }

      inventory.forEach((pet) => {

        grid.appendChild(
          makePetCard(
            pet,
            true
          )
        );

      });

    };

}

if ($("closeCreate")) {

  $("closeCreate").onclick =
    () => {

      $("createModal")
        .classList.add(
          "hidden"
        );

    };

}

document
  .querySelectorAll(".side-btn")
  .forEach((button) => {

    button.onclick = () => {

      document
        .querySelectorAll(
          ".side-btn"
        )
        .forEach((x) => {
          x.classList.remove(
            "selected"
          );
        });

      button.classList.add(
        "selected"
      );

      state.selectedSide =
        button.dataset.side;
    };

  });

if ($("postCoinflip")) {

  $("postCoinflip").onclick =
    async () => {

      if (
        !state.user ||
        !state.selectedPet ||
        !state.selectedSide
      ) {

        toast(
          "Choose a pet and side first."
        );

        return;
      }

      const robloxId =
        state.user.id ||
        state.user.robloxId;

      /*
       * Backend requires MongoDB
       * inventory item ObjectId.
       */
      const itemId =
        state.selectedPet.itemId ||
        state.selectedPet._id;

      if (!itemId) {

        toast(
          "This inventory item has no ID."
        );

        return;
      }

      try {

        await api(
          "/coinflips",
          {
            method: "POST",

            body: JSON.stringify({

              robloxId,

              itemId,

              side:
                state.selectedSide

            })
          }
        );

        toast(
          "Coinflip posted!"
        );

        $("createModal")
          .classList.add(
            "hidden"
          );

        state.selectedPet =
          null;

        state.selectedSide =
          null;

        await loadInventory();
        await loadCoinflips();

      } catch (error) {

        toast(
          error.message
        );

      }

    };

}

/* =====================================================
   COINFLIPS
===================================================== */

async function loadCoinflips() {

  try {

    const data =
      await api(
        "/coinflips"
      );

    renderCoinflips(
      data.coinflips || []
    );

  } catch (error) {

    console.error(
      "Coinflip error:",
      error
    );

    if ($("coinflips")) {

      $("coinflips").innerHTML = `
        <div class="loading">
          ${escapeHtml(
            error.message
          )}
        </div>
      `;

    }

  }

}

function renderCoinflips(list) {

  const container =
    $("coinflips");

  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {

    container.innerHTML = `
      <div class="loading">
        No active coinflips yet.
      </div>
    `;

    return;
  }

  list.forEach((cf) => {

    const el =
      document.createElement("div");

    el.className =
      "coinflip";

    const image =
      petImage(cf);

    el.innerHTML = `
      <div class="cf-users">

        <span>
          ${escapeHtml(
            cf.username ||
            "Trader"
          )}
        </span>

        <span>
          ${escapeHtml(
            cf.side || ""
          )}
        </span>

      </div>

      <div class="cf-body">

        <div class="cf-side">

          <div class="cf-pet">

            ${
              image
                ? `
                  <img
                    src="${escapeAttr(
                      image
                    )}"
                    alt="${escapeAttr(
                      cf.petName ||
                      "Pet"
                    )}"
                    onerror="
                      this.remove()
                    "
                  >
                `
                : ""
            }

            <div>

              <b>
                ${escapeHtml(
                  cf.petName ||
                  "Pet"
                )}
              </b>

              <div class="muted">

                ${formatValue(
                  cf.petValue
                )}

              </div>

              ${
                cf.variant
                  ? `
                    <div class="muted">
                      ${escapeHtml(
                        cf.variant
                      )}
                    </div>
                  `
                  : ""
              }

            </div>

          </div>

        </div>

        <div class="cf-center">

          <div class="coin">
            ${escapeHtml(
              cf.side || "?"
            )}
          </div>

          <button
            class="primary cf-join"
            data-id="${escapeAttr(
              cf.id || ""
            )}"
          >
            Join
          </button>

        </div>

        <div class="cf-side">

          <div class="cf-pet">
            Waiting for trader...
          </div>

        </div>

      </div>
    `;

    const join =
      el.querySelector(
        ".cf-join"
      );

    if (join) {

      join.onclick =
        async () => {

          if (!state.user) {

            $("loginModal")
              .classList.remove(
                "hidden"
              );

            toast(
              "Sign in first"
            );

            return;
          }

          /*
           * Your current backend does NOT
           * implement the join endpoint.
           */
          toast(
            "Join is not enabled on the backend yet."
          );

        };

    }

    container.appendChild(
      el
    );

  });

}

/* =====================================================
   LEADERBOARD
===================================================== */

async function loadLeaderboard() {

  try {

    const data =
      await api(
        "/leaderboard"
      );

    const container =
      $("leaderboard");

    if (!container) return;

    container.innerHTML = "";

    const users =
      Array.isArray(
        data.users
      )
        ? data.users
        : [];

    if (!users.length) {

      container.innerHTML = `
        <div class="loading">
          No leaderboard data yet.
        </div>
      `;

      return;
    }

    users
      .slice(0, 10)
      .forEach(
        (user, index) => {

          const row =
            document.createElement(
              "div"
            );

          row.className =
            "rank-row";

          row.innerHTML = `
            <div class="rank">
              #${index + 1}
            </div>

            <div class="rank-name">

              ${escapeHtml(
                user.username ||
                "User"
              )}

            </div>

            <div class="rank-value">

              ${formatValue(
                user.wagered ||
                0
              )}

            </div>
          `;

          container.appendChild(
            row
          );

        }
      );

  } catch (error) {

    console.error(
      "Leaderboard error:",
      error
    );

    if ($("leaderboard")) {

      $("leaderboard").innerHTML = `
        <div class="loading">
          ${escapeHtml(
            error.message
          )}
        </div>
      `;

    }

  }

}

/* =====================================================
   CHAT
===================================================== */

function openChat() {

  if ($("chatPanel")) {
    $("chatPanel")
      .classList.add(
        "mobile-open"
      );
  }

  if ($("chatInput")) {

    $("chatInput").placeholder =
      state.user
        ? "Message chat..."
        : "Sign in to chat...";

  }

  loadChat();
}

function closeChat() {

  if ($("chatPanel")) {

    $("chatPanel")
      .classList.remove(
        "mobile-open"
      );

  }

}

if ($("chatClose")) {
  $("chatClose").onclick =
    closeChat;
}

if ($("mobileChatButton")) {

  $("mobileChatButton").onclick =
    () => {

      if ($("chatPanel")) {

        $("chatPanel")
          .classList.toggle(
            "mobile-open"
          );

      }

      loadChat();

    };

}

async function loadChat() {

  try {

    /*
     * Correct backend route:
     * GET /chat/messages
     */
    const data =
      await api(
        "/chat/messages"
      );

    /*
     * Correct backend route:
     * GET /chat/online
     */
    try {

      const online =
        await api(
          "/chat/online"
        );

      if ($("onlineCount")) {

        $("onlineCount")
          .textContent =
          online.online ?? 37;

      }

    } catch {

      if ($("onlineCount")) {

        $("onlineCount")
          .textContent =
          "37";

      }

    }

    renderChat(
      data.messages || []
    );

  } catch (error) {

    console.error(
      "Chat error:",
      error
    );

  }

}

function renderChat(messages) {

  const container =
    $("chatMessages");

  if (!container) return;

  container.innerHTML = "";

  messages.forEach(
    (message) => {

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "chat-message";

      el.innerHTML = `
        <img
          class="chat-avatar"
          src="${escapeAttr(
            message.avatar ||
            "/logo.png"
          )}"
          onerror="
            this.src='/logo.png'
          "
        >

        <div class="chat-content">

          <div class="chat-username">

            ${escapeHtml(
              message.username ||
              "User"
            )}

          </div>

          <div class="chat-text">

            ${escapeHtml(
              message.message ||
              ""
            )}

          </div>

        </div>
      `;

      container.appendChild(
        el
      );

    }
  );

  container.scrollTop =
    container.scrollHeight;
}

if ($("chatForm")) {

  $("chatForm").onsubmit =
    async (event) => {

      event.preventDefault();

      if (!state.user) {

        toast(
          "Sign in to chat."
        );

        $("loginModal")
          .classList.remove(
            "hidden"
          );

        return;
      }

      const input =
        $("chatInput");

      if (!input) return;

      const message =
        input.value.trim();

      if (!message) return;

      try {

        /*
         * Correct backend route:
         * POST /chat/messages
         */
        await api(
          "/chat/messages",
          {
            method: "POST",

            body: JSON.stringify({

              robloxId:
                state.user.id ||
                state.user.robloxId,

              username:
                state.user.username,

              avatar:
                state.user.avatar,

              message

            })
          }
        );

        input.value = "";

        await loadChat();

      } catch (error) {

        toast(
          error.message
        );

      }

    };

}

/* =====================================================
   RULES
===================================================== */

if ($("rulesBtn")) {

  $("rulesBtn").onclick =
    () => {

      $("rulesModal")
        .classList.remove(
          "hidden"
        );

    };

}

if ($("closeRules")) {

  $("closeRules").onclick =
    () => {

      $("rulesModal")
        .classList.add(
          "hidden"
        );

    };

}

/* =====================================================
   PROFILE
===================================================== */

if ($("profileBtn")) {

  $("profileBtn").onclick =
    () => {

      showPage("profile");
      renderProfile();

    };

}

function renderProfile() {

  if (!state.user) return;

  const container =
    $("profileContent");

  if (!container) return;

  container.innerHTML = `
    <div class="page-head">

      <div>

        <div class="eyebrow">
          PROFILE
        </div>

        <h1>
          ${escapeHtml(
            state.user.username ||
            "User"
          )}
        </h1>

        <p>
          Your ADMFLIP account.
        </p>

      </div>

    </div>

    <div class="pet-grid">

      <div class="pet-card">

        <img
          class="pet-image"
          src="${escapeAttr(
            state.user.avatar ||
            "/logo.png"
          )}"
          onerror="
            this.src='/logo.png'
          "
        >

        <div class="pet-name">

          ${escapeHtml(
            state.user.username ||
            "User"
          )}

        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Balance
        </div>

        <div class="pet-value">

          ${formatValue(
            state.user.balance ||
            0
          )}

        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Wagered
        </div>

        <div class="pet-value">

          ${formatValue(
            state.user.wagered ||
            0
          )}

        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Profit
        </div>

        <div class="pet-value">

          ${formatValue(
            state.user.profit ||
            0
          )}

        </div>

      </div>

    </div>
  `;
}

/* =====================================================
   INITIALIZE
===================================================== */

restoreUser();
restorePage();

loadValues();
loadCoinflips();
loadChat();

setInterval(
  loadChat,
  10000
);

setInterval(
  loadCoinflips,
  10000
);
