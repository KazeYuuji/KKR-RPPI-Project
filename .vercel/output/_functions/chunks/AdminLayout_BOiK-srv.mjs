import { c as createComponent } from './astro-component_gEIcYe7J.mjs';
import 'piccolore';
import { b0 as maybeRenderHead, aa as addAttribute, bq as unescapeHTML, bg as renderTemplate, bc as renderHead, bd as renderSlot } from './params-and-props_Xo-pmbj1.mjs';
import { r as renderComponent } from './entrypoint_CW6GZbZA.mjs';
import 'clsx';
import { r as renderScript } from './global_AQ_MZSBL.mjs';

const $$Sidebar = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Sidebar;
  const { currentPath, isOpen } = Astro2.props;
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/dashboard/analytics", label: "Analytics", icon: "chart" },
    { href: "/dashboard/sponsors", label: "Sponsor", icon: "heart" },
    { href: "/dashboard/speakers", label: "Pembicara", icon: "user" },
    { href: "/dashboard/settings", label: "Pengaturan", icon: "settings" }
  ];
  const icons = {
    grid: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    chart: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>`,
    heart: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
  };
  return renderTemplate`${maybeRenderHead()}<aside id="sidebar"${addAttribute([
    "fixed left-0 top-0 h-full w-[260px] bg-white border-r border-kkr-light/50 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-xl shadow-kkr-dark/10",
    isOpen ? "translate-x-0" : "-translate-x-full"
  ], "class:list")}> <div class="flex items-center justify-between px-5 h-16 border-b border-kkr-light/30 shrink-0"> <a href="/dashboard" class="flex items-center gap-2.5"> <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-kkr-red to-kkr-red flex items-center justify-center shadow-lg shadow-kkr-light/50"> <span class="text-white font-bold text-sm">KR</span> </div> <div> <span class="font-semibold text-sm text-kkr-dark">KKR RPPI</span> <p class="text-[10px] text-kkr-maroon/60 leading-none -mt-0.5">Admin Panel</p> </div> </a> <button id="close-sidebar" class="lg:hidden p-2 rounded-xl hover:bg-kkr-light/40 text-kkr-maroon/60 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> </button> </div> <nav class="flex-1 p-3 space-y-1 overflow-y-auto"> ${links.map((link) => {
    const active = currentPath === link.href;
    return renderTemplate`<a${addAttribute(link.href, "href")}${addAttribute([
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
      active ? "bg-gradient-to-r from-kkr-light to-kkr-light/40 text-kkr-red font-semibold" : "text-kkr-maroon/80 hover:bg-white hover:text-kkr-purple"
    ], "class:list")}> <span${addAttribute([
      "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150",
      active ? "bg-kkr-red text-white shadow-sm shadow-kkr-light/50" : "text-kkr-maroon/60 group-hover:text-kkr-maroon"
    ], "class:list")}>${unescapeHTML(icons[link.icon])}</span> ${link.label} ${active && renderTemplate`<span class="ml-auto w-1.5 h-1.5 rounded-full bg-kkr-red"></span>`} </a>`;
  })} </nav> <div class="p-3 border-t border-kkr-light/30 space-y-1"> <a href="/" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-kkr-maroon/80 hover:text-kkr-purple hover:bg-white transition-all duration-150 group"> <span class="w-8 h-8 rounded-lg bg-kkr-light/40 flex items-center justify-center text-kkr-maroon/60 group-hover:bg-kkr-light/60 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> </span>
Lihat Website
</a> <button id="logout-btn" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 w-full transition-all duration-150 group"> <span class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-400 group-hover:bg-red-100 transition-colors">${unescapeHTML(icons.logout)}</span>
Keluar
</button> </div> </aside> <div id="sidebar-overlay"${addAttribute(["fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"], "class:list")}></div> ${renderScript($$result, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/components/dashboard/Sidebar.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/components/dashboard/Sidebar.astro", void 0);

const $$Header = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Header;
  const { title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<header class="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-kkr-light/50 h-16 flex items-center justify-between px-4 sm:px-6 lg:pl-[72px] transition-all duration-300"> <div class="flex items-center gap-3 min-w-0"> <button id="menu-toggle" class="lg:hidden p-2 rounded-xl hover:bg-kkr-light/40 text-kkr-maroon/80 transition-colors" aria-label="Buka menu"> <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg> </button> <div class="hidden sm:flex items-center gap-2 text-xs text-kkr-maroon/60"> <span class="hover:text-kkr-maroon transition-colors">Admin</span> <span>/</span> <span class="text-kkr-purple font-medium">${title}</span> </div> <h1 class="sm:hidden text-base font-semibold text-kkr-dark truncate">${title}</h1> </div> <div class="flex items-center gap-1.5"> <a href="/#sponsors" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-kkr-red hover:bg-kkr-light transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
Sponsor
</a> <a href="/" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-kkr-maroon hover:bg-kkr-light/40 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
Website
</a> <div class="w-px h-6 bg-kkr-light/60 mx-1 hidden sm:block"></div> <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-kkr-maroon to-kkr-red flex items-center justify-center text-sm font-bold text-white shadow-sm shadow-kkr-light/50">
A
</div> </div> </header> ${renderScript($$result, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/components/dashboard/Header.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/components/dashboard/Header.astro", void 0);

const $$AdminLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$AdminLayout;
  const { title } = Astro2.props;
  const currentPath = Astro2.url.pathname;
  return renderTemplate`<html lang="id"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} — Admin Dashboard</title>${renderHead()}</head> <body class="bg-kkr-light"> ${renderComponent($$result, "Sidebar", $$Sidebar, { "currentPath": currentPath, "isOpen": false })} ${renderComponent($$result, "Header", $$Header, { "title": title })} <main id="main-content" class="lg:ml-[260px] pt-20 px-4 sm:px-8 pb-12 min-h-screen transition-all duration-300"> <div class="mx-auto max-w-7xl"> ${renderSlot($$result, $$slots["default"])} </div> </main> </body></html>`;
}, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/layouts/AdminLayout.astro", void 0);

export { $$AdminLayout as $ };
