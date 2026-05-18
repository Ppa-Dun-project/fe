// Outlet: the slot where child routes get rendered (a core React Router component)
// - The children routes from router.tsx are mounted here
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

/**
 * AppLayout: shared layout for every page
 * - Navbar on top, page content rendered below it
 * - Caps the width at 1400px to keep readability on large monitors
 */
export default function AppLayout() {
  return (
    // min-h-screen: minimum height set to the full viewport (short pages still fill the background)
    // bg-black text-white: black background + white text (dark theme)
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* w-full: full width / px-8: horizontal padding / py-6: vertical padding */}
      <main className="w-full px-8 py-6">
        {/* mx-auto: auto left/right margins (centers the content) */}
        {/* max-w-[1400px]: caps the width at 1400px */}
        <div className="mx-auto w-full max-w-[1400px]">
          {/* Outlet: the page component matching the current URL gets injected here */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
