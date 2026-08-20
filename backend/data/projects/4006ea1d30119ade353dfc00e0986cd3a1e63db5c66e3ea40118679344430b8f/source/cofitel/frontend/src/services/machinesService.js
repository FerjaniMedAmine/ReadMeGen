import apiClient from "./apiClient";


export async function getMachines() {
  const response = await apiClient.get("/machines");
  return response.data;
}


export async function addMachine(nom) {
  const response = await apiClient.post("/machines", {
    nom,
  });

  return response.data;
}


export async function updateMachine(nomActuel, nouveauNom) {
  const response = await apiClient.put(
    `/machines/${encodeURIComponent(nomActuel)}`,
    {
      nouveau_nom: nouveauNom,
    }
  );

  return response.data;
}


export async function deleteMachine(nom) {
  const response = await apiClient.delete(
    `/machines/${encodeURIComponent(nom)}`
  );

  return response.data;
}