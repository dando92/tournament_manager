import ReactDOM from "react-dom/client";
import AppRouter from "@/app/router";
import Providers from "@/app/providers";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Providers>
    <AppRouter />
  </Providers>,
);
