import 'es-module-lexer';
import { at as defineMiddleware, bl as sequence } from './chunks/params-and-props_Xo-pmbj1.mjs';
import 'piccolore';
import 'clsx';
import { g as getAdminFromRequest } from './chunks/auth_DE68QUa2.mjs';
import { i as initSchema } from './chunks/db_4_NgtA8M.mjs';

const protectedPaths = ["/dashboard", "/api/settings", "/api/registrants", "/api/tickets", "/api/speakers", "/api/sponsors", "/api/upload"];
const apiPrefix = "/api";
let schemaInitialized = false;
const onRequest$1 = defineMiddleware(async (context, next) => {
  if (!schemaInitialized) {
    try {
      await initSchema();
      schemaInitialized = true;
    } catch (e) {
      console.error("Schema init failed:", e);
    }
  }
  const url = context.url.pathname;
  const isProtected = protectedPaths.some((p) => url.startsWith(p));
  if (isProtected) {
    const admin = getAdminFromRequest(context.request);
    if (!admin) {
      if (url.startsWith(apiPrefix)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      return context.redirect("/login");
    }
    context.locals.admin = admin;
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
