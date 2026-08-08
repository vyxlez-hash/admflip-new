const BACKEND = "https://admflip-new.onrender.com";

const $ = id => document.getElementById(id);

let currentUser = null;
let authToken = localStorage.getItem("admflipToken") || "";
let currentPhrase = "";
let selectedPet = null;
let selectedSide = null;
let currentTipTarget = null;

let chatTimer = null;
let onlineTimer = null;


/* =========================
   HELPERS
========================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return Number(value || 0).toLocaleString();
}

function petImage(name) {
  return `https://amvgg.com/items/${encodeURIComponent(
    String(name || "").trim()
  )}.webp`;
}

function avatarImage(url) {
  return url || "roblox.png";
}

function toast(message) {
  const el = $("toast");

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3500);
}

async function api(path, options = {}) {

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(BACKEND + path, {
    ...options,
    headers
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please sign in first.");
    }

    throw new Error(data.message || "Request failed");
  }

  return data;
}


/* =========================
   LOGIN
========================= */

function saveLogin(user, token) {
  currentUser = user;
  authToken = token;

  localStorage.setItem(
    "admflipUser",
    JSON.stringify(user)
  );

  localStorage.setItem(
    "admflipToken",
    token
  );
}

function loadLogin() {

  const saved = localStorage.getItem("admflipUser");

  if (!saved || !authToken) {
    updateAccountUI();
    return;
  }

  try {
    currentUser = JSON.parse(saved);
    updateAccountUI();

    api("/me")
      .then(data => {
        currentUser = data.user;

        localStorage.setItem(
          "admflipUser",
          JSON.stringify(currentUser)
        );

        updateAccountUI();
        updateChatState();
      })
      .catch(() => {
        localStorage.removeItem("admflipUser");
        localStorage.removeItem("admflipToken");

        currentUser = null;
        authToken = "";

        updateAccountUI();
      });

  } catch {
    localStorage.removeItem("admflipUser");
    localStorage.removeItem("admflipToken");
  }
}

function updateAccountUI() {

  if (currentUser) {

    $("loginBtn").innerHTML = `
      <img src="${escapeHTML(
        avatarImage(currentUser.avatar)
      )}" alt="">
      <span>${escapeHTML(currentUser.username)}</span>
    `;

    $("logoutBtn").style.display = "block";
    $("inventoryBtn").style.display = "block";

  } else {

    $("loginBtn").innerHTML = `
      <img src="roblox.png" alt="">
      <span>Sign In</span>
    `;

    $("logoutBtn").style.display = "none";
    $("inventoryBtn").style.display = "none";
  }

  updateChatState();
}

$("loginBtn").onclick = async () => {

  if (currentUser) {
    showPage("inventory");
    loadInventory();
    return;
  }

  $("modal").classList.add("show");
  $("username").focus();
};

$("closeModal").onclick = () => {
  $("modal").classList.remove("show");
};

$("username").addEventListener("change", async () => {

  const username = $("username").value.trim();

  if (!username) return;

  try {

    const data = await api(
      `/user/${encodeURIComponent(username)}`
    );

    if (!data.success) {
      toast("Roblox username not found.");
      return;
    }

    const user = data.user;

    $("profile").classList.remove("hidden");

    $("profile").innerHTML = `
      <img src="${escapeHTML(user.avatar)}" alt="">
      <br><br>
      <strong>${escapeHTML(user.username)}</strong>
    `;

    const phraseData = await api("/create");

    currentPhrase = phraseData.phrase;

    $("phrase").classList.remove("hidden");

    $("phrase").innerHTML = `
      Put this phrase in your Roblox bio:
      <br><br>
      <strong>${escapeHTML(currentPhrase)}</strong>
    `;

    $("verify").style.display = "block";

  } catch (error) {
    toast(error.message);
  }
});

