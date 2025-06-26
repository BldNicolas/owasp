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

### 3.1. TODO: Hashage du mot de passe

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

### 3.4 TODO Préparer les requêtes SQL

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
