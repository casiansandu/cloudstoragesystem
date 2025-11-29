
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import config from "../config/config";

const redis = new Redis(config.REDIS_URL, {
  family: 4, //ipv4
});

interface SrpSessionData {
    id: number;
  b: string; // Server Secret Ephemeral
  B: string; // Server Public Ephemeral
  A: string; // Client Public Ephemeral
  v: string; // Verifier
  salt: string;
  username: string;
}

export const SrpSessionStore = {
  save: async (data: SrpSessionData): Promise<string> => {
    const sessionId = uuidv4();
    await redis.set(`srp_login:${sessionId}`, JSON.stringify(data), "EX", 120);
    return sessionId;
  },

  get: async (sessionId: string): Promise<SrpSessionData | null> => {
    const data = await redis.get(`srp_login:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  delete: async (sessionId: string) => {
    await redis.del(`srp_login:${sessionId}`);
  }
};