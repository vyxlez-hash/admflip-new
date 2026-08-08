const BACKEND = window.location.origin;


// =====================================================
// ELEMENTS
// =====================================================

const loginBtn =
  document.getElementById("loginBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const modal =
  document.getElementById("modal");

const modalClose =
  document.getElementById("modalClose");

const usernameInput =
  document.getElementById("username");

const profile =
  document.getElementById("profile");

const phraseText =
  document.getElementById("phrase");

const verifyBtn =
  document.getElementById("verify");

const loginMessage =
  document.getElementById("loginMessage");

const chatPage =
  document.getElementById("chatPage");

const chatClose =
  document.getElementById("chatClose");

const chatMessages =
  document.getElementById("chatMessages");

const chatInput =
  document.getElementById("chatInput");

const sendChatBtn =
  document.getElementById("sendChatBtn");

const rulesBtn =
  document.getElementById("rulesBtn");

const rulesPopup =
  document.getElementById("rulesPopup");

const rulesClose =
  document.getElementById("rulesClose");

const onlineCount =
  document.getElementById("onlineCount");

const createFlipBtn =
  document.getElementById("createFlipBtn");

const createModal =
  document.getElementById("createModal");

const createClose =
  document.getElementById("createClose");

const inventoryForFlip =
  document.getElementById("inventoryForFlip");

const submitFlip =
  document.getElementById("submitFlip");

const flipMessage =
  document.getElementById("flipMessage");

const coinflipList =
  document.getElementById("coinflipList");

const leaderboard =
  document.getElementById("leaderboard");

const valuesList =
  document.getElementById("valuesList");

const petSearch =
  document.getElementById("petSearch");


// =====================================================
// STATE
// =====================================================

let currentUser = null;

let phrase = "";

let pets = [];

let selectedPet = null;

let selectedSide = null;

let chatOpen = false;


// =====================================================
// SAFE HTML
// =====================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// SITE MESSAGE
// =====================================================

function message(element, text, type = "") {

  if (!element) return;

  element.textContent = text;

  element.className =
    "site-message " + type;
}


// =====================================================
// LOGIN RESTORE
// =====================================================

const savedUser =
  localStorage.getItem("admflipUser");

if (savedUser) {

  try {

    currentUser =
      JSON.parse(savedUser);

    if (
      currentUser &&
      currentUser.id
    ) {

      showUser();

    } else {

      localStorage.removeItem(
        "admflipUser"
      );

      currentUser = null;

    }

  } catch {

    localStorage.removeItem(
      "admflipUser"
    );

  }
}


// =====================================================
// SHOW USER
// =====================================================

function showUser() {

  if (!currentUser) return;


  const avatar =
    currentUser.avatar ||
    "/roblox.png";


  loginBtn.innerHTML = `

    <img
      src="${escapeHTML(avatar)}"
      alt=""
    >

    <span>
      ${escapeHTML(
        currentUser.username
      )}
    </span>

  `;


  loginBtn.classList.add(
    "logged"
  );


  logoutBtn.style.display =
    "block";
}


// =====================================================
// LOGIN MODAL
// =====================================================

loginBtn.onclick = () => {

  if (currentUser) {
    return;
  }

  modal.classList.add("show");

  usernameInput.focus();
};


modalClose.onclick = () => {

  modal.classList.remove(
    "show"
  );

};


modal.onclick = (event) => {

  if (
    event.target === modal
  ) {

    modal.classList.remove(
      "show"
    );

  }

};


// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

usernameInput.onchange =
  async () => {

    const username =
      usernameInput.value.trim();


    if (!username) {
      return;
    }


    message(
      loginMessage,
      "Checking Roblox username..."
    );


    try {

      const response =
        await fetch(
          `${BACKEND}/user/${encodeURIComponent(username)}`
        );


      const data =
        await response.json();


      if (!data.success) {

        message(
          loginMessage,
          data.message ||
          "Roblox username not found.",
          "error"
        );

        return;
      }


      currentUser =
        data.user;


      profile.classList.remove(
        "hidden"
      );


      profile.innerHTML = `

        <div class="login-profile">

          <img
            src="${
              escapeHTML(
                currentUser.avatar ||
                "/roblox.png"
              )
            }"
          >

          <strong>
            ${escapeHTML(
              currentUser.username
            )}
          </strong>

        </div>

      `;


      const phraseResponse =
        await fetch(
          `${BACKEND}/create`
        );


      const phraseData =
        await phraseResponse.json();


      phrase =
        phraseData.phrase;


      phraseText.classList.remove(
        "hidden"
      );


      phraseText.innerHTML = `

        <div class="verification-phrase">

          Put this phrase in your Roblox bio:

          <strong>
            ${escapeHTML(phrase)}
          </strong>

        </div>

      `;


      verifyBtn.style.display =
        "block";


      message(
        loginMessage,
        "Add the phrase to your Roblox bio, then click Verify."
      );


    } catch (error) {

      console.error(error);

      message(
        loginMessage,
        "Unable to contact the server. Try again.",
        "error"
      );

    }

  };


// =====================================================
// VERIFY
// =====================================================

verifyBtn.onclick =
  async () => {

    if (!currentUser) {

      message(
        loginMessage,
        "Enter your Roblox username first.",
        "error"
      );

      return;
    }


    verifyBtn.disabled =
      true;

    verifyBtn.textContent =
      "Checking...";


    try {

      const response =
        await fetch(
          `${BACKEND}/check`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              username:
                currentUser.username,

              phrase:
                phrase

            })

          }
        );


      const data =
        await response.json();


      if (!data.success) {

        message(
          loginMessage,
          data.message ||
          "Verification phrase not found.",
          "error"
        );

        verifyBtn.disabled =
          false;

        verifyBtn.textContent =
          "Verify";

        return;
      }


      currentUser = {

        id: data.id,

        username:
          data.username,

        avatar:
          data.avatar ||
          currentUser.avatar ||
          ""

      };


      localStorage.setItem(
        "admflipUser",
        JSON.stringify(currentUser)
      );


      showUser();


      modal.classList.remove(
        "show"
      );


      usernameInput.value =
        "";

      profile.innerHTML =
        "";

      phraseText.innerHTML =
        "";

      profile.classList.add(
        "hidden"
      );

      phraseText.classList.add(
        "hidden"
      );

      verifyBtn.style.display =
        "none";


      message(
        loginMessage,
        ""
      );


      loadUserInventory();

    } catch (error) {

      console.error(error);

      message(
        loginMessage,
        "Verification failed. Try again.",
        "error"
      );

      verifyBtn.disabled =
        false;

      verifyBtn.textContent =
        "Verify";
    }

  };


