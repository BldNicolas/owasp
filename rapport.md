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

### 3.1. Hashage du mot de passe

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
