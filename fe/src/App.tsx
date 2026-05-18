// RouterProvider: React Router component that supplies the routing configuration to child components
import { RouterProvider } from "react-router-dom";
// router: configuration object mapping URLs to page components
import { router } from "./router";

// App: the root component of the app
// - Currently only wires up the router configuration
// - Global providers (theme, state management, etc.) will eventually be wrapped here
function App() {
  return <RouterProvider router={router} />;
}

// default export: allows other files to import via `import App from './App'`
export default App;