// =====================================================
// LOGOUT
// =====================================================

logoutBtn.onclick = () => {

  localStorage.removeItem(
    "admflipUser"
  );


  currentUser = null;

  phrase = "";

  loginBtn.innerHTML = `

    <img
      src="/roblox.png"
      alt=""
    >

    <span>
      Sign In
    </span>

  `;


  loginBtn.classList.remove(
    "logged"
  );


  logoutBtn.style.display =
    "none";

};


// =====================================================
// PAGES
// =====================================================

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(
      section => {

        if (
          section.id === "chatPage"
        ) {
          return;
        }

        section.classList.add(
          "hidden"
        );

      }
    );


  const target =
    document.getElementById(
      `${page}Page`
    );


  if (target) {

    target.classList.remove(
      "hidden"
    );

  }


  localStorage.setItem(
    "admflipPage",
    page
  );


  if (page === "coinflip") {
    loadCoinflips();
  }

  if (page === "values") {
    loadValues();
  }

  if (page === "leaderboard") {
    loadLeaderboard();
  }

}


// =====================================================
// CHAT
// =====================================================

function openChat() {

  chatOpen = true;

  localStorage.setItem(
    "admflipChatOpen",
    "true"
  );


  chatPage.classList.remove(
    "hidden"
  );

  chatPage.classList.add(
    "chat-open"
  );


  loadChat();
}


function closeChat() {

  chatOpen = false;

  localStorage.setItem(
    "admflipChatOpen",
    "false"
  );


  chatPage.classList.remove(
    "chat-open"
  );

  chatPage.classList.add(
    "hidden"
  );

}


function toggleChat() {

  if (chatOpen) {

    closeChat();

  } else {

    openChat();

  }

}


chatClose.onclick =
  closeChat;


document
  .querySelectorAll(
    ".menu button"
  )
  .forEach(button => {

    button.onclick = () => {

      const page =
        button.dataset.page;


      if (page === "chat") {

        toggleChat();

        return;

      }


      closeChat();

      showPage(page);

    };

  });


// =====================================================
// RESTORE PAGE
// =====================================================

const savedPage =
  localStorage.getItem(
    "admflipPage"
  ) || "coinflip";


if (
  savedPage === "chat"
) {

  showPage("coinflip");

} else {

  showPage(savedPage);

}


if (
  localStorage.getItem(
    "admflipChatOpen"
  ) === "true"
) {

  openChat();

}


// =====================================================
// CHAT
// =====================================================

