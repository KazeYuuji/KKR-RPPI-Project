import { c as createComponent } from './astro-component_gEIcYe7J.mjs';
import 'piccolore';
import { bc as renderHead, bg as renderTemplate } from './params-and-props_Xo-pmbj1.mjs';
import 'clsx';
import { r as renderScript } from './global_AQ_MZSBL.mjs';

const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="id"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login — Admin Dashboard</title>${renderHead()}</head> <body class="min-h-screen bg-gradient-to-br from-kkr-light via-white to-pink-50 flex items-center justify-center p-4"> <div class="w-full max-w-md animate-fade-in"> <div class="text-center mb-8"> <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-kkr-red to-kkr-red flex items-center justify-center mx-auto mb-4 shadow-lg shadow-kkr-light/50"> <span class="text-white font-bold text-2xl">KR</span> </div> <h1 class="text-2xl font-bold text-kkr-dark">Admin Dashboard</h1> <p class="text-kkr-maroon/80 mt-1">Masuk ke panel administrasi</p> </div> <div class="bg-white rounded-2xl border border-kkr-light/50 p-8 shadow-xl shadow-slate-200/40"> <form id="login-form" class="space-y-5"> <div> <label for="username" class="block text-sm font-medium text-kkr-purple mb-1.5">Username</label> <input id="username" type="text" autocomplete="username" required class="w-full rounded-xl border border-kkr-light/80 bg-white px-4 py-3 text-sm text-kkr-dark outline-none transition focus:border-kkr-red focus:ring-4 focus:ring-kkr-maroon/20" placeholder="Masukkan username"> </div> <div> <label for="password" class="block text-sm font-medium text-kkr-purple mb-1.5">Password</label> <input id="password" type="password" autocomplete="current-password" required class="w-full rounded-xl border border-kkr-light/80 bg-white px-4 py-3 text-sm text-kkr-dark outline-none transition focus:border-kkr-red focus:ring-4 focus:ring-kkr-maroon/20" placeholder="Masukkan password"> </div> <p id="login-error" class="text-sm text-red-600 hidden"></p> <button type="submit" id="login-btn" class="w-full rounded-xl bg-kkr-red px-4 py-3 text-sm font-semibold text-white transition hover:bg-kkr-maroon disabled:opacity-50 disabled:cursor-not-allowed">
Masuk
</button> </form> </div> </div> ${renderScript($$result, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/pages/login.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/pages/login.astro", void 0);

const $$file = "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/pages/login.astro";
const $$url = "/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
