
const express = require("express");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const db = new Database(path.join(__dirname, "recipefinder.db"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const recipes = JSON.parse(
  fs.readFileSync(path.join(dataDir, "recipes.json"), "utf8")
);

// Create SQLite database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    recipe_id INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    checked INTEGER NOT NULL DEFAULT 0
  );
`);

function getFavorites() {
  return db.prepare(
    "SELECT recipe_id FROM favorites ORDER BY recipe_id"
  ).all().map(row => row.recipe_id);
}

function getShoppingList() {
  return db.prepare(
    "SELECT id, name, checked FROM shopping_list ORDER BY id DESC"
  ).all().map(item => ({
    ...item,
    checked: Boolean(item.checked)
  }));
}

function findRecipe(id) {
  return recipes.find(recipe => recipe.id === Number(id));
}

// 1. Search and filter recipes
app.get("/api/recipes", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();

  const result = recipes.filter(recipe => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(query) ||
      recipe.ingredients.some(item =>
        item.toLowerCase().includes(query)
      );

    const matchesCategory =
      !category || recipe.category.toLowerCase() === category;

    return matchesSearch && matchesCategory;
  });

  res.json(result);
});

// 2. Get recipe details
app.get("/api/recipes/:id", (req, res) => {
  const recipe = findRecipe(req.params.id);

  if (!recipe) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  res.json(recipe);
});

// 3. Get favourites
app.get("/api/favorites", (req, res) => {
  res.json(getFavorites());
});

// 4. Add favourite
app.post("/api/favorites", (req, res) => {
  const id = Number(req.body.id);

  if (!findRecipe(id)) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  db.prepare(
    "INSERT OR IGNORE INTO favorites (recipe_id) VALUES (?)"
  ).run(id);

  res.json({ success: true, favorites: getFavorites() });
});

// 5. Remove favourite
app.delete("/api/favorites/:id", (req, res) => {
  db.prepare("DELETE FROM favorites WHERE recipe_id = ?")
    .run(Number(req.params.id));

  res.json({ success: true, favorites: getFavorites() });
});

// 6. Get shopping list
app.get("/api/shopping-list", (req, res) => {
  res.json(getShoppingList());
});

// 7. Add shopping-list ingredient
app.post("/api/shopping-list", (req, res) => {
  const ingredient = String(req.body.ingredient || "").trim();

  if (!ingredient || ingredient.length > 150) {
    return res.status(400).json({ error: "Invalid ingredient" });
  }

  db.prepare(
    "INSERT OR IGNORE INTO shopping_list (name) VALUES (?)"
  ).run(ingredient);

  res.json({ success: true, shoppingList: getShoppingList() });
});

// 8. Remove shopping-list ingredient
app.delete("/api/shopping-list/:id", (req, res) => {
  db.prepare("DELETE FROM shopping_list WHERE id = ?")
    .run(Number(req.params.id));

  res.json({ success: true, shoppingList: getShoppingList() });
});

// 9. Mark ingredient purchased / unpurchased
app.patch("/api/shopping-list/:id", (req, res) => {
  if (typeof req.body.checked !== "boolean") {
    return res.status(400).json({ error: "Invalid checkbox value" });
  }

  const result = db.prepare(
    "UPDATE shopping_list SET checked = ? WHERE id = ?"
  ).run(req.body.checked ? 1 : 0, Number(req.params.id));

  if (!result.changes) {
    return res.status(404).json({ error: "Ingredient not found" });
  }

  res.json({ success: true, shoppingList: getShoppingList() });
});

app.listen(PORT, () => {
  console.log(`Recipe Finder running at http://localhost:${PORT}`);
});
