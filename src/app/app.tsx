import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Providers } from './providers';
import { routes } from './router';
export function App() {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
