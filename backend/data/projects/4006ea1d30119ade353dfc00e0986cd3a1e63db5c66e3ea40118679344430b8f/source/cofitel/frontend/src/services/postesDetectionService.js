import apiClient from "./apiClient";


export async function getPostesByIlot(ilotId) {
  const response = await apiClient.get(
    `/ilots/${ilotId}/postes-detection`
  );

  return response.data;
}


export async function getPosteDetection(id) {
  const response = await apiClient.get(
    `/postes-detection/${id}`
  );

  return response.data;
}


export async function addPosteToIlot(ilotId, name) {
  const response = await apiClient.post(
    `/ilots/${ilotId}/postes-detection`,
    {
      name,
    }
  );

  return response.data;
}


export async function updatePosteDetection(id, name) {
  const response = await apiClient.put(
    `/postes-detection/${id}`,
    {
      name,
    }
  );

  return response.data;
}


export async function deletePosteDetection(id) {
  const response = await apiClient.delete(
    `/postes-detection/${id}`
  );

  return response.data;
}
