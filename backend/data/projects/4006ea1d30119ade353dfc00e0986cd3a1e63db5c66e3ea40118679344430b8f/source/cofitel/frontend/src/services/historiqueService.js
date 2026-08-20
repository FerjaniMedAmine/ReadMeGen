import apiClient from "./apiClient";


export async function getHistorique() {
  const response = await apiClient.get("/historique");
  return response.data;
}


export async function addHistorique(historiqueData) {
  const response = await apiClient.post(
    "/historique",
    historiqueData
  );

  return response.data;
}





export async function getDernierEnregistrement(
  context,
  referenceBobine
) {
  const response = await apiClient.get(
    "/historique/dernier-enregistrement",
    {
      params: {
        site: context.site.trim(),
        client: context.client.trim(),
        machine: context.machine.trim(),
        reference_carte: context.referenceCarte.trim(),
        reference_bobine: referenceBobine.trim(),
      },
    }
  );

  return response.data;
}


export async function verifierSuiviAujourdHui() {
  const response = await apiClient.get(
    "/historique/suivi-aujourdhui/existe"
  );

  return response.data;
}








// v
export async function getHistoriqueContexteAujourdHui(context,typeOperation = null) {
  const response = await apiClient.get("/historique/contexte-aujourdhui",
    {
      params: {
        site: context.site.trim(),
        client: context.client.trim(),
        machine: context.machine.trim(),
        reference_carte: context.referenceCarte.trim(),
        type_operation: typeOperation,
      },
    }
  );

  return response.data;
}