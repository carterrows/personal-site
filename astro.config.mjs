import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  adapter: node({
    mode: "standalone"
  }),
  integrations: [tailwind()],
  output: "server"
});
