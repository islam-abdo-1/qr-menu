import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // مسارات المشروع (@/...) تعمل في الاختبارات
      "@": path.resolve(__dirname, "."),
      // "server-only" تُرمى في بيئة الاختبار (ليست بيئة React Server)
      "server-only": path.resolve(__dirname, "tests/__stubs__/server-only.ts"),
    },
  },
});