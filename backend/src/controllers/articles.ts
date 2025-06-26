import { Request, Response } from 'express';
import { db } from '@/database';


export async function list(req: Request, res: Response): Promise<any> {
  const userId = req.session.user!.id;
  let articles = await db.all('SELECT * FROM articles WHERE authorId = ?', userId);
  articles = articles.map(article => ({
    id: article.id,
    title: article.title
  }))
  console.log("list")
  res.json(articles);
}

// Permet à l'admin de lister tous les articles de tout le monde
export async function listAll(req: Request, res: Response): Promise<any> {
  const user = req.session.user;
  if (!user || user.role !== 'admin') {
    return res.sendStatus(403);
  }
  const articles = await db.all(
    'SELECT articles.*, users.username FROM articles LEFT JOIN users ON (articles.authorId = users.id)'
  );
  res.json(articles);
}


export async function create(req: Request, res: Response): Promise<any> {
  const userId = req.session.user!.id;
  const { title, content } = req.body;
  const result = await db.run(
    'INSERT INTO articles (authorId, title, content) VALUES (?, ?, ?)',
    userId, title, content
  );
  console.log("create");
  res.status(201).json({ id: result.lastID });
}


export async function get(req: Request, res: Response): Promise<any> {
  const articleId = req.params.id;
  const userId = req.session.user!.id;
  const article = await db.get(
    "SELECT * FROM articles WHERE id = ? AND authorId = ?",
    articleId,
    userId,
  );
  if (!article) return res.sendStatus(404)
  console.log("get");
  res.json(article);
}



export async function modify(req: Request, res: Response): Promise<any> {
  const articleId = req.params.id;
  const userId = req.session.user!.id;
  const article = await db.get(`SELECT * FROM articles WHERE id = ?`, articleId);
  if (!article || article.authorId !== userId) {
    return res.sendStatus(403);
  }
  const { title, content } = req.body;
  await db.run(
    `UPDATE articles SET title=?, content=? WHERE id=?`,
    title, content, articleId
  );
  console.log("modify");
  res.json({ message: 'Updated' });
}


export async function remove(req: Request, res: Response): Promise<any> {
  const articleId = req.params.id;
  const userId = req.session.user!.id;
  const article = await db.get(`SELECT * FROM articles WHERE id = ?`, articleId);
  if (!article || article.authorId !== userId) {
    return res.sendStatus(403);
  }
  await db.run(
    'DELETE FROM articles WHERE id=?',
    articleId
  );
  console.log("remove");
  res.json({ message: 'Deleted' });
}


export async function exportData(req: Request, res: Response): Promise<any> {
  let sendTo: string
  console.log("exportData");
  try {
    sendTo = (new URL(req.query.to as string)).toString()
  } catch (error) {
    return res.sendStatus(400)
  }


  const userId = req.session.user!.id;
  let articles = await db.all('SELECT * FROM articles WHERE authorId = ?', userId);
  articles = articles.map(article => ({
    id: article.id,
    title: article.title
  }))

  await fetch(sendTo, {
    method: 'POST',
    body: JSON.stringify(articles),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  res.sendStatus(200)
}