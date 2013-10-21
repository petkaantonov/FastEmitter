"use strict";
module.exports = function( grunt ) {
    var SRC_DEST = "./fastemitter.js";

    var gruntConfig = {};

    gruntConfig.pkg = grunt.file.readJSON("package.json");

    gruntConfig.jshint = {
        all: {
            options: {
                jshintrc: "./.jshintrc"
            },

            files: {
                src: [
                    SRC_DEST
                ]
            }
        }
    };

    gruntConfig.bump = {
      options: {
        files: ['package.json'],
        updateConfigs: [],
        commit: true,
        commitMessage: 'Release v%VERSION%',
        commitFiles: ['-a'],
        createTag: true,
        tagName: 'v%VERSION%',
        tagMessage: 'Version %VERSION%',
        false: true,
        pushTo: 'master',
        gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
      }
    };

    grunt.initConfig(gruntConfig);
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-bump');

    function runIndependentTest( file, cb , env) {
        var fs = require("fs");
        var path = require("path");
        var sys = require('sys');
        var spawn = require('child_process').spawn;
        var p = path.join(process.cwd(), "test");

        var stdio = [
            'ignore',
            grunt.option("verbose")
                ? process.stdout
                : 'ignore',
            process.stderr
        ];
        var flags = ["--expose-gc"];

        var node = spawn('node', flags.concat(["../mocharun.js", file]),
                             {cwd: p, stdio: stdio, env: env});

        node.on('exit', exit );

        function exit( code ) {
            if( code !== 0 ) {
                cb(new Error("process didn't exit normally. Code: " + code));
            }
            else {
                cb(null);
            }
        }


    }


    function isSlowTest( file ) {
        return file.contains("2.3.3") ||
            file.contains("bind") ||
            file.contains("unhandled_rejections");
    }

    function testRun( testOption ) {
        var fs = require("fs");
        var path = require("path");
        var done = this.async();

        var totalTests = 0;
        var testsDone = 0;
        function testDone() {
            testsDone++;
            if( testsDone >= totalTests ) {
                done();
            }
        }
        var files = fs.readdirSync( "./test" );

        function runFile(file) {
            totalTests++;
            grunt.log.writeln("Running test " + file );
            runIndependentTest(file, function(err) {
                if( err ) throw new Error(err + " " + file + " failed");
                grunt.log.writeln("Test " + file + " succeeded");
                testDone();
                if( files.length > 0 ) {
                    runFile( files.shift() );
                }
            }, void 0);
        }

        var maxParallelProcesses = 10;
        var len = Math.min( files.length, maxParallelProcesses );
        for( var i = 0; i < len; ++i ) {
            runFile(files.shift());
        }
    }

    grunt.registerTask( "testrun", function(){
        var testOption = grunt.option("run");
        if( !testOption ) testOption = "all";
        else {
            testOption = ("" + testOption);
            testOption = testOption
                .replace( /\.js$/, "" )
                .replace( /[^a-zA-Z0-9_-]/g, "" );
        }
        testRun.call( this, testOption );
    });

    grunt.registerTask( "test", ["jshint", "testrun"] );
    grunt.registerTask( "default", ["jshint", "testrun"] );

};