$("verify").onclick = async () => {

  $("verify").disabled = true;
  $("verify").textContent = "Checking...";

  try {

    const data = await api("/check", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value.trim(),
        phrase: currentPhrase
      })
    });

    if (!data.success) {
      toast(data.message || "Verification failed.");
      return;
    }

    saveLogin(data.user, data.token);

    $("modal").classList.remove("show");

    $("username").value = "";
    $("profile").classList.add("hidden");
    $("phrase").classList.add("hidden");
    $("verify").style.display = "none";

    updateAccountUI();

    toast("Verified successfully.");

    loadInventory();
    loadChat();

  } catch (error) {

    toast(error.message);

  } finally {

    $("verify").disabled = false;
    $("verify").textContent = "Verify";
  }
};

$("logoutBtn").onclick = () => {

  currentUser = null;
  authToken = "";

  localStorage.removeItem("admflipUser");
  localStorage.removeItem("admflipToken");

  updateAccountUI();

  toast("Logged out.");
};


/* =========================
   NAVIGATION
========================= */

function showPage(page) {

  const pages = [
    "coinflip",
    "values",
    "leaderboard",
    "inventory"
  ];

  pages.forEach(name => {

    const el = $(name + "Page");

    if (el) {
      el.classList.toggle(
        "hidden-page",
        name !== page
      );
    }
  });

  document.querySelectorAll(".menu button[data-page]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

  sessionStorage.setItem(
    "admflipPage",
    page
  );

  if (page === "coinflip") loadCoinflips();
  if (page === "values") loadValues();
  if (page === "leaderboard") loadLeaderboard();
  if (page === "inventory") loadInventory();
}

document.querySelectorAll(".menu button[data-page]")
  .forEach(button => {

    button.onclick = () => {
      showPage(button.dataset.page);
    };

  });


/* =========================
   CHAT
========================= */

function updateChatState() {

  if (currentUser) {

    $("chatLoginMessage").style.display = "none";
    $("chatForm").style.display = "flex";

  } else {

    $("chatLoginMessage").style.display = "block";
    $("chatForm").style.display = "none";
  }
}

async function loadChat() {

  try {

    const data = await api("/chat");

    $("chatMessages").innerHTML = "";

    data.messages.forEach(message => {

      const div = document.createElement("div");

      div.className = "chat-message";

      div.innerHTML = `
        <img
          src="${escapeHTML(
            avatarImage(message.avatar)
          )}"
          alt=""
        >

        <div class="chat-message-content">

          <div>
            <span class="chat-name">
              ${escapeHTML(message.username)}
            </span>

            <span class="chat-time">
              ${new Date(message.createdAt)
                .toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
            </span>
          </div>

          <div class="chat-text">
            ${escapeHTML(message.text)}
          </div>

        </div>
      `;

      div.querySelector("img").onclick = () => {
        openUserProfile(message.robloxId);
      };

      $("chatMessages").appendChild(div);
    });

    $("chatMessages").scrollTop =
      $("chatMessages").scrollHeight;

  } catch (error) {
    console.log(error.message);
  }
}

$("chatForm").onsubmit = async event => {

  event.preventDefault();

  if (!currentUser) {
    toast("Sign in first.");
    return;
  }

  const input = $("chatInput");
  const text = input.value.trim();

  if (!text) return;

  try {

    await api("/chat", {
      method: "POST",
      body: JSON.stringify({ text })
    });

    input.value = "";

    await loadChat();

  } catch (error) {

    toast(error.message);
  }
};

$("rulesBtn").onclick = () => {
  $("rulesOverlay").classList.remove("hidden");
};

$("closeRules").onclick = () => {
  $("rulesOverlay").classList.add("hidden");
};

$("chatTopBtn").onclick = () => {

  if (window.innerWidth <= 900) {

    $("chatPanel").classList.toggle("mobile-open");

  } else {

    $("chatPanel").scrollIntoView({
      behavior: "smooth"
    });
  }
};

$("mobileChatBtn").onclick = () => {
  $("chatPanel").classList.toggle("mobile-open");
};

function updateOnline() {

  const number =
    Math.floor(
      20 + Math.random() * 26
    );

  $("onlineCount").textContent = number;
}

function startOnlineCounter() {

  updateOnline();

  clearInterval(onlineTimer);

  onlineTimer = setInterval(
    updateOnline,
    100000
  );
}


/* =========================
   VALUES
========================= */

let allPets = [];

async function loadValues() {

  try {

    const data = await api("/pets");

    allPets = data.pets || [];

    renderValues(allPets);

  } catch (error) {

    $("valuesList").innerHTML = `
      <div class="empty-state">
        <h3>Values unavailable</h3>
        <p>
          The values service could not be reached.
          You can still use the rest of ADMFLIP.
        </p>
      </div>
    `;
  }
}

function renderValues(pets) {

  if (!pets.length) {

    $("valuesList").innerHTML = `
      <div class="empty-state">
        No pets found.
      </div>
    `;

    return;
  }

  $("valuesList").innerHTML =
    pets.map(petCard).join("");

  document.querySelectorAll(
    "#valuesList .pet-image"
  ).forEach(img => {

    img.onerror = () => {
      img.classList.add("missing");
    };

  });
}

function petCard(pet, selectable = false) {

  const image =
    pet.image ||
    petImage(pet.name);

  const selected =
    selectedPet &&
    selectedPet.itemId === pet.itemId;

  return `
    <div
      class="pet-card ${selected ? "selected" : ""}"
      ${selectable ? `data-item="${escapeHTML(
        pet.itemId || ""
      )}"` : ""}
    >

      <div class="pet-image-wrap">

        <img
          class="pet-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(pet.name)}"
          loading="lazy"
        >

      </div>

      <div class="pet-name">
        ${escapeHTML(pet.name)}
      </div>

      ${
        pet.variants
          ? `<div class="pet-meta">
              ${pet.variants.map(
                x => `<span class="variant">${escapeHTML(x)}</span>`
              ).join("")}
            </div>`
          : ""
      }

      ${
        pet.rarity
          ? `<div class="pet-meta">
              ${escapeHTML(pet.rarity)}
            </div>`
          : ""
      }

      <div class="pet-value">
        ${money(pet.value)}
      </div>

    </div>
  `;
}

$("valueSearch").oninput = () => {

  const search =
    $("valueSearch").value
      .trim()
      .toLowerCase();

  renderValues(
    allPets.filter(
      pet =>
        pet.name.toLowerCase()
          .includes(search)
    )
  );
};


/* =========================
   INVENTORY
========================= */

async function loadInventory() {

  if (!currentUser) {

    $("inventoryList").innerHTML = `
      <div class="empty-state">
        <h3>Sign in first</h3>
        <p>Your inventory is available after Roblox verification.</p>
      </div>
    `;

    return;
  }

  try {

    const data = await api("/inventory");

    $("inventoryTitle").textContent =
      `${currentUser.username}'s Inventory`;

    $("inventoryTotal").textContent =
      `${money(data.totalValue)} value`;

    if (!data.inventory.length) {

      $("inventoryList").innerHTML = `
        <div class="empty-state">
          <h3>Your inventory is empty</h3>
          <button class="primary" onclick="depositPets()">
            Deposit
          </button>
        </div>
      `;

      return;
    }

    $("inventoryList").innerHTML =
      data.inventory.map(
        pet => petCard(pet)
      ).join("");

  } catch (error) {

    toast(error.message);
  }
}

