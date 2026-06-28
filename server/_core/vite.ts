import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config.ts";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // Inject driver-specific manifest and meta tags for /motoboy routes
      if (url.startsWith("/motoboy")) {
        template = injectDriverPWATags(template);
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Replaces the default Bonatto Pizza manifest and meta tags with the
 * dedicated driver PWA manifest so that iOS/Android capture the correct
 * start_url (/motoboy) when the user adds the page to the home screen.
 */
function injectDriverPWATags(html: string): string {
  return html
    // Swap manifest — versão com cache-busting para forçar iOS a reler
    .replace(
      `<link rel="manifest" href="/manifest.json" />`,
      `<link rel="manifest" href="/driver-manifest.json?v=2" />`
    )
    // Swap page title
    .replace(
      `<title>Bonatto Pizza - Plataforma de Pedidos Online</title>`,
      `<title>Bonatto Motoboy</title>`
    )
    // Swap theme-color
    .replace(
      `<meta name="theme-color" content="#c8102e" />`,
      `<meta name="theme-color" content="#6E0D12" />`
    )
    // Swap apple-mobile-web-app-title
    .replace(
      `<meta name="apple-mobile-web-app-title" content="Bonatto" />`,
      `<meta name="apple-mobile-web-app-title" content="Motoboy" />`
    )
    // Swap apple-touch-icon
    .replace(
      `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`,
      `<link rel="apple-touch-icon" sizes="180x180" href="/driver-apple-touch-icon.png" />`
    );
}

export function serveStatic(app: Express) {
  const candidatePaths = process.env.NODE_ENV === "development"
    ? [path.resolve(import.meta.dirname, "../..", "dist", "public")]
    : [
        path.resolve(process.cwd(), "dist", "public"),
        path.resolve(import.meta.dirname, "../..", "dist", "public"),
        path.resolve(import.meta.dirname, "public"),
      ];

  const distPath = candidatePaths.find((candidate) => fs.existsSync(candidate))
    ?? candidatePaths[0];

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // ⚠️ MUST be registered BEFORE express.static so that /motoboy routes are
  // intercepted before the static middleware serves the generic index.html.
  // This ensures iOS/Android read the correct driver-manifest.json when the
  // user taps "Add to Home Screen" on the /motoboy page.
  const serveDriverHTML = (_req: express.Request, res: express.Response) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      let html = fs.readFileSync(indexPath, "utf-8");
      html = injectDriverPWATags(html);
      res
        .status(200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          // Prevent CDN/browser from caching this specific HTML response
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        })
        .end(html);
    } catch {
      res.sendFile(indexPath);
    }
  };

  // Explicit routes for /motoboy and sub-paths — registered before static middleware
  app.get("/motoboy", serveDriverHTML);
  app.get("/motoboy/*", serveDriverHTML);

  app.use(express.static(distPath));

  // Fallback for all other SPA routes
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
