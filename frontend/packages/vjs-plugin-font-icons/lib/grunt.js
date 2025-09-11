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
            'dist/css/mediacms-vjs-icons.css': 'scss/videojs-icons.scss'
        }
      }
    },
    watch: {
      all: {
        files: ['**/*.hbs', '**/*.js', './icons.json'],
        tasks: ['default']
      }
    }
  });

  grunt.registerTask('generate-font', async function() {
    var done = this.async();

    const { generateFonts } = require('fantasticon');
    let iconConfig = grunt.file.readJSON(path.join(__dirname, '..', 'icons.json'));

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

    // Create a temporary directory with renamed SVG files
    const tempDir = path.join(__dirname, '..', '.temp-icons');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputDir = path.resolve('build/fonts');
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Ensure dist directory exists for HTML preview
    const distDir = path.resolve('dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Copy and rename SVG files to match icon names
    icons.forEach(function(icon) {
      let sourcePath;
      if (icon['root-dir']) {
        sourcePath = icon['root-dir'] + icon.svg;
      } else {
        sourcePath = svgRootDir + icon.svg;
      }

      const destPath = path.join(tempDir, icon.name + '.svg');
      const svgContent = fs.readFileSync(sourcePath);
      fs.writeFileSync(destPath, svgContent);
    });

    try {
      // Generate custom codepoints starting from a specific range
      // Sort icon names alphabetically to match how fantasticon reads them
      const customCodepoints = {};
      let codepointStart = 0xf101; // Start from private use area
      const sortedIconNames = icons.map(icon => icon.name).sort();
      sortedIconNames.forEach((name, index) => {
        customCodepoints[name] = codepointStart + index;
      });

      await generateFonts({
        inputDir: tempDir,
        outputDir: './',
        name: iconConfig['font-name'],
        fontTypes: ['woff', 'ttf', 'svg'],
        assetTypes: ['scss', 'html'],
        templates: {
          scss: './templates/scss.hbs',
          html: './templates/html.hbs'
        },
        formatOptions: {
          woff: {
            // WOFF specific options
          },
          ttf: {
            // TTF specific options
          },
          json: {
            indent: 2
          }
        },
        pathOptions: {
          woff: path.join(outputDir, iconConfig['font-name'] + '.woff'),
          ttf: path.join(outputDir, iconConfig['font-name'] + '.ttf'),
          svg: path.join(outputDir, iconConfig['font-name'] + '.svg'),
          scss: './scss/_icons.scss',
          html: './dist/fonts-preview.html'
        },
        codepoints: customCodepoints,
        fontHeight: 1000,
        normalize: true
      });
      
      // Post-process the SCSS file to convert decimal codepoints to hexadecimal
      const scssFile = './scss/_icons.scss';
      let scssContent = fs.readFileSync(scssFile, 'utf8');
      
      // Replace decimal codepoints with hexadecimal
      scssContent = scssContent.replace(/(\w+):\s*'(\d+)'/g, (match, name, decimal) => {
        const hex = parseInt(decimal, 10).toString(16);
        return `${name}: '${hex}'`;
      });
      
      fs.writeFileSync(scssFile, scssContent);

      // Clean up temporary directory
      const rimraf = require('rimraf');
      rimraf.sync(tempDir);

      done();
    } catch (error) {
      console.error('Error generating fonts:', error);

      // Clean up temporary directory on error
      const rimraf = require('rimraf');
      rimraf.sync(tempDir);

      done(false);
    }
  });

  grunt.registerTask('update-base64', function() {
    let iconScssFile = './scss/_icons.scss';
    let iconConfig;
    if (grunt.option('custom-json')) {
        iconConfig = grunt.file.readJSON(path.resolve(process.cwd(), grunt.option('custom-json')));
    } else {
        iconConfig = grunt.file.readJSON(path.join(__dirname, '..', 'icons.json'));
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