$("inventoryBtn").onclick = () => {

  showPage("inventory");
  loadInventory();
};

$("depositBtn").onclick = depositPets;

function depositPets() {

  toast(
    "Deposit via Discord is temporary. Automatic deposits are coming soon."
  );
}


/* =========================
   CREATE COINFLIP
========================= */

$("createFlipBtn").onclick = async () => {

  if (!currentUser) {
    toast("Sign in first.");
    $("modal").classList.add("show");
    return;
  }

  selectedPet = null;
  selectedSide = null;

  $("sideChooser").classList.add("hidden");

  $("createFlipModal").classList.add("show");

  try {

    const data = await api("/inventory");

    if (!data.inventory.length) {

      $("createInventory").innerHTML = "";

      $("noPetsCreate").classList.remove("hidden");

      return;
    }

    $("noPetsCreate").classList.add("hidden");

    $("createInventory").innerHTML =
      data.inventory.map(
        pet => petCard(pet, true)
      ).join("");

    document.querySelectorAll(
      "#createInventory .pet-card"
    ).forEach(card => {

      card.onclick = () => {

        const item =
          data.inventory.find(
            x => x.itemId === card.dataset.item
          );

        if (!item) return;

        selectedPet = item;

        document.querySelectorAll(
          "#createInventory .pet-card"
        ).forEach(x =>
          x.classList.remove("selected")
        );

        card.classList.add("selected");

        $("sideChooser").classList.remove(
          "hidden"
        );
      };

    });

  } catch (error) {

    toast(error.message);
  }
};

