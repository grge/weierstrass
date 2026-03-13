import adapter from "@sveltejs/adapter-static";

const dev = process.env.NODE_ENV === "development";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		paths: {
			base: dev ? "" : "/weierstrass"
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes("node_modules") ? undefined : { runes: true }
	}
};

export default config;
