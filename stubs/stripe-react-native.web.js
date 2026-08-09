// Web stub for @stripe/stripe-react-native.
// The native module imports react-native internals (codegenNativeCommands) that
// cannot bundle for web. Mirrors the react-native-maps web stub pattern wired up
// in metro.config.js. Only affects the local web dev target; native builds use
// the real package. Payment flows are exercised on native / in live mode only —
// in web + mock mode these are never reached, so no-op shapes are sufficient.
const React = require("react");
const { View, TextInput } = require("react-native");

const StripeProvider = (props) => React.createElement(React.Fragment, null, props.children);

const CardField = (props) =>
  React.createElement(TextInput, {
    style: props.style,
    placeholder: (props.placeholders && props.placeholders.number) || "Card number",
    editable: false,
  });

const noopResult = async () => ({ error: undefined });

const useStripe = () => ({
  confirmPayment: noopResult,
  confirmSetupIntent: noopResult,
  createPaymentMethod: noopResult,
  handleNextAction: noopResult,
  initPaymentSheet: noopResult,
  presentPaymentSheet: noopResult,
  retrievePaymentIntent: noopResult,
  retrieveSetupIntent: noopResult,
});

const useConfirmPayment = () => ({ confirmPayment: noopResult, loading: false });
const useConfirmSetupIntent = () => ({ confirmSetupIntent: noopResult, loading: false });

const initStripe = async () => undefined;

module.exports = {
  __esModule: true,
  StripeProvider,
  CardField,
  useStripe,
  useConfirmPayment,
  useConfirmSetupIntent,
  initStripe,
  default: { StripeProvider, CardField, useStripe, initStripe },
};
