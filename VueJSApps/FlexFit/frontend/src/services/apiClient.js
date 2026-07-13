import axios from 'axios';
import { API_BASE } from '@/config/env';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

export default apiClient;
