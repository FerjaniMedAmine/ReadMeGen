import apiClient from "./apiClient";


export async function getCodesByType(typeId) {
  const response = await apiClient.get(
    `/types-defaut/${typeId}/codes-erreur`
  );

  return response.data;
}


export async function getCodeErreur(id) {
  const response = await apiClient.get(
    `/codes-erreur/${id}`
  );

  return response.data;
}


export async function addCodeToType(typeId, code) {
  const response = await apiClient.post(
    `/types-defaut/${typeId}/codes-erreur`,
    {
      code,
    }
  );

  return response.data;
}


export async function updateCodeErreur(id, code) {
  const response = await apiClient.put(
    `/codes-erreur/${id}`,
    {
      code,
    }
  );

  return response.data;
}


export async function deleteCodeErreur(id) {
  const response = await apiClient.delete(
    `/codes-erreur/${id}`
  );

  return response.data;
}