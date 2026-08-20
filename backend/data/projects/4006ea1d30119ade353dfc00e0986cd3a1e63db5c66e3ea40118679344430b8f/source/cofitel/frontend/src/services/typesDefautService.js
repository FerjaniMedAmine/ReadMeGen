import apiClient from "./apiClient";


export async function getTypesByPoste(posteId) {
  const response = await apiClient.get(
    `/postes-detection/${posteId}/types-defaut`
  );

  return response.data;
}


export async function getTypeDefaut(id) {
  const response = await apiClient.get(
    `/types-defaut/${id}`
  );

  return response.data;
}


export async function addTypeToPoste(posteId, name) {
  const response = await apiClient.post(
    `/postes-detection/${posteId}/types-defaut`,
    {
      name,
    }
  );

  return response.data;
}


export async function updateTypeDefaut(id, name) {
  const response = await apiClient.put(
    `/types-defaut/${id}`,
    {
      name,
    }
  );

  return response.data;
}


export async function deleteTypeDefaut(id) {
  const response = await apiClient.delete(
    `/types-defaut/${id}`
  );

  return response.data;
}