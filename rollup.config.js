import dts from "rollup-plugin-dts";

export default [
  {
    input: "build/index.js",
    output: {
      file: "dist/index.js",
    },
    external: ["viem"],
  },
  {
    input: "build/index.d.ts",
    output: {
      file: "dist/index.d.ts",
    },
    external: ["viem"],
    plugins: [dts()],
  },
  {
    input: "build/index.js",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
    },
    external: ["viem"],
  },
];
