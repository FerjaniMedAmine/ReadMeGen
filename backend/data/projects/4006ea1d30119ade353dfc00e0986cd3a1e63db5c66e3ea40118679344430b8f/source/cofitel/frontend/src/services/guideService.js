import apiClient from "./apiClient";


export async function getGuideByCarte(reference) {
  const params = new URLSearchParams({
    reference,
  });

  const response = await apiClient.get(`/guide-carte?${params}`);
  return response.data;
}


export async function addGuideLine(reference, guideLine) {
  const params = new URLSearchParams({
    reference,
  });

  const response = await apiClient.post(`/guide-carte?${params}`, guideLine);
  return response.data;
}


export async function updateGuideLine(id, guideLine) {
  const response = await apiClient.put(`/guide/${id}`, guideLine);
  return response.data;
}


export async function deleteGuideLine(id) {
  const response = await apiClient.delete(`/guide/${id}`);
  return response.data;
}


export async function lookupGuideLine(carteReference, machineNom, composantReference) {
  const params = new URLSearchParams({
    carte_reference: carteReference,
    machine_nom: machineNom,
    composant_reference: composantReference,
  });

  const response = await apiClient.get(`/guide/lookup?${params}`);
  return response.data;
}

export async function importGuide(reference, lignes) {
  const params = new URLSearchParams({
    reference,
  });

  const response = await apiClient.post(
    `/guide-carte/import?${params}`,
    { lignes }
  );

  return response.data;
}