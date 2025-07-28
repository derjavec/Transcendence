import bcrypt from 'bcrypt';
import { escape } from 'validator';

// Fonction pour hasher les mots de passe
export async function hashPassword(password: string): Promise<string> {
	const saltRounds = 10;
	try{
		const hashedPassword = await bcrypt.hash(password, saltRounds);
		return hashedPassword;
	} catch(error){
		console.error("erreur de hachage", error);
		throw new Error("Erreur de hachage");
	}
}

// Fonction pour comparer les mots de passe avec hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
	return await bcrypt.compare(password, hash);
}

// Proteger les html contre les attaques XSS
export function sanitizeInput(userInput: string): string {
	return escape(userInput);
  }