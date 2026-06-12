module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-worklets / reanimated 4. Must be last.
      // Skia v2 transitively depends on the worklets runtime through
      // reanimated 4, so without this the bundled JS throws
      // "react-native-reanimated is not installed!" at boot.
      'react-native-worklets/plugin',
    ],
  };
};
