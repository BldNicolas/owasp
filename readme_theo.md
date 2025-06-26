# Rapport de Recherche de Vulnérabilités et Remédiations

## 1. Informations Générales

* **Nom / Binôme :** Berlaud Nicolas / Fages Théo

* **Date :** 26/05/2025

---

## 2. Méthodologie

La méthodologie adoptée pour cet audit combine des analyses statiques et dynamiques afin d'obtenir une couverture maximale.

* **Analyse Statique :**

  * Lecture et revue du code source du backend (TypeScript) et du frontend (Vue.js).

  * Identification des zones de code sensibles : concaténations dans les requêtes SQL, routes d'API sans validation des entrées, gestion des sessions et des cookies, utilisation de fonctions potentiellement dangereuses (`v-html`).

* **Tests Dynamiques :**

  * Envoi de requêtes manuelles à l'aide d'outils comme cURL, Postman, et les outils de développement du navigateur.

  * Utilisation de Burp Suite pour intercepter, analyser et modifier les requêtes HTTP.

  * Tentatives d'injection (SQL, XSS) avec des charges utiles manuelles et des outils automatisés comme `sqlmap`.

  * Tests de contrôle d'accès en simulant des sessions avec différents rôles (administrateur vs. utilisateur simple).

  * Vérification des en-têtes de sécurité HTTP (CORS, Cookies, etc.).

---

## 3. Vulnérabilités Identifiées

### 3.1. Injection SQL via les paramètres d'URL

* **Localisation :** Route API récupérant les articles (`/api/articles/:id`).

* **Preuve de Concept (PoC) :**
  L'URL suivante permet de contourner la logique de sélection et de récupérer le premier article de la base, quel que soit son `id` ou son `authorId` :
  `http://localhost:3000/api/articles/0' OR '1'='1`

* **Cause :**
  La requête SQL est construite par concaténation directe de l'entrée utilisateur (`articleId`) sans aucun échappement ni validation. Cela permet à un attaquant d'injecter du code SQL malveillant.

* **Remédiation :**
  Il est impératif d'utiliser des **requêtes préparées** (prepared statements) avec des paramètres. Cette méthode sépare le code SQL des données, empêchant toute injection.

  **Exemple de correction :**

  ```typescript
  // Récupère l'article en utilisant des paramètres bindés (?)
  const article = await db.get(
      "SELECT * FROM articles WHERE id = ? AND authorId = ?",
      articleId,
      userId
  );
  ```

### 3.2. Cross-Site Scripting (XSS) sur le champ de recherche

* **Localisation :** `frontend/src/views/Home.vue`

* **Preuve de Concept (PoC) :**

  1. Naviguer sur `http://localhost:8080`.

  2. Dans le champ de recherche, injecter le code HTML suivant : `<a href="#" onmouseover="alert('XSS PoC')">Survole-moi</a>`

  3. Le survol du lien généré dans la page de résultats exécute le script JavaScript.

* **Cause :**
  L'application utilise la directive `v-html` de Vue.js pour afficher les termes de la recherche. Cette directive interprète la chaîne de caractères comme du HTML brut, ce qui permet l'exécution de scripts si l'entrée utilisateur n'est pas préalablement nettoyée (sanitized).

* **Remédiation :**
  Remplacer l'usage de `v-html` par l'interpolation standard `{{ variable }}` qui échappe automatiquement les caractères spéciaux et neutralise toute tentative d'injection de balises HTML ou de scripts.

  **Exemple de correction :**

  ```vue
  <p v-if="searchQueryRaw">
    <!-- L'interpolation {{ }} garantit que la donnée est traitée comme du texte brut -->
    Résultats pour : {{ searchQueryRaw }}
  </p>
  ```

  Si l'affichage de HTML riche est absolument nécessaire, utilisez une bibliothèque de "sanitization" comme **DOMPurify** pour filtrer le contenu avant de l'injecter.

### 3.3. Stockage des mots de passe en clair

* **Localisation :** Fonction d'inscription (`register`).

* **Cause :**
  Le mot de passe fourni par l'utilisateur est inséré directement dans la base de données sans aucune transformation. En cas de fuite de données, tous les mots de passe des utilisateurs seraient exposés.

  **Code vulnérable :**

  ```typescript
  export async function register(req: Request, res: Response): Promise<any> {
    const { username, password } = req.body;
    // Le mot de passe est inséré en clair
    await db.run(
      `INSERT INTO users (username, password, role) VALUES (?, ?, 'user')`,
      username,
      password
    );
    res.status(201).json({ message: 'User registered' });
  }
  ```

* **Remédiation :**
  Il faut **hasher** les mots de passe à l'aide d'un algorithme robuste et lent comme **bcrypt**. Le hash, et non le mot de passe, est ensuite stocké en base de données.

  **Exemple de correction avec `bcrypt` :**

  ```typescript
  import * as bcrypt from 'bcrypt';
  
  export async function register(req: Request, res: Response): Promise<any> {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(
        `INSERT INTO users (username, password, role) VALUES (?, ?, 'user')`,
        username,
        hashedPassword
      );
      res.status(201).json({ message: 'User registered' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  ```

### 3.4. Clé secrète de session prédictible

* **Localisation :** Configuration du middleware `express-session`.

* **Cause :**
  La clé secrète (`secret`) utilisée pour signer les cookies de session est une chaîne de caractères faible et codée en dur (`'secret-key'`). Une clé prédictible permet à un attaquant de forger des identifiants de session valides.

  **Code vulnérable :**

  ```javascript
  app.use(session({
      // ...
      secret: 'secret-key',
      resave: false,
      saveUninitialized: false,
  }));
  ```

* **Remédiation :**
  La clé secrète doit être une chaîne de caractères longue, complexe et aléatoire. Elle doit être stockée en dehors du code source, par exemple dans une **variable d'environnement**.

  **Exemple de correction :**

  ```javascript
  app.use(session({
      secret: process.env.secret,
      resave: false,
      saveUninitialized: false,
  }));
  ```

### 3.5. Absence de protection contre les attaques CSRF (Cross-Site Request Forgery)

* **Cause :**
  L'application ne met en œuvre aucun mécanisme de protection contre les attaques CSRF. Un attaquant pourrait héberger un site malveillant qui force le navigateur d'un utilisateur authentifié à exécuter des actions non désirées sur l'application (par exemple, supprimer un article, changer un mot de passe).

* **Remédiation :**
  Implémenter une protection basée sur des **tokens CSRF** (aussi appelés "jetons anti-falsification"). Le principe est de générer un token unique et secret pour chaque session utilisateur. Ce token doit être ajouté à toutes les requêtes qui modifient l'état de l'application (POST, PUT, DELETE). Le serveur valide ensuite la présence et la correction de ce token avant d'exécuter la requête.

  **Exemple d'implémentation avec `csurf` :**

  1. Installer les dépendances : `npm install cookie-parser csurf`

  2. Configurer les middlewares dans l'application Express :

  ```javascript
  import cookieParser from 'cookie-parser';
  import csurf from 'csurf';
  
  
  app.use(cookieParser());

  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );
  
  app.use((req, res, next) => {
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
      httpOnly: false, 
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    next();
  });
  ```

  Le frontend doit ensuite être configuré pour lire le token depuis le cookie `XSRF-TOKEN` et l'inclure dans un en-tête HTTP (ex: `X-CSRF-Token`) pour chaque requête sensible.
