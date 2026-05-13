import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), "../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
