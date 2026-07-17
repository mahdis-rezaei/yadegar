module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 (SDK 54) moved its Babel plugin into react-native-worklets.
    // It must remain listed last.
    plugins: ["react-native-worklets/plugin"],
  };
};
