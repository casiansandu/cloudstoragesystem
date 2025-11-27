interface AppConfig {
  BACKENDURL: string;
}

const config: AppConfig = {
  BACKENDURL: import.meta.env.VITE_BACKENDURL
};

console.log("Backend URL:", config.BACKENDURL);
if (!config.BACKENDURL) {
    throw new Error("Missing BACKENDURL environment variable");
}

export default config;