async function loadChat() {

  try {

    const response =
      await fetch(
        `${BACKEND}/chat`
      );


    const data =
      await response.json();


    if (
      !data.success
    ) {

      chatMessages.innerHTML =
        `<div class="empty">
          Unable to load community.
        </div>`;

      return;
    }


    if (
      !data.messages.length
    ) {

      chatMessages.innerHTML =
        `<div class="empty">
          Welcome to ADMFLIP.
        </div>`;

      return;
    }


    chatMessages.innerHTML =
      data.messages
        .map(msg => `

          <div class="chat-message">

            <img
              src="${
                escapeHTML(
                  msg.avatar ||
                  "/roblox.png"
                )
              }"
              onerror="
                this.style.display='none'
              "
            >

            <div>

              <strong>
                ${escapeHTML(
                  msg.username
                )}
              </strong>

              <p>
                ${escapeHTML(
                  msg.message
                )}
              </p>

            </div>

          </div>

        `)
        .join("");


    chatMessages.scrollTop =
      chatMessages.scrollHeight;


  } catch (error) {

    console.error(error);

  }

}


sendChatBtn.onclick =
  sendChat;


chatInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      sendChat();

    }

  }
);


async function sendChat() {

  if (!currentUser) {

    modal.classList.add(
      "show"
    );

    message(
      loginMessage,
      "Sign in before using chat.",
      "error"
    );

    return;
  }


  const text =
    chatInput.value.trim();


  if (!text) {
    return;
  }


  const linkPattern =
    /(https?:\/\/|www\.|discord\.gg|t\.me|[a-z0-9-]+\.(com|net|org|gg|io|xyz|me|co|tv|ly)(\/|\b))/i;


  if (
    linkPattern.test(text)
  ) {

    chatInput.value =
      "";

    return;
  }


  sendChatBtn.disabled =
    true;


  try {

    const response =
      await fetch(
        `${BACKEND}/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            robloxId:
              currentUser.id,

            message:
              text

          })

        }
      );


    const data =
      await response.json();


    if (
      !data.success
    ) {

      return;
    }


    chatInput.value =
      "";

    await loadChat();


  } catch (error) {

    console.error(error);

  } finally {

    sendChatBtn.disabled =
      false;

  }

}


// =====================================================
// RULES
// =====================================================

rulesBtn.onclick = () => {

  rulesPopup.classList.remove(
    "hidden"
  );

};


rulesClose.onclick = () => {

  rulesPopup.classList.add(
    "hidden"
  );

};


rulesPopup.onclick = event => {

  if (
    event.target === rulesPopup
  ) {

    rulesPopup.classList.add(
      "hidden"
    );

  }

};


// =====================================================
// ONLINE COUNT
// =====================================================

function updateOnlineCount() {

  /*
   * This is intentionally a stable-ish display.
   * It does not jump randomly every refresh.
   */

  const saved =
    Number(
      localStorage.getItem(
        "admflipOnlineCount"
      )
    );


  let count =
    Number.isFinite(saved)
      ? saved
      : 42;


  const change =
    Math.floor(
      Math.random() * 5
    ) - 2;


  count += change;


  count =
    Math.max(
      30,
      Math.min(
        54,
        count
      )
    );


  localStorage.setItem(
    "admflipOnlineCount",
    String(count)
  );


  onlineCount.textContent =
    `${count} online`;

}


updateOnlineCount();


setInterval(
  updateOnlineCount,
  65000
);


// =====================================================
// VALUES
// =====================================================

async function loadValues() {

  valuesList.innerHTML =
    `<div class="loading">
      Loading pet values...
    </div>`;


  try {

    const response =
      await fetch(
        `${BACKEND}/pets`
      );


    const data =
      await response.json();


    if (
      !data.success
    ) {

      valuesList.innerHTML =
        `<div class="empty">
          Pet values are unavailable.
        </div>`;

      return;
    }


    pets =
      data.pets || [];


    renderValues(
      pets
    );


  } catch (error) {

    console.error(error);

    valuesList.innerHTML =
      `<div class="empty">
        Pet values are unavailable.
      </div>`;

  }

}


function renderValues(list) {

  if (!list.length) {

    valuesList.innerHTML =
      `<div class="empty">
        No pet values found.
      </div>`;

    return;
  }


  valuesList.innerHTML =
    list.map(pet => {

      const images =
        Array.isArray(
          pet.images
        )
          ? pet.images
          : [];


      const image =
        images[0] || "";


      return `

        <div class="value-card">

          <div class="pet-image-wrap">

            ${
              image
                ? `
                  <img
                    class="pet-image"
                    src="${escapeHTML(image)}"
                    alt=""
                    data-images="${escapeHTML(
                      JSON.stringify(images)
                    )}"
                    onerror="tryNextPetImage(this)"
                  >
                `
                : ""
            }

          </div>


          <div class="pet-info">

            <strong>
              ${escapeHTML(
                cleanPetDisplayName(
                  pet.name
                )
              )}
            </strong>

            <span>
              ${formatValue(
                pet.value
              )}
            </span>

          </div>

        </div>

      `;

    }).join("");

}


function cleanPetDisplayName(name) {

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


function formatValue(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return "N/A";

  }


  return number.toLocaleString();

}


window.tryNextPetImage =
  function(img) {

    try {

      const images =
        JSON.parse(
          img.dataset.images ||
          "[]"
        );


      const current =
        Number(
          img.dataset.index ||
          0
        );


      const next =
        current + 1;


      if (
        next >= images.length
      ) {

        img.style.display =
          "none";

        return;

      }


      img.dataset.index =
        String(next);

      img.src =
        images[next];


    } catch {

      img.style.display =
        "none";

    }

  };


// =====================================================
// SEARCH VALUES
// =====================================================

petSearch.addEventListener(
  "input",
  () => {

    const query =
      petSearch.value
        .trim()
        .toLowerCase();


    const filtered =
      pets.filter(
        pet =>
          pet.name
            .toLowerCase()
            .includes(query)
      );


    renderValues(
      filtered
    );

  }
);


// =====================================================
// LEADERBOARD
// =====================================================

async function loadLeaderboard() {

  leaderboard.innerHTML =
    `<div class="loading">
      Loading leaderboard...
    </div>`;


  try {

    const response =
      await fetch(
        `${BACKEND}/leaderboard`
      );


    const data =
      await response.json();


    if (
      !data.success ||
      !data.users?.length
    ) {

      leaderboard.innerHTML =
        `<div class="empty">
          No wagered players yet.
        </div>`;

      return;
    }


    leaderboard.innerHTML =
      data.users
        .slice(0, 10)
        .map(
          (user, index) => {

            const place =
              index + 1;


            return `

              <div
                class="
                  leaderboard-row
                  place-${place}
                "
              >

                <div
                  class="rank"
                >
                  ${place}
                </div>


                <img
                  src="${
                    escapeHTML(
                      user.avatar ||
                      "/roblox.png"
                    )
                  }"
                  onerror="
                    this.src='/roblox.png'
                  "
                >


                <div
                  class="leader-user"
                >

                  <strong>
                    ${escapeHTML(
                      user.username
                    )}
                  </strong>

                  <span>
                    Wagered
                  </span>

                </div>


                <div
                  class="leader-value"
                >
                  ${formatValue(
                    user.wagered
                  )}
                </div>

              </div>

            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(error);

    leaderboard.innerHTML =
      `<div class="empty">
        Unable to load leaderboard.
      </div>`;

  }

}


