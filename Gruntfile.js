module.exports = function(grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            pgp_zimlet: {
                files: {
                    'resources/org_open_sw_pgp.js': ['./pgp-zimlet.js']
                },
                options: {
                    debug: true,
                    external: [ 'openpgp', 'keyring' ],
                    standalone: 'org_open_sw_pgp'
                }
            },
            pgp_zimlet_nodebug: {
                files: {
                    'resources/org_open_sw_pgp_nodebug.js': ['./pgp-zimlet.js']
                },
                options: {
                    external: [ 'openpgp', 'keyring' ],
                    standalone: 'org_open_sw_pgp'
                }
            }
        },
        uglify: {
          'pgp-zimlet': {
            files: {
              "resources/org_open_sw_pgp.min.js" : [ "resources/org_open_sw_pgp_nodebug.js" ]
            }
          },
          options: {
            banner: '/*! This is GPL licensed code, see LICENSE/our website for more information.- v<%= pkg.version %> - ' +
              '<%= grunt.template.today("yyyy-mm-dd") %> */'
          }
        },
        jshint: {
            all: [ 'pgp-zimlet.js' ]
        },

        copy: {
            npm: {
                expand: true,
                flatten: true,
                cwd: 'node_modules/',
                src: ['mocha/mocha.css', 'mocha/mocha.js', 'chai/chai.js', 'sinon/pkg/sinon.js'],
                dest: 'test/lib/'
            },
        }
    });

    // Load the plugin(s)
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.loadNpmTasks('grunt-jsdoc');

    grunt.registerTask('default', 'Build OpenPGP.js', function() {
        grunt.task.run(['jshint', 'browserify', 'uglify']);
    });
    grunt.registerTask('documentation', ['jsdoc']);

    grunt.registerTask('build_template', 'Build HTML template', function () {
        var done = this.async();
        require('child_process').exec('test/build-template', function (err, stdout) {
            grunt.log.write(stdout);
            done(err);
        });
    });

    grunt.registerTask('mocha_phantomjs', 'mocha-phantomjs', function () {
        var done = this.async();
        require('child_process').exec('node_modules/mocha-phantomjs/bin/mocha-phantomjs ./test/index.html', function (err, stdout) {
            grunt.log.write(stdout);
            done(err);
        });
    });

    // Test/Dev tasks
    grunt.registerTask('test', ['jshint', 'build_template', 'copy', 'mocha_phantomjs']);
};
