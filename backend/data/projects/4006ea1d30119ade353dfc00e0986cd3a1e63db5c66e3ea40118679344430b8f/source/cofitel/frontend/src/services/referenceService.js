import apiClient from "./apiClient";


export async function checkCarteReference(reference, client) {
  const params = new URLSearchParams({
    reference,
    client,
  });

  const response = await apiClient.get(`/cartes/check?${params}`);
  return response.data;
}