import { request } from "./api";

const projectService = {
  uploadZip: async (file) => {
    const formData = new FormData();
    formData.append("zip_file", file);

    return request("/projects/upload-zip", { method: "POST", body: formData });
  },

  importGit: async (gitUrl) => {
    return request("/projects/import-git", { method: "POST", body: { git_url: gitUrl } });
  },

  getStatus: async (projectId, signal) => {
    return request(`/projects/${projectId}/status`, { signal });
  },

  getReadme: async (projectId, signal) => {
    return request(`/projects/${projectId}/readme`, { signal });
  },
};

export default projectService;
