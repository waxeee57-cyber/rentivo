const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'react-native-maps') {
      return {
        filePath: path.resolve(__dirname, 'stubs/react-native-maps.web.js'),
        type: 'sourceFile',
      }
    }
    // @stripe/stripe-react-native imports react-native internals (native-only
    // codegen) that cannot bundle for web. Stub it for the web dev target only;
    // native builds continue to use the real package.
    if (moduleName === '@stripe/stripe-react-native') {
      return {
        filePath: path.resolve(__dirname, 'stubs/stripe-react-native.web.js'),
        type: 'sourceFile',
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
