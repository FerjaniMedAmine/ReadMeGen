import axios from "axios";
import { API_URL } from "../config/api";

const httpClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    Accept: "application/json",
  },
});

export default httpClient;
