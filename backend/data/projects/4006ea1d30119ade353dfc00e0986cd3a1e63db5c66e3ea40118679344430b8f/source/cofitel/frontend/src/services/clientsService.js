import apiClient from "./apiClient";


export async function getClients() {
  const response = await apiClient.get("/clients");
  return response.data;
}


export async function addClient(nom) {
  const response = await apiClient.post("/clients", {
    nom,
  });

  return response.data;
}


export async function updateClient(id, nom) {
  const response = await apiClient.put(`/clients/${id}`, {
    nom,
  });

  return response.data;
}


export async function deleteClient(id) {
  const response = await apiClient.delete(`/clients/${id}`);
  return response.data;
}