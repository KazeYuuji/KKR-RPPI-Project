const POST = async () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
