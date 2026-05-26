import "./polyfills";
import { env } from "./config/env";
import { renderSetupScreen } from "./SetupScreen";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

if (!env.privyAppId) {
  renderSetupScreen(root);
} else {
  void import("./bootstrap").then(({ renderApp }) => renderApp(root));
}
