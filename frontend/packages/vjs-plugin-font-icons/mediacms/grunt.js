var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var sass = require('sass');

let iconsIndex = [];

// Merge a `source` object to a `target` recursively
function merge(target, source) {
    // Check if font name is changed
    if (source['font-name']) {
        target['font-name'] = source['font-name'];
    }

    // Check if root dir is changed
    if (source['root-dir']) {
        target['root-dir'] = source['root-dir'];
    }

    // Check for icon changes
    if (source.icons) {
        for (let icon of source['icons']) {
            let index = iconsIndex.indexOf(icon.name);

            // Icon is replaced
            if (index !== -1) {
                target.icons[index] = icon;
            }
            // New icon is added
            else {
                target.icons.push(icon);
                iconsIndex.push(icon.name);
            }
        }
    }

    return target;
}

module.exports = function(grunt) {

    grunt.initConfig({
        sass: {
            options: {
                implementation: sass,
                // sourceMap: true,
            },
            dist: {
                files: {
                    'dist/mediacms-vjs-icons.css': 'scss/videojs-icons.scss'
                }
            }
        },
        watch: {
            all: {
                files: ['**/*.hbs', '**/*.js', './mediacms/icons.json'],
                tasks: ['default']
            }
        }
    });

    grunt.registerTask('generate-font', function() {
        var done = this.async();

        let { generateFonts } = require('fantasticon');

        let iconConfig = grunt.file.readJSON(path.join(__dirname, '..', 'mediacms/icons.json'));

        let svgRootDir = iconConfig['root-dir'];
        if (grunt.option('exclude-default')) {
            // Exclude default video.js icons
            iconConfig.icons = [];
        }
        let icons = iconConfig.icons;

        // Index default icons
        for (let i = 0; i < icons.length; i++) {
            iconsIndex.push(icons[i].name);
        }

        // Merge custom icons
        const paths = (grunt.option('custom-json') || '').split(',').filter(Boolean);
        for (let i = 0; i < paths.length; i++) {
            let customConfig = grunt.file.readJSON(path.resolve(process.cwd(), paths[i]));
            iconConfig = merge(iconConfig, customConfig);
        }

        icons = iconConfig.icons;

        // Create a map of icon names to SVG file paths
        let inputDir = path.resolve('temp-svg-icons');
        let outputDir = path.resolve('build/fonts');

        // Ensure the temp directory exists
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
        }

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create scss directory if it doesn't exist
        let scssDir = path.resolve('scss');
        if (!fs.existsSync(scssDir)) {
            fs.mkdirSync(scssDir, { recursive: true });
        }

        // Create temporary SVG files with correct names for fantasticon
        for (let icon of icons) {
            let sourcePath;
            if (icon['root-dir']) {
                sourcePath = icon['root-dir'] + icon.svg;
            } else {
                sourcePath = svgRootDir + icon.svg;
            }

            // Create a copy with the icon name as the filename
            let targetPath = path.join(inputDir, `${icon.name}.svg`);
            fs.copyFileSync(sourcePath, targetPath);
        }

        generateFonts({
            inputDir: inputDir,
            outputDir: outputDir,
            name: iconConfig['font-name'],
            fontTypes: ['svg', 'woff', 'ttf'],
            assetTypes: ['css', 'html'],
            fontHeight: 300,
            normalize: true,
            templates: {
                css: './templates/scss.hbs',
                html: './templates/html.hbs'
            },
            pathOptions: {
                css: path.resolve('scss/_icons.scss'),
                html: path.resolve('index.html')
            },
            formatOptions: {
                json: {
                    indent: 2
                }
            }
        }).then(function() {
            // Clean up temporary directory
            fs.rmSync(inputDir, { recursive: true, force: true });
            done();
        }).catch(function(error) {
            console.error(error);
            // Clean up temporary directory even on error
            if (fs.existsSync(inputDir)) {
                fs.rmSync(inputDir, { recursive: true, force: true });
            }
            done(false);
        });
    });

    grunt.registerTask('update-base64', function() {
        let iconScssFile = './scss/_icons.scss';
        let iconConfig;
        if (grunt.option('custom-json')) {
            iconConfig = grunt.file.readJSON(path.resolve(process.cwd(), grunt.option('custom-json')));
        } else {
            iconConfig = grunt.file.readJSON(path.join(__dirname, '..', 'mediacms/icons.json'));
        }
        let fontName = iconConfig['font-name'];
        let fontFiles = {
            woff: './build/fonts/' + fontName + '.woff'
        };

        let scssContents = fs.readFileSync(iconScssFile).toString();

        Object.keys(fontFiles).forEach(function(font) {
            let fontFile = fontFiles[font];
            let fontContent = fs.readFileSync(fontFile);

            let regex = new RegExp(`(url.*font-${font}.*base64,)([^\\s]+)(\\).*)`);

            scssContents = scssContents.replace(regex, `$1${fontContent.toString('base64')}$3`);
        });

        fs.writeFileSync(iconScssFile, scssContents);
    });

    grunt.registerTask('default', ['generate-font', 'update-base64', 'sass']);
};
