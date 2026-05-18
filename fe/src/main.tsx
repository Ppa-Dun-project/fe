// Import React's core library
import React from "react";
// ReactDOM: tool that renders React components into the actual DOM (the browser screen)
import ReactDOM from "react-dom/client";
// RouterProvider: component that supplies router configuration to the whole app
import { RouterProvider } from "react-router-dom";
// The routing configuration we defined (URL → page mapping)
import { router } from "./router";
// Global CSS styles (Tailwind + custom styles)
import "./index.css";

// document.getElementById("root"): finds the <div id="root"> element in the HTML
// createRoot: the React 18+ way of mounting the app
// ! (non-null assertion): tells TypeScript "this element is guaranteed to exist"
// .render(): paints the JSX inside onto the actual screen
ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode: React's inspection tool that catches potential problems during development
  // - Detects side effects, warns about deprecated APIs, etc.
  // - Automatically stripped out of production builds
  <React.StrictMode>
    {/* Apply the router to the entire app — from this point on, URL changes render the matching page */}
    <RouterProvider router={router} />
  </React.StrictMode>
);
