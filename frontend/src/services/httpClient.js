import axios from "axios";

const httpClient = axios.create({
  baseURL: "http://localhost:8000/api/v1",
  headers: {
    Accept: "application/json",
  },
});

export default httpClient;