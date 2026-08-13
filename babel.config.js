module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
            "@modules": "./src/modules",
            "@navigation": "./src/navigation",
            "@shared": "./src/shared",
            "@config": "./src/config",
            "@native": "./modules",
          },
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
    ],
  };
};
