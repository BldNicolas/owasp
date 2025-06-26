# TP Rapport de Recherche de Vulnérabilités et Remédiations

## 1. Informations Générales
- **Nom / Binôme :**  Berlaud Nicolas / Fages Théo
- **Date :** 26/05/2025

---

## 2. Méthodologie
- **Analyse statique :**  
  - Lecture rapide du code backend (TypeScript) et frontend (Vue).  
  - Repérage des zones sensibles (concatenation SQL, routes sans validation, gestion des sessions, etc.).
  - ...
- **Tests dynamiques :**  
  - Requêtes manuelles avec cURL / Postman / navigateur / Burp Suite.  
  - Tentatives d’injection (SQL, paramètre URL, ...) avec quels outils (ex: sqlmap)
  - Contrôle d'accès avec simulation de rôles (admin vs user).  
  - Vérification des en-têtes (cookies, CORS).
  - ...

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

---

### 3.2 XSS (cross-site scripting) sur le champ de recherche
- **Localisation :**  `frontend/src/views/Home.vue`
- **Preuve de concept :**
  1. Sur  `http://localhost:8080` dans le champ de recherche
  2. On met : `<a href="#" onmouseover="alert('XSS')">Survole-moi</a>`
  3. Si on survole la balise <a> qui a été crée, le script se lance.
- **Cause :**  
  - Utilisation de v-html dans Vue.js pour injecter dynamiquement du HTML dans le DOM, sans nettoyage ni échappement des données utilisateur.
  - L’entrée n’est pas désinfectée avant son affichage, permettant l’exécution de scripts malveillants.
- **Remédiation :**  
  - Supprimer l’usage de v-html pour cette donnée dynamique.
  - Rempalcer par une interpolation classique sécurisée avec {{ }} qui échappe automatiquement le contenu :  
    ```vue
<p v-if="searchQueryRaw">
Résultats pour : {{ searchQueryRaw }}
</p> 
```
  - Ne jamais utiliser v-html avec des entrées utilisateur, sauf si le contenu est filtré via une bibliothèque de sanitization comme DOMPurify.

---

### 3.3 XSS (cross-site scripting) dans le contenu d'un article
- **Localisation :**  `frontend/src/views/Article.vue`
- **Preuve de concept :**
  1. Créer un article avec le contenu suivant :
  ```html
  <a href="#" onmouseover="alert('XSS')">Survole-moi</a>
  ```
  2. Aller sur la page de l’article : `http://localhost:8080/articles/:id`
  3. Survoler le lien déclenche une alerte JavaScript.
- **Cause :**  
    - Utilisation de v-html pour afficher le contenu d’un article, sans nettoyage ou filtrage préalable.
	- Cela permet à un utilisateur malveillant d’injecter du HTML ou du JavaScript exécutable dans la page.
- **Remédiation :**  
    - Supprimer l’usage de v-html et afficher le contenu via interpolation :
```html
<p>{{ article.content }}</p>
```
  - Cette méthode garantit que Vue.js échappe automatiquement tout contenu HTML dangereux.

---

### 3.4 Stockage des mots de passe en clair

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
  ---

### 3.5 Broken Access Control 
**3.4.1 Modifications et suppressions d'articles**
- **Localisation :**  `backend/src/controllers/articles.ts`
- **Preuve de concept :**
    1.	L’utilisateur A (id = 1) se connecte et récupère un token/session.
	2.	L’utilisateur B (id = 2) a créé un article avec id = 5.
	3.	L’utilisateur A effectue la requête suivante :
```
PUT /articles/5
{
  "title": "modif non autorisée",
  "content": "nouveau contenu"
}
```
    4.	L’article de l’utilisateur B est modifié par A.
- **Cause :**  
    - Absence de contrôle d’autorisation dans les fonctions modify() et remove().
	- Aucune vérification que l’article appartient à l’utilisateur authentifié (req.session.user.id) avant de modifier ou supprimer.
- **Remédiation :**  
    - Ajouter une vérification explicite dans chaque fonction pour s’assurer que l’article ciblé appartient bien à l’utilisateur :
```ts
const article = await db.get(`SELECT * FROM articles WHERE id = ?`, articleId);
if (!article || article.authorId !== userId) {
  return res.sendStatus(403);
}
```

---
**3.4.2 Accès à la route listAll()**
- **Localisation :**  `backend/src/controllers/articles.ts`
- **Preuve de concept :**
    1.	Un utilisateur connecté (non admin) appelle `/articles/all`.
	2.	Il obtient l'ensemble des articles, y compris ceux d'autres utilisateurs.
- **Cause :**  
    - Aucune vérification du rôle (user.role) avant d’exécuter la requête.
- **Remédiation :**  
    - Restreindre l’accès aux seuls utilisateurs admins :
```ts
if (!user || user.role !== 'admin') {
  return res.sendStatus(403);
}
```

---

### 3.6 Brute force
- **Localisation :**  `backend/src/controllers/auth.ts` + `backend/src/routes/auth.ts`
- **Preuve de concept :**
    1. Effectuer plusieurs requêtes `POST /login` avec différents couples `username/password` invalides.
    2. L’API ne limite pas les tentatives, on peut tester en masse sans blocage.
- **Cause :**  
    - Aucune protection contre les attaques de type brute force dans la logique de connexion.
- **Remédiation :**  
    - Ajout d’un middleware `express-rate-limit` qui limite à 5 tentatives par IP toutes les 15 minutes :
```ts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});
router.post('/login', loginLimiter, login);
```
---
### 3.7. Clé secrète de session prédictible

* **Localisation :** Configuration du middleware `express-session`.

* **Cause :**
  La clé secrète (`secret`) utilisée pour signer les cookies de session est une chaîne de caractères faible et codée en dur (`'secret-key'`). Une clé prédictible permet à un attaquant de forger des identifiants de session valides.

  **Code vulnérable :**

  ```javascript
  app.use(session({
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
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
  }));
  ```
  ---
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
