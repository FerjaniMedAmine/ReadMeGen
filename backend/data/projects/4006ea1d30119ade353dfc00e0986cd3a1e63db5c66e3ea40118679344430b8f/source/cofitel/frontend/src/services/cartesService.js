import apiClient from "./apiClient";


export async function getCartesByClient(clientId) {
  const response = await apiClient.get(`/clients/${clientId}/cartes`);
  return response.data;
}


export async function addCarteToClient(clientId, reference, description) {
  const response = await apiClient.post(`/clients/${clientId}/cartes`, {
    reference,
    description,
  });

  return response.data;
}


export async function deleteCarte(reference) {
  const response = await apiClient.delete(
    `/cartes/${encodeURIComponent(reference)}`
  );

  return response.data;
}



export async function getClientByReference(reference) {
  const response = await apiClient.get("/cartes/client", {
    params: { reference },
  });

  return response.data;
}