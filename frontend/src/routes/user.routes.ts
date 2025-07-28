// //user.routes.ts (frontend)
import { MatchEntry } from "../ui/matchInfo.js";

export async function getUser(id: number): Promise<any> {
  const token = sessionStorage.getItem("authToken");

  const res = await fetch(`/api/users/${id}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("User not found");
  }

  return await res.json();
}
  
export async function deleteUser(id: number): Promise<any> {
  const token = sessionStorage.getItem("authToken");

  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    throw new Error("Error: unable to delete user");
  }

  return await res.json();
}
  
export async function updateUser(userId: number, updatedData: any): Promise<any> {
  const token = sessionStorage.getItem("authToken");

  console.log("sending to gateway-api ", updatedData);

  const response = await fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(updatedData)
  });

  if(!response.ok) {
    throw new Error("Failed to update user");
  }

  return await response.json();
}

export async function uploadBase64Image(userId: number, base64Image: string): Promise<void> {

  const token = sessionStorage.getItem("authToken");

  try{ 
    const response = await fetch(`/api/users/${userId}/upload-base64`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l'envoi de l'image.");
    }
  } catch(error) {
    console.error("Erreur lors de l'upload:", error);
  }
}

export async function getUserSettings(userId: number): Promise<any> {
  const token = sessionStorage.getItem("authToken");

  const response = await fetch(`/api/users/${userId}/preferences`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if(!response.ok){
    throw new Error("Impossible de recuperer les preferences utilisateur"); 
  }

  return await response.json();
}

export async function saveUserSettings(userId: number, preferences: {
  language: string,
  languageMode: string
}): Promise<void>{
  const token = sessionStorage.getItem("authToken");
  console.log("Token:", token); // TEMPORAL para depurar


  const response = await fetch(`/api/users/${userId}/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(preferences),
  });

  if(!response.ok) {
    throw new Error("Echec de l'enregistrement des preferences");
  }
}

export async function getUserStats(id: number): Promise<any> {
  const token = sessionStorage.getItem("authToken");

  const res = await fetch(`/api/users/${id}/stats`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Stats not found");
  }

  return await res.json();
}

export async function getUserMatchHistory(userId: number): Promise<MatchEntry[]> {
  const token = sessionStorage.getItem("authToken");
  const res = await fetch(`/api/users/${userId}/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok)
    throw new Error("Failed to fetch match history");

  return await res.json();
}