$("closeCreate").onclick = () => {
  $("createFlipModal").classList.remove("show");
};

document.querySelectorAll(
  ".side-buttons button"
).forEach(button => {

  button.onclick = () => {

    selectedSide = button.dataset.side;

    document.querySelectorAll(
      ".side-buttons button"
    ).forEach(x =>
      x.classList.remove("selected")
    );

    button.classList.add("selected");
  };
});

$("postFlip").onclick = async () => {

  if (!selectedPet || !selectedSide) {
    toast("Choose a pet and side.");
    return;
  }

  try {

    await api("/coinflips", {
      method: "POST",
      body: JSON.stringify({
        itemId: selectedPet.itemId,
        side: selectedSide
      })
    });

    $("createFlipModal").classList.remove(
      "show"
    );

    toast("Coinflip posted.");

    showPage("coinflip");

  } catch (error) {

    toast(error.message);
  }
};


/* =========================
   COINFLIPS
========================= */

async function loadCoinflips() {

  try {

    const data = await api("/coinflips");

    if (!data.coinflips.length) {

      $("coinflipList").innerHTML = `
        <div class="empty-state">
          <h3>No active coinflips yet.</h3>
          <p>Create one and be the first trader.</p>
        </div>
      `;

      return;
    }

    $("coinflipList").innerHTML =
      data.coinflips.map(renderCoinflip).join("");

    document.querySelectorAll(
      ".cf-join"
    ).forEach(button => {

      if (button.dataset.action === "join") {

        button.onclick = () =>
          joinCoinflip(button.dataset.id);

      }

      if (button.dataset.action === "bot") {

        button.onclick = () =>
          callBot(button.dataset.id);
      }
    });

    document.querySelectorAll(
      ".cf-eye"
    ).forEach(button => {

      button.onclick = () =>
        showCoinflipDetails(button.dataset.id);

    });

  } catch (error) {

    $("coinflipList").innerHTML = `
      <div class="empty-state">
        ${escapeHTML(error.message)}
      </div>
    `;
  }
}

