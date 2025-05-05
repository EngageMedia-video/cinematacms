import rollup_builds from "./includes/rollup_builds.js";
import pckg from '../package.json' assert { type: 'json' };

const dists = rollup_builds( './src/index.js', "./out", pckg );

export default [
    dists.browser("./dist/mediacms-vjs-plugin.js")
];
