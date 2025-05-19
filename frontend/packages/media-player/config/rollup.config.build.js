import rollup_builds from "./includes/rollup_builds.js";
import pckg from '../package.json' with { type: "json" };

const dists = rollup_builds( './src/index.js', "./out", pckg );

export default [
	dists.browser("./dist/mediacms-media-player.js"),
    // dists.browser("./dist/mediacms-media-player.js", true),
    // dists.browser("./dist/mediacms-media-player.min.js", true, true),
    // dists.browser("./dist/mediacms-media-player.min.js", true, true, true)
];