function renderCoinflip(cf) {

  const left = cf.creatorPet;
  const right = cf.joinerPet;

  const leftValue = Number(left?.value || 0);
  const rightValue = Number(right?.value || 0);

  const total =
    leftValue + rightValue;

  const leftPercent =
    total
      ? ((leftValue / total) * 100).toFixed(2)
      : "50.00";

  const rightPercent =
    total
      ? ((rightValue / total) * 100).toFixed(2)
      : "50.00";

  const isOwner =
    currentUser &&
    String(cf.creatorRobloxId) ===
      String(currentUser.id);

  return `
    <article class="coinflip-card">

      <div class="cf-users">

        <div class="cf-user">
          <img
            class="avatar"
            src="${escapeHTML(
              avatarImage(cf.creatorAvatar)
            )}"
            alt=""
          >

          <strong>
            ${escapeHTML(cf.creatorUsername)}
          </strong>
        </div>

        <div class="cf-vs">VS</div>

        <div class="cf-user right">

          ${
            right
              ? `
                <strong>
                  ${escapeHTML(
                    cf.joinerUsername
                  )}
                </strong>

                <img
                  class="avatar"
                  src="${escapeHTML(
                    avatarImage(
                      cf.joinerAvatar
                    )
                  )}"
                  alt=""
                >
              `
              : `
                <strong>
                  Waiting...
                </strong>
              `
          }

        </div>

      </div>

      <div class="cf-body">

        <div class="cf-side">

          <div class="cf-percent">
            ${leftPercent}%
          </div>

          <div class="cf-total">
            ${money(leftValue)}
          </div>

          ${renderCFPet(left)}

        </div>

        <div class="cf-vs">
          ${escapeHTML(cf.creatorSide)}
        </div>

        <div class="cf-side right">

          <div class="cf-percent">
            ${rightPercent}%
          </div>

          <div class="cf-total">
            ${money(rightValue)}
          </div>

          ${right
            ? renderCFPet(right)
            : `<span class="muted">Open slot</span>`
          }

        </div>

      </div>

      <div class="cf-join">

        ${
          isOwner
            ? `
              <button
                class="cf-eye"
                data-id="${cf._id}"
              >
                👁
              </button>

              <button
                class="cf-join"
                data-action="bot"
                data-id="${cf._id}"
                style="margin-left:8px"
              >
                Call Bot
              </button>
            `
            : cf.status === "active"
              ? `
                <button
                  class="primary cf-join"
                  data-action="join"
                  data-id="${cf._id}"
                >
                  Join
                </button>
              `
              : ""
        }

      </div>

    </article>
  `;
}

function renderCFPet(pet) {

  if (!pet) return "";

  return `
    <div class="cf-pet">

      <img
        src="${escapeHTML(
          pet.image ||
          petImage(pet.name)
        )}"
        alt="${escapeHTML(pet.name)}"
        onerror="this.style.display='none'"
      >

      <div>

        <div>
          ${
            pet.variants
              ? pet.variants.map(
                  x => `<span class="variant">${escapeHTML(x)}</span>`
                ).join("")
              : ""
          }
        </div>

        <strong>
          ${escapeHTML(pet.name)}
        </strong>

        <div class="cf-total">
          ${money(pet.value)}
        </div>

      </div>

    </div>
  `;
}

async function joinCoinflip(id) {

  if (!currentUser) {
    toast("Sign in first.");
    return;
  }

  try {

    const data = await api(
      `/coinflips/${id}/join`,
      { method: "POST" }
    );

    await loadCoinflips();

    if (data.result) {
      showFlipResult(data.result);
    }

  } catch (error) {

    toast(error.message);
  }
}

async function callBot(id) {

  try {

    const data = await api(
      `/coinflips/${id}/bot`,
      { method: "POST" }
    );

    if (data.result) {
      showFlipResult(data.result);
    }

    await loadCoinflips();

  } catch (error) {

    toast(error.message);
  }
}

async function showCoinflipDetails(id) {

  try {

    const data =
      await api(`/coinflips/${id}`);

    toast(
      data.coinflip.joinerUsername
        ? `Joined by ${data.coinflip.joinerUsername}`
        : "Waiting for another trader."
    );

  } catch (error) {

    toast(error.message);
  }
}

function showFlipResult(result) {

  $("flipResultModal").classList.add("show");

  $("flipResultTitle").textContent =
    result.winnerUsername === currentUser?.username
      ? "You Won!"
      : "Coinflip Result";

  $("flipResultText").innerHTML = `
    <p>
      Result:
      <strong>${escapeHTML(result.result)}</strong>
    </p>

    <p>
      Winner:
      <strong>${escapeHTML(
        result.winnerUsername
      )}</strong>
    </p>

    <p>
      Pet:
      <strong>${escapeHTML(
        result.petName
      )}</strong>
    </p>
  `;

  const coin = $("coinAnimation");

  coin.classList.add("flipping");

  setTimeout(() => {

    coin.classList.remove("flipping");

    coin.querySelector("span")
      .textContent = result.result;

  }, 1800);
}

