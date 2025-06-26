
# TP Rapport de Recherche de Vulnérabilités et Remédiations

  

## 1. Informations Générales

-  **Nom / Binôme :** Berlaud Nicolas / Fages Théo

-  **Date :** 26/05/2025

  

---

  

## 2. Méthodologie

-  **Analyse statique :**

- Lecture rapide du code backend (TypeScript) et frontend (Vue).

- Repérage des zones sensibles (concatenation SQL, routes sans validation, gestion des sessions, etc.).

- ...

-  **Tests dynamiques :**

- Requêtes manuelles avec cURL / Postman / navigateur / Burp Suite.

- Tentatives d’injection (SQL, paramètre URL, ...) avec quels outils (ex: sqlmap)

- Contrôle d'accès avec simulation de rôles (admin vs user).

- Vérification des en-têtes (cookies, CORS).

- ...

  

## 3. Vulnérabilités Identifiées

  

### 3.1. Hashage du mot de passe

  

### 3.2 XSS (cross-site scripting) sur le champ de recherche

-  **Localisation :**  `frontend/src/views/Home.vue`

-  **Preuve de concept :**

1. Sur `http://localhost:8080` dans le champ de recherche

2. On met : `<a href="#" onmouseover="alert('XSS')">Survole-moi</a>`

3. Si on survole la balise <a> qui a été crée, le script se lance.

-  **Cause :**

- Utilisation de v-html dans Vue.js pour injecter dynamiquement du HTML dans le DOM, sans nettoyage ni échappement des données utilisateur.

- L’entrée n’est pas désinfectée avant son affichage, permettant l’exécution de scripts malveillants.

-  **Remédiation :**

- Supprimer l’usage de v-html pour cette donnée dynamique.

- Rempalcer par une interpolation classique sécurisée avec {{  }} qui échappe automatiquement le contenu :

```vue

<p  v-if="searchQueryRaw">

Résultats pour : {{ searchQueryRaw }}

</p>

```

- Ne jamais utiliser v-html avec des entrées utilisateur, sauf si le contenu est filtré via une bibliothèque de sanitization comme DOMPurify.

 
---

Ici nous pouvons voir que le code ne hash pas le mot de passe ce qui n'est pas une bonne pratique de sécurité

```json
export async function register(req: Request, res: Response): Promise<any> {
  const { username, password } = req.body;
  await db.run(
    `INSERT INTO users (username, password, role) VALUES (?, ?, 'user')`,
    username,
    password
  );
  res.status(201).json({ message: 'User registered' });
}
```
voici comme résoudre ce problème

```json

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

## Faille importe

```bash
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data',
        expires: 1 * 60 * 60, // 1 heure

    }),
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    name: 'session',
}));
```

on ne pas mettre secret-key comme ca 


```bash
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data',
        expires: 1 * 60 * 60, // 1 heure

    }),
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
    name: 'session',
}));
```
## Injection SQL 
`localhost:3000/api/articles/0' OR '1'='1`

```json
{
  "id": 1,
  "authorId": 2,
  "title": "Comment j'ai découvert Node.js",
  "content": "Lorsque j'ai commencé le développement web, je n'avais jamais utilisé JavaScript côté serveur. \nEn explorant Node.js, j'ai été frappé par sa simplicité d'installation et son écosystème de modules. \nDans cet article, je vous raconte mon parcours d'apprentissage et mes premières réussites."
}
```

pour résoudre cela il faut préparer la données et pas faire de concaténation direct 

```json
const  article  =  await db.get(
	"SELECT * FROM articles WHERE id = ? AND authorId = ?",
	articleId,
	userId,
);
```




# Cors & Token CSRF

Erreur dans le code car tous les sites extérieure peuvent se connecter sur l'utilisateur déja connecté pour éviter : 


`npm install cookie-parser`

`npm install csurf `

```json
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