// =====================================================
// CREATE COINFLIP
// =====================================================

createFlipBtn.onclick =
  async () => {

    if (!currentUser) {

      modal.classList.add(
        "show"
      );

      message(
        loginMessage,
        "Sign in before creating a coinflip.",
        "error"
      );

      return;
    }


    createModal.classList.remove(
      "hidden"
    );


    selectedPet =
      null;

    selectedSide =
      null;


    flipMessage.textContent =
      "";


    await loadUserInventory();

  };


createClose.onclick = () => {

  createModal.classList.add(
    "hidden"
  );

};


createModal.onclick = event => {

  if (
    event.target === createModal
  ) {

    createModal.classList.add(
      "hidden"
    );

  }

};


// =====================================================
// INVENTORY
// =====================================================

async function loadUserInventory() {

  if (!currentUser) {

    inventoryForFlip.innerHTML =
      `<div class="empty">
        Sign in first.
      </div>`;

    return;
  }


  inventoryForFlip.innerHTML =
    `<div class="loading">
      Loading inventory...
    </div>`;


  try {

    const response =
      await fetch(
        `${BACKEND}/user-data/${currentUser.id}`
      );


    const data =
      await response.json();


    const inventory =
      data?.user?.inventory ||
      [];


    if (!inventory.length) {

      inventoryForFlip.innerHTML = `

        <div class="empty">

          <p>
            You don't have any pets yet.
          </p>

          <button
            class="primary"
            onclick="
              window.open(
                'https://discord.com',
                '_blank'
              )
            "
          >
            Deposit via Discord
          </button>

          <small>
            Automatic bot deposits coming soon.
          </small>

        </div>

      `;

      return;
    }


    inventoryForFlip.innerHTML =
      inventory
        .map(
          (item, index) => `

            <button
              class="inventory-item"
              data-index="${index}"
            >

              <span>
                ${escapeHTML(
                  cleanPetDisplayName(
                    item.name
                  )
                )}
              </span>

              <strong>
                ${formatValue(
                  item.value
                )}
              </strong>

            </button>

          `
        )
        .join("");


    document
      .querySelectorAll(
        ".inventory-item"
      )
      .forEach(button => {

        button.onclick = () => {

          document
            .querySelectorAll(
              ".inventory-item"
            )
            .forEach(
              x =>
                x.classList.remove(
                  "selected"
                )
            );


          button.classList.add(
            "selected"
          );


          const index =
            Number(
              button.dataset.index
            );


          selectedPet =
            inventory[index];

        };

      });


  } catch (error) {

    console.error(error);

    inventoryForFlip.innerHTML =
      `<div class="empty">
        Unable to load inventory.
      </div>`;

  }

}


