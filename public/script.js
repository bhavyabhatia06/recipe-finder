
const API = "/api";

let recipes = [];
let allRecipes = [];
let favorites = [];
let shoppingItems = [];
let activeCategory = "";
let currentSearch = "";
let toastTimer;

const $ = (selector) => document.querySelector(selector);

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Something went wrong.");
  }

  return response.json();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getRecipe(id) {
  return allRecipes.find((recipe) => recipe.id === Number(id));
}

async function loadRecipes() {
  const params = new URLSearchParams();

  if (currentSearch) params.set("q", currentSearch);
  if (activeCategory) params.set("category", activeCategory);

  try {
    const query = params.toString();
    recipes = await request(`/recipes${query ? `?${query}` : ""}`);

    renderRecipes();
    $("#recipe-count").textContent =
      `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;
  } catch (error) {
    $("#recipe-grid").innerHTML =
      `<p class="message">${escapeHTML(error.message)}</p>`;
  }
}

function createRecipeCard(recipe) {
  const isFavorite = favorites.includes(recipe.id);

  return `
    <article class="recipe-card">
      <div class="recipe-art" data-view="${recipe.id}" tabindex="0"
           role="button" aria-label="View ${escapeHTML(recipe.name)}">
        <span class="time-badge">◷ ${recipe.time} min</span>
        <span class="food-emoji">${escapeHTML(recipe.emoji)}</span>
        <button class="heart-button ${isFavorite ? "is-favorite" : ""}"
          data-favorite="${recipe.id}" aria-label="Toggle favourite"
          aria-pressed="${isFavorite}">${isFavorite ? "♥" : "♡"}</button>
      </div>
      <div class="recipe-info">
        <span class="recipe-category">${escapeHTML(recipe.category)}</span>
        <h3 data-view="${recipe.id}" tabindex="0">${escapeHTML(recipe.name)}</h3>
        <p class="recipe-description">${escapeHTML(recipe.description)}</p>
        <div class="recipe-footer">
          <span>◷ ${recipe.time} minutes</span>
          <button class="view-button" data-view="${recipe.id}">View recipe →</button>
        </div>
      </div>
    </article>
  `;
}

function renderRecipes() {
  const grid = $("#recipe-grid");

  if (!recipes.length) {
    grid.innerHTML =
      '<p class="message">No recipes found. Try another search or category.</p>';
    return;
  }

  grid.innerHTML = recipes.map(createRecipeCard).join("");
}

function renderFavorites() {
  const grid = $("#favorites-grid");
  const favoriteRecipes = favorites.map(getRecipe).filter(Boolean);

  $("#fav-count").textContent = favorites.length;

  if (!favoriteRecipes.length) {
    grid.innerHTML =
      '<p class="message">No favourites yet. Tap the heart on a recipe to save it!</p>';
    return;
  }

  grid.innerHTML = favoriteRecipes.map(createRecipeCard).join("");
}

async function loadFavorites() {
  favorites = await request("/favorites");
  renderFavorites();
  renderRecipes();
}

async function toggleFavorite(id) {
  const isFavorite = favorites.includes(Number(id));

  try {
    if (isFavorite) {
      await request(`/favorites/${id}`, { method: "DELETE" });
      showToast("Removed from favourites");
    } else {
      await request("/favorites", {
        method: "POST",
        body: JSON.stringify({ id: Number(id) })
      });
      showToast("Added to favourites ♥");
    }

    await loadFavorites();
  } catch (error) {
    showToast(error.message);
  }
}

async function openRecipe(id) {
  let recipe;

  try {
    recipe = await request(`/recipes/${id}`);
  } catch (error) {
    showToast(error.message);
    return;
  }

  $("#recipe-details").innerHTML = `
    <div class="dialog-emoji">${escapeHTML(recipe.emoji)}</div>
    <p class="recipe-category">${escapeHTML(recipe.category)} · ${recipe.time} minutes</p>
    <h2 class="dialog-title">${escapeHTML(recipe.name)}</h2>
    <p class="dialog-description">${escapeHTML(recipe.description)}</p>

    <h3 class="dialog-heading">Ingredients</h3>
    <ul class="dialog-list">
      ${recipe.ingredients.map(item => `<li>${escapeHTML(item)}</li>`).join("")}
    </ul>

    <h3 class="dialog-heading">Cooking instructions</h3>
    <ol class="dialog-steps">
      ${recipe.instructions.map(step => `<li>${escapeHTML(step)}</li>`).join("")}
    </ol>

    <button class="dialog-action" data-add-ingredients="${recipe.id}">
      + Add ingredients to shopping list
    </button>
  `;

  $("#recipe-dialog").showModal();
}

async function loadShoppingList() {
  shoppingItems = await request("/shopping-list");
  renderShoppingList();
}

function renderShoppingList() {
  const list = $("#shopping-list");
  const checkedCount = shoppingItems.filter(item => item.checked).length;

  $("#shopping-summary").textContent =
    `${checkedCount} of ${shoppingItems.length} items checked`;

  if (!shoppingItems.length) {
    list.innerHTML =
      '<li class="message">Your list is empty. Add ingredients or choose them from a recipe.</li>';
    return;
  }

  list.innerHTML = shoppingItems.map(item => `
    <li class="shopping-item ${item.checked ? "checked" : ""}">
      <input type="checkbox" data-check="${item.id}"
        ${item.checked ? "checked" : ""}
        aria-label="Mark ${escapeHTML(item.name)} as purchased">
      <span class="item-name">${escapeHTML(item.name)}</span>
      <button class="remove-item" data-remove="${item.id}">Remove</button>
    </li>
  `).join("");
}

async function addShoppingItem(ingredient) {
  const cleanIngredient = ingredient.trim();
  if (!cleanIngredient) return;

  await request("/shopping-list", {
    method: "POST",
    body: JSON.stringify({ ingredient: cleanIngredient })
  });

  await loadShoppingList();
}

async function removeShoppingItem(id) {
  await request(`/shopping-list/${id}`, { method: "DELETE" });
  await loadShoppingList();
  showToast("Item removed");
}

$("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  currentSearch = $("#search-input").value.trim();
  await loadRecipes();
  $("#discover").scrollIntoView({ behavior: "smooth" });
});

$("#categories").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  activeCategory = button.dataset.category;

  document.querySelectorAll(".category").forEach((item) => {
    item.classList.toggle("active", item === button);
  });

  await loadRecipes();
});

document.addEventListener("click", async (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");

  if (favoriteButton) {
    event.stopPropagation();
    await toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }

  const viewButton = event.target.closest("[data-view]");

  if (viewButton) {
    await openRecipe(viewButton.dataset.view);
    return;
  }

  const addButton = event.target.closest("[data-add-ingredients]");

  if (addButton) {
    const recipe = getRecipe(addButton.dataset.addIngredients);
    if (!recipe) return;

    try {
      for (const ingredient of recipe.ingredients) {
        await addShoppingItem(ingredient);
      }

      showToast("Recipe ingredients added!");
      $("#recipe-dialog").close();
      $("#shopping").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      showToast(error.message);
    }
  }
});

document.addEventListener("keydown", (event) => {
  const viewButton = event.target.closest("[data-view]");

  if (viewButton && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openRecipe(viewButton.dataset.view);
  }
});

$("#close-dialog").addEventListener("click", () => {
  $("#recipe-dialog").close();
});

$("#recipe-dialog").addEventListener("click", (event) => {
  if (event.target === $("#recipe-dialog")) {
    $("#recipe-dialog").close();
  }
});

$("#shopping-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = $("#shopping-input");
  const ingredient = input.value.trim();

  if (!ingredient) return;

  try {
    await addShoppingItem(ingredient);
    input.value = "";
    showToast("Ingredient added");
  } catch (error) {
    showToast(error.message);
  }
});

$("#shopping-list").addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-check]");
  if (!checkbox) return;

  try {
    await request(`/shopping-list/${checkbox.dataset.check}`, {
      method: "PATCH",
      body: JSON.stringify({ checked: checkbox.checked })
    });

    await loadShoppingList();
  } catch (error) {
    showToast(error.message);
  }
});

$("#shopping-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  try {
    await removeShoppingItem(button.dataset.remove);
  } catch (error) {
    showToast(error.message);
  }
});

$("#clear-checked").addEventListener("click", async () => {
  try {
    const checkedItems = shoppingItems.filter(item => item.checked);

    for (const item of checkedItems) {
      await request(`/shopping-list/${item.id}`, { method: "DELETE" });
    }

    await loadShoppingList();
    showToast("Checked items cleared");
  } catch (error) {
    showToast(error.message);
  }
});

async function initialiseApp() {
  try {
    allRecipes = await request("/recipes");
    await loadRecipes();
    await loadFavorites();
    await loadShoppingList();
  } catch (error) {
    showToast("Could not load saved data. Check the server.");
    console.error(error);
  }
}

initialiseApp();