$("closeFlipResult").onclick = () => {

  $("flipResultModal")
    .classList.remove("show");

  loadInventory();
  loadCoinflips();
};


/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard() {

  try {

    const data =
      await api("/leaderboard");

    $("leaderboardList").innerHTML =
      data.players.map(
        (player, index) => `

          <div class="leader-row">

            <div class="rank">
              #${index + 1}
            </div>

            <div class="cf-user">

              <img
                class="avatar"
                src="${escapeHTML(
                  avatarImage(
                    player.avatar
                  )
                )}"
                alt=""
              >

              <strong>
                ${escapeHTML(
                  player.username
                )}
              </strong>

            </div>

            <div class="wager">
              ${money(player.wagered)}
            </div>

          </div>

        `
      ).join("");

  } catch (error) {

    $("leaderboardList").innerHTML = `
      <div class="empty-state">
        ${escapeHTML(error.message)}
      </div>
    `;
  }
}


/* =========================
   USER PROFILE / TIP
========================= */

async function openUserProfile(robloxId) {

  try {

    const data =
      await api(
        `/users/${encodeURIComponent(robloxId)}`
      );

    const user = data.user;

    $("userProfileModal").classList.add(
      "show"
    );

    $("profileModalContent").innerHTML = `

      <div style="text-align:center">

        <img
          class="avatar"
          style="width:75px;height:75px"
          src="${escapeHTML(
            avatarImage(user.avatar)
          )}"
        >

        <h2>
          ${escapeHTML(user.username)}
        </h2>

        <p>
          Wagered:
          <strong>
            ${money(user.wagered)}
          </strong>
        </p>

        <p>
          Profit:
          <strong>
            ${money(user.profit)}
          </strong>
        </p>

        ${
          currentUser &&
          String(currentUser.id) !==
            String(user.robloxId)
            ? `
              <button
                id="profileTipBtn"
                class="primary"
              >
                Tip
              </button>
            `
            : ""
        }

      </div>
    `;

    const tipBtn =
      $("profileTipBtn");

    if (tipBtn) {

      tipBtn.onclick = () => {

        $("userProfileModal")
          .classList.remove("show");

        openTipModal(user);
      };
    }

  } catch (error) {

    toast(error.message);
  }
}

async function openTipModal(user) {

  if (!currentUser) {
    toast("Sign in first.");
    return;
  }

  currentTipTarget = user;

  $("tipTarget").textContent =
    `Choose a pet to tip ${user.username}.`;

  $("tipModal").classList.add("show");

  try {

    const data =
      await api("/inventory");

    $("tipInventory").innerHTML =
      data.inventory.length
        ? data.inventory.map(
            pet => petCard(pet, true)
          ).join("")
        : `
          <div class="empty-state">
            Your inventory is empty.
          </div>
        `;

    document.querySelectorAll(
      "#tipInventory .pet-card"
    ).forEach(card => {

      card.onclick = async () => {

        const item =
          data.inventory.find(
            x =>
              x.itemId ===
              card.dataset.item
          );

        if (!item) return;

        try {

          await api("/tip", {
            method: "POST",
            body: JSON.stringify({
              recipientRobloxId:
                currentTipTarget.robloxId,
              itemId: item.itemId
            })
          });

          $("tipModal")
            .classList.remove("show");

          toast("Pet tipped successfully.");

          loadInventory();

        } catch (error) {

          toast(error.message);
        }
      };

    });

  } catch (error) {

    toast(error.message);
  }
}

$("closeUserProfile").onclick = () => {
  $("userProfileModal")
    .classList.remove("show");
};

$("closeTip").onclick = () => {
  $("tipModal")
    .classList.remove("show");
};


/* =========================
   START
========================= */

loadLogin();

startOnlineCounter();

const savedPage =
  sessionStorage.getItem("admflipPage") ||
  "coinflip";

showPage(savedPage);

loadChat();

chatTimer = setInterval(
  loadChat,
  5000
);
