import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Desktop from "../pages/Desktop";
import NotFound from "../pages/NotFound";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
import { routes } from "./routes";

// Kept out of the entry chunk: the overview page is a secondary surface, and the
// main bundle is already ~3.5 MB. Lazy loading keeps it in its own chunk.
const Landing = lazy(() => import("../pages/Landing"));

const uniqueRoutableRoutes = (() => {
  const seenPaths = new Set<string>();
  return routes.filter((route) => {
    if (route.component === null) return false;
    if (seenPaths.has(route.path)) return false;
    seenPaths.add(route.path);
    return true;
  });
})();

export const router = createBrowserRouter([
  {
    path: "/settings",
    element: <Desktop />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <Navigate to="/microhood" replace />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/landing",
    element: (
      <Suspense fallback={<div>Loading...</div>}>
        <Landing />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  ...uniqueRoutableRoutes
    .map((route) => {
      const Component = route.component!;
      return {
        path: route.path,
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        ),
        errorElement: <RouteErrorBoundary />,
      };
    }),
  {
    path: "*",
    element: <NotFound />,
    errorElement: <RouteErrorBoundary />,
  },
]);
