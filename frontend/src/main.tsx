import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ToastContainer, toastError } from "./components/Toast";
import { getApiErrorMessage } from "./api/client";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Mutacoes que ja tratam o erro localmente (ex: formularios com mensagem inline) podem
      // desativar o toast global passando meta: { skipGlobalErrorToast: true }.
      if (mutation.meta?.skipGlobalErrorToast) return;
      toastError(getApiErrorMessage(error));
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ToastContainer />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