// =====================================================
// SIDE
// =====================================================

document
  .querySelectorAll(
    ".side-selector button"
  )
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(
          ".side-selector button"
        )
        .forEach(
          x =>
            x.classList.remove(
              "selected"
            )
        );


      button.classList.add(
        "selected"
      );


      selectedSide =
        button.dataset.side;

    };

  });


// =====================================================
// SUBMIT COINFLIP
// =====================================================

submitFlip.onclick =
  async () => {

    if (!currentUser) {

      message(
        flipMessage,
        "Sign in first.",
        "error"
      );

      return;
    }


    if (!selectedPet) {

      message(
        flipMessage,
        "Choose a pet first.",
        "error"
      );

      return;
    }


    if (!selectedSide) {

      message(
        flipMessage,
        "Choose Heads or Tails.",
        "error"
      );

      return;
    }


    submitFlip.disabled =
      true;


    try {

      const response =
        await fetch(
          `${BACKEND}/coinflips`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              robloxId:
                currentUser.id,

              petName:
                selectedPet.name,

              side:
                selectedSide

            })

          }
        );


      const data =
        await response.json();


      if (!data.success) {

        message(
          flipMessage,
          data.message ||
          "Unable to create coinflip.",
          "error"
        );

        return;
      }


      createModal.classList.add(
        "hidden"
      );


      await loadCoinflips();


    } catch (error) {

      console.error(error);

      message(
        flipMessage,
        "Unable to create coinflip.",
        "error"
      );

    } finally {

      submitFlip.disabled =
        false;

    }

  };


// =====================================================
// ACTIVE COINFLIPS
// =====================================================

async function loadCoinflips() {

  coinflipList.innerHTML =
    `<div class="loading">
      Loading active coinflips...
    </div>`;


  try {

    const response =
      await fetch(
        `${BACKEND}/coinflips`
      );


    const data =
      await response.json();


    if (
      !data.success ||
      !data.coinflips?.length
    ) {

      coinflipList.innerHTML =
        `<div class="empty">
          No active coinflips yet.
        </div>`;

      return;
    }


    coinflipList.innerHTML =
      data.coinflips
        .map(flip => `

          <div class="coinflip-card">

            <div class="flip-user">

              <img
                src="${
                  escapeHTML(
                    flip.creatorAvatar ||
                    "/roblox.png"
                  )
                }"
                onerror="
                  this.src='/roblox.png'
                "
              >

              <strong>
                ${escapeHTML(
                  flip.creatorUsername
                )}
              </strong>

            </div>


            <div class="flip-pet">

              <strong>
                ${escapeHTML(
                  cleanPetDisplayName(
                    flip.petName
                  )
                )}
              </strong>

              <span>
                ${formatValue(
                  flip.petValue
                )}
              </span>

            </div>


            <div class="flip-side">

              ${
                escapeHTML(
                  flip.side
                ).toUpperCase()
              }

            </div>


            <button
              class="primary join-flip"
              data-id="${escapeHTML(
                flip._id
              )}"
            >
              Join
            </button>

          </div>

        `)
        .join("");


  } catch (error) {

    console.error(error);

    coinflipList.innerHTML =
      `<div class="empty">
        Unable to load coinflips.
      </div>`;

  }

}


// =====================================================
// INITIAL DATA
// =====================================================

loadValues();

loadCoinflips();

loadLeaderboard();


// Refresh active coinflips periodically
setInterval(
  loadCoinflips,
  15000
);


// Refresh chat only when open
setInterval(
  () => {

    if (chatOpen) {
      loadChat();
    }

  },
  5000
);
