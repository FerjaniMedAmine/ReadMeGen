import httpClient from "./httpClient";

const projectService = {
  uploadZip: async (file) => {
    const formData = new FormData();
    formData.append("zip_file", file);

    const response = await httpClient.post(
      "/projects/upload-zip",
      formData
    );

    return response.data;
  },

  importGit: async (gitUrl) => {
    const response = await httpClient.post(
      "/projects/import-git",
      {
        git_url: gitUrl,
      }
    );

    return response.data;
  },

  getStatus: async (projectId) => {
    const response = await httpClient.get(
      `/projects/${projectId}/status`
    );

    return response.data;
  },
};

export default projectService;