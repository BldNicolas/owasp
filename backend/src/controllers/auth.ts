import { db } from '@/database';
import { Request, Response } from 'express';
import bcrypt from "bcrypt";

// Inscription
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



// Connexion
export async function login(req: Request, res: Response): Promise<any> {
  const { username, password } = req.body;
  const user = await db.get(`SELECT * FROM users WHERE username = ?`, username);
  if (!user) return res.status(401).json({ error: 'User not exist' });
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid)
     return res.status(401).json({ error: "Invalid password" });
  req.session.user = { id: user.id, role: user.role };
  res.json({ id: user.id, username: user.username, role: user.role });
}

// Déconnexion
export async function logout(_req: Request, res: Response): Promise<any> {
  res.clearCookie('session').json({ message: 'Logged out' });
}

// Retourne les infos de l’utilisateur connecté
export async function me(req: Request, res: Response): Promise<any> {
  const userId = req.session.user!.id
  const user = await db.get(`SELECT * FROM users WHERE id = ?`, userId);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: user.id, username: user.username, role: user.role });
}
