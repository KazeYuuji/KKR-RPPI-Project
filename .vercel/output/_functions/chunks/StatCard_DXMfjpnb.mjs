import { c as createComponent } from './astro-component_gEIcYe7J.mjs';
import 'piccolore';
import { b0 as maybeRenderHead, aa as addAttribute, bg as renderTemplate, bq as unescapeHTML } from './params-and-props_Xo-pmbj1.mjs';
import 'clsx';

const $$StatCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$StatCard;
  const { label, value, change, trend, icon, delay = 0, colorIndex = 0 } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="bg-white rounded-2xl border border-kkr-light/50 p-5 sm:p-6 flex items-start justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"${addAttribute(`animation: fade-in-up 0.5s ease-out ${delay}ms both`, "style")}> <div class="space-y-1.5"> <p class="text-sm text-kkr-maroon/80 font-medium">${label}</p> <p class="text-2xl sm:text-3xl font-bold text-kkr-dark tracking-tight tabular-nums">${value}</p> ${change && trend && renderTemplate`<div class="flex items-center gap-1.5"> <span${addAttribute([
    "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
    trend === "up" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
  ], "class:list")}> <span>${trend === "up" ? "↑" : "↓"}</span> ${change} </span> <span class="text-xs text-kkr-maroon/60">vs sebelumnya</span> </div>`} </div> <div class="w-10 h-10 rounded-xl bg-gradient-to-br {colorClass} flex items-center justify-center shrink-0 shadow-sm"> <span>${unescapeHTML(icon)}</span> </div> </div>`;
}, "C:/Users/faizi/OneDrive/Dokumen/code/Project3/src/components/dashboard/StatCard.astro", void 0);

export { $$StatCard as $ };